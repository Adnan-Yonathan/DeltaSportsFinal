-- Onboarding Migration
-- Add new fields to users table for onboarding flow

-- Add new columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS favorite_sports TEXT[],
ADD COLUMN IF NOT EXISTS preferred_markets TEXT[],
ADD COLUMN IF NOT EXISTS experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'professional')),
ADD COLUMN IF NOT EXISTS risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
ADD COLUMN IF NOT EXISTS signup_reasons TEXT[],
ADD COLUMN IF NOT EXISTS subscription_tier TEXT CHECK (subscription_tier IN ('pro', 'sharp', 'syndicate') OR subscription_tier IS NULL),
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create index for onboarding_completed
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);

COMMENT ON COLUMN users.username IS 'Unique username chosen during onboarding';
COMMENT ON COLUMN users.favorite_sports IS 'Array of favorite sports selected during onboarding';
COMMENT ON COLUMN users.preferred_markets IS 'Array of preferred betting markets selected during onboarding';
COMMENT ON COLUMN users.experience_level IS 'Betting experience level (beginner, intermediate, advanced, professional)';
COMMENT ON COLUMN users.risk_tolerance IS 'Risk tolerance level (conservative, moderate, aggressive)';
COMMENT ON COLUMN users.signup_reasons IS 'Array of goals selected during onboarding';
COMMENT ON COLUMN users.subscription_tier IS 'Selected subscription tier (pro, sharp, syndicate, or null for free)';
COMMENT ON COLUMN users.onboarding_completed IS 'Whether user has completed the onboarding flow';
