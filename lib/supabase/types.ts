export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          starting_bankroll: number
          current_bankroll: number
          subscription_tier: 'free' | 'pro' | 'unlimited' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          starting_bankroll?: number
          current_bankroll?: number
          subscription_tier?: 'free' | 'pro' | 'unlimited' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          starting_bankroll?: number
          current_bankroll?: number
          subscription_tier?: 'free' | 'pro' | 'unlimited' | null
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
      }
      bets: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          sport: string
          league: string
          game_description: string
          bet_type: string
          bet_side: string
          odds: number
          stake: number
          potential_win: number
          actual_result: number | null
          book: string
          status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled'
          placed_at: string
          settled_at: string | null
          game_time: string | null
          closing_odds: number | null
          notes: string | null
          created_at: string
          is_prop: boolean | null
          player_name: string | null
          prop_market: string | null
          prop_line: number | null
          prop_selection: string | null
          prop_team: string | null
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id?: string | null
          sport: string
          league: string
          game_description: string
          bet_type: string
          bet_side: string
          odds: number
          stake: number
          potential_win: number
          actual_result?: number | null
          book: string
          status?: 'pending' | 'won' | 'lost' | 'push' | 'cancelled'
          placed_at?: string
          settled_at?: string | null
          game_time?: string | null
          closing_odds?: number | null
          notes?: string | null
          created_at?: string
          is_prop?: boolean | null
          player_name?: string | null
          prop_market?: string | null
          prop_line?: number | null
          prop_selection?: string | null
          prop_team?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string | null
          sport?: string
          league?: string
          game_description?: string
          bet_type?: string
          bet_side?: string
          odds?: number
          stake?: number
          potential_win?: number
          actual_result?: number | null
          book?: string
          status?: 'pending' | 'won' | 'lost' | 'push' | 'cancelled'
          placed_at?: string
          settled_at?: string | null
          game_time?: string | null
          closing_odds?: number | null
          notes?: string | null
          created_at?: string
          is_prop?: boolean | null
          player_name?: string | null
          prop_market?: string | null
          prop_line?: number | null
          prop_selection?: string | null
          prop_team?: string | null
        }
      }
      bankroll_snapshots: {
        Row: {
          id: string
          user_id: string
          balance: number
          snapshot_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance: number
          snapshot_date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          snapshot_date?: string
          created_at?: string
        }
      }
      custom_models: {
        Row: {
          id: string
          user_id: string
          model_name: string
          sport_key: string
          market_type: string
          target_metric: string
          confidence_level: number
          config: Json
          notes: string | null
          model_type?: string
          research_config?: Json
          description?: string | null
          instructions?: string | null
          file_metadata?: Json
          created_at: string
          updated_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          model_name: string
          sport_key: string
          market_type: string
          target_metric: string
          confidence_level?: number
          config: Json
          notes?: string | null
          model_type?: string
          research_config?: Json
          description?: string | null
          instructions?: string | null
          file_metadata?: Json
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          model_name?: string
          sport_key?: string
          market_type?: string
          target_metric?: string
          confidence_level?: number
          config?: Json
          notes?: string | null
          model_type?: string
          research_config?: Json
          description?: string | null
          instructions?: string | null
          file_metadata?: Json
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
        }
      }
      model_files: {
        Row: {
          id: string
          model_id: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          storage_path: string
          parsed_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          model_id: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          storage_path: string
          parsed_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          model_id?: string
          user_id?: string
          file_name?: string
          file_type?: string
          file_size?: number
          storage_path?: string
          parsed_data?: Json | null
          created_at?: string
        }
      }
      injury_reports: {
        Row: {
          id: string
          sport_key: string
          team_name: string
          player_name: string
          status: string
          description: string | null
          source: string | null
          source_updated_at: string | null
          captured_at: string
        }
        Insert: {
          id?: string
          sport_key: string
          team_name: string
          player_name: string
          status: string
          description?: string | null
          source?: string | null
          source_updated_at?: string | null
          captured_at?: string
        }
        Update: {
          id?: string
          sport_key?: string
          team_name?: string
          player_name?: string
          status?: string
          description?: string | null
          source?: string | null
          source_updated_at?: string | null
          captured_at?: string
        }
      }
      team_recent_form: {
        Row: {
          id: string
          sport_key: string
          team_name: string
          game_date: string
          opponent: string
          is_home: boolean
          result: string | null
          points_for: number | null
          points_against: number | null
          pace: number | null
          offensive_rating: number | null
          defensive_rating: number | null
          net_rating: number | null
          captured_at: string
        }
        Insert: {
          id?: string
          sport_key: string
          team_name: string
          game_date: string
          opponent: string
          is_home: boolean
          result?: string | null
          points_for?: number | null
          points_against?: number | null
          pace?: number | null
          offensive_rating?: number | null
          defensive_rating?: number | null
          net_rating?: number | null
          captured_at?: string
        }
        Update: {
          id?: string
          sport_key?: string
          team_name?: string
          game_date?: string
          opponent?: string
          is_home?: boolean
          result?: string | null
          points_for?: number | null
          points_against?: number | null
          pace?: number | null
          offensive_rating?: number | null
          defensive_rating?: number | null
          net_rating?: number | null
          captured_at?: string
        }
      }
      team_splits: {
        Row: {
          id: string
          sport_key: string
          team_name: string
          context: string
          games_played: number | null
          win_pct: number | null
          points_for: number | null
          points_against: number | null
          offensive_rating: number | null
          defensive_rating: number | null
          net_rating: number | null
          captured_at: string
        }
        Insert: {
          id?: string
          sport_key: string
          team_name: string
          context: string
          games_played?: number | null
          win_pct?: number | null
          points_for?: number | null
          points_against?: number | null
          offensive_rating?: number | null
          defensive_rating?: number | null
          net_rating?: number | null
          captured_at?: string
        }
        Update: {
          id?: string
          sport_key?: string
          team_name?: string
          context?: string
          games_played?: number | null
          win_pct?: number | null
          points_for?: number | null
          points_against?: number | null
          offensive_rating?: number | null
          defensive_rating?: number | null
          net_rating?: number | null
          captured_at?: string
        }
      }
      team_stats: {
        Row: {
          id: string
          sport_key: string
          league: string | null
          team_name: string
          season: string | null
          wins: number | null
          losses: number | null
          home_record: string | null
          away_record: string | null
          ats_record: string | null
          over_under_record: string | null
          points_per_game: number | null
          points_allowed_per_game: number | null
          pace: number | null
          offensive_rating: number | null
          defensive_rating: number | null
          net_rating: number | null
          recent_streak: string | null
          trend_tags: string[] | null
          provider_team_id: string | null
          captured_at: string
        }
        Insert: {
          id?: string
          sport_key: string
          league?: string | null
          team_name: string
          season?: string | null
          wins?: number | null
          losses?: number | null
          home_record?: string | null
          away_record?: string | null
          ats_record?: string | null
          over_under_record?: string | null
          points_per_game?: number | null
          points_allowed_per_game?: number | null
          pace?: number | null
          offensive_rating?: number | null
          defensive_rating?: number | null
          net_rating?: number | null
          recent_streak?: string | null
          trend_tags?: string[] | null
          provider_team_id?: string | null
          captured_at?: string
        }
        Update: {
          id?: string
          sport_key?: string
          league?: string | null
          team_name?: string
          season?: string | null
          wins?: number | null
          losses?: number | null
          home_record?: string | null
          away_record?: string | null
          ats_record?: string | null
          over_under_record?: string | null
          points_per_game?: number | null
          points_allowed_per_game?: number | null
          pace?: number | null
          offensive_rating?: number | null
          defensive_rating?: number | null
          net_rating?: number | null
          recent_streak?: string | null
          trend_tags?: string[] | null
          provider_team_id?: string | null
          captured_at?: string
        }
      }
      team_trends: {
        Row: {
          id: string
          sport_key: string
          league: string | null
          team_name: string
          trend_type: string
          trend_window: string | null
          trend_summary: string
          metrics: Json | null
          provider_team_id: string | null
          captured_at: string
        }
        Insert: {
          id?: string
          sport_key: string
          league?: string | null
          team_name: string
          trend_type: string
          trend_window?: string | null
          trend_summary: string
          metrics?: Json | null
          provider_team_id?: string | null
          captured_at?: string
        }
        Update: {
          id?: string
          sport_key?: string
          league?: string | null
          team_name?: string
          trend_type?: string
          trend_window?: string | null
          trend_summary?: string
          metrics?: Json | null
          provider_team_id?: string | null
          captured_at?: string
        }
      }
      head_to_head_results: {
        Row: {
          id: string
          sport_key: string
          team_one: string
          team_two: string
          matchup_date: string
          winner: string | null
          pace: number | null
          notes: string | null
          captured_at: string
        }
        Insert: {
          id?: string
          sport_key: string
          team_one: string
          team_two: string
          matchup_date: string
          winner?: string | null
          pace?: number | null
          notes?: string | null
          captured_at?: string
        }
        Update: {
          id?: string
          sport_key?: string
          team_one?: string
          team_two?: string
          matchup_date?: string
          winner?: string | null
          pace?: number | null
          notes?: string | null
          captured_at?: string
        }
      }
      market_snapshots: {
        Row: {
          id: string
          sport_key: string
          game_id: string
          game_description: string
          captured_at: string
          spread_home_line: number | null
          spread_home_odds: number | null
          spread_home_book: string | null
          spread_away_line: number | null
          spread_away_odds: number | null
          spread_away_book: string | null
          moneyline_home: number | null
          moneyline_home_book: string | null
          moneyline_away: number | null
          moneyline_away_book: string | null
          total_line: number | null
          total_over_odds: number | null
          total_over_book: string | null
          total_under_odds: number | null
          total_under_book: string | null
        }
        Insert: {
          id?: string
          sport_key: string
          game_id: string
          game_description: string
          captured_at?: string
          spread_home_line?: number | null
          spread_home_odds?: number | null
          spread_home_book?: string | null
          spread_away_line?: number | null
          spread_away_odds?: number | null
          spread_away_book?: string | null
          moneyline_home?: number | null
          moneyline_home_book?: string | null
          moneyline_away?: number | null
          moneyline_away_book?: string | null
          total_line?: number | null
          total_over_odds?: number | null
          total_over_book?: string | null
          total_under_odds?: number | null
          total_under_book?: string | null
        }
        Update: {
          id?: string
          sport_key?: string
          game_id?: string
          game_description?: string
          captured_at?: string
          spread_home_line?: number | null
          spread_home_odds?: number | null
          spread_home_book?: string | null
          spread_away_line?: number | null
          spread_away_odds?: number | null
          spread_away_book?: string | null
          moneyline_home?: number | null
          moneyline_home_book?: string | null
          moneyline_away?: number | null
          moneyline_away_book?: string | null
          total_line?: number | null
          total_over_odds?: number | null
          total_over_book?: string | null
          total_under_odds?: number | null
          total_under_book?: string | null
        }
      }
      player_prop_snapshots: {
        Row: {
          id: string
          sport_key: string
          event_id: string
          player_name: string
          team_name: string | null
          market_key: string
          line: number | null
          over_odds: number | null
          under_odds: number | null
          book: string
          captured_at: string
        }
        Insert: {
          id?: string
          sport_key: string
          event_id: string
          player_name: string
          team_name?: string | null
          market_key: string
          line?: number | null
          over_odds?: number | null
          under_odds?: number | null
          book: string
          captured_at?: string
        }
        Update: {
          id?: string
          sport_key?: string
          event_id?: string
          player_name?: string
          team_name?: string | null
          market_key?: string
          line?: number | null
          over_odds?: number | null
          under_odds?: number | null
          book?: string
          captured_at?: string
        }
      }
    }
  }
}

// Type aliases for model_files
export type ModelFileRow = Database['public']['Tables']['model_files']['Row']
export type ModelFileInsert = Database['public']['Tables']['model_files']['Insert']
export type ModelFileUpdate = Database['public']['Tables']['model_files']['Update']
