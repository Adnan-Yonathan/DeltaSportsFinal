-- Delta AI Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  starting_bankroll DECIMAL(10,2) DEFAULT 1000.00,
  current_bankroll DECIMAL(10,2) DEFAULT 1000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bets table
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Bet Details
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  game_description TEXT NOT NULL,
  bet_type TEXT NOT NULL,
  bet_side TEXT NOT NULL,
  odds INTEGER NOT NULL,

  -- Financial
  stake DECIMAL(10,2) NOT NULL,
  potential_win DECIMAL(10,2) NOT NULL,
  actual_result DECIMAL(10,2),

  -- Tracking
  book TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'cancelled')),
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  game_time TIMESTAMP WITH TIME ZONE,
  closing_odds INTEGER,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bankroll snapshots table
CREATE TABLE IF NOT EXISTS bankroll_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  balance DECIMAL(10,2) NOT NULL,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, snapshot_date)
);

-- Custom statistical models table
CREATE TABLE IF NOT EXISTS custom_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  model_name TEXT NOT NULL,
  sport_key TEXT NOT NULL,
  market_type TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  confidence_level NUMERIC(3,2) NOT NULL DEFAULT 0.90,
  config JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Injury reports cache table
CREATE TABLE IF NOT EXISTS injury_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_key TEXT NOT NULL,
  team_name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  source TEXT,
  source_updated_at TIMESTAMP WITH TIME ZONE,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team recent form cache
CREATE TABLE IF NOT EXISTS team_recent_form (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_key TEXT NOT NULL,
  team_name TEXT NOT NULL,
  game_date DATE NOT NULL,
  opponent TEXT NOT NULL,
  is_home BOOLEAN NOT NULL,
  result TEXT,
  points_for INTEGER,
  points_against INTEGER,
  pace NUMERIC,
  offensive_rating NUMERIC,
  defensive_rating NUMERIC,
  net_rating NUMERIC,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_user_sport ON bets(user_id, sport, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON bankroll_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_models_user_name ON custom_models(user_id, model_name);
CREATE INDEX IF NOT EXISTS idx_custom_models_last_used ON custom_models(user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_injury_reports_sport_team ON injury_reports(sport_key, team_name);
CREATE INDEX IF NOT EXISTS idx_injury_reports_captured ON injury_reports(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_form_team_date ON team_recent_form(team_name, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_recent_form_sport_team ON team_recent_form(sport_key, team_name);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankroll_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_recent_form ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for conversations table
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages table
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- RLS Policies for bets table
CREATE POLICY "Users can view own bets" ON bets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bets" ON bets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bets" ON bets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bets" ON bets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for bankroll_snapshots table
CREATE POLICY "Users can view own snapshots" ON bankroll_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own snapshots" ON bankroll_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for custom_models table
CREATE POLICY "Users can view own models" ON custom_models
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own models" ON custom_models
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own models" ON custom_models
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own models" ON custom_models
  FOR DELETE USING (auth.uid() = user_id);

-- Injury reports are read-only public data
CREATE POLICY "Anyone can view injuries" ON injury_reports
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view recent form" ON team_recent_form
  FOR SELECT USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_models_updated_at BEFORE UPDATE ON custom_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, starting_bankroll, current_bankroll)
  VALUES (NEW.id, NEW.email, 1000.00, 1000.00);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update bankroll after bet settlement
CREATE OR REPLACE FUNCTION update_bankroll_on_bet_settlement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status changed to won, lost, or push
  IF NEW.status IN ('won', 'lost', 'push') AND OLD.status = 'pending' THEN
    -- Update current bankroll
    UPDATE users
    SET current_bankroll = current_bankroll + COALESCE(NEW.actual_result, 0)
    WHERE id = NEW.user_id;

    -- Create snapshot for today if it doesn't exist
    INSERT INTO bankroll_snapshots (user_id, balance, snapshot_date)
    SELECT NEW.user_id, u.current_bankroll, CURRENT_DATE
    FROM users u
    WHERE u.id = NEW.user_id
    ON CONFLICT (user_id, snapshot_date)
    DO UPDATE SET balance = EXCLUDED.balance;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update bankroll
CREATE TRIGGER on_bet_settled
  AFTER UPDATE ON bets
  FOR EACH ROW EXECUTE FUNCTION update_bankroll_on_bet_settlement();
