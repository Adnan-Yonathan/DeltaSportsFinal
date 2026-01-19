-- Add bankroll column to users table for onboarding
-- This stores the user's betting bankroll entered during onboarding

ALTER TABLE users
ADD COLUMN IF NOT EXISTS bankroll DECIMAL(12, 2) DEFAULT NULL;

COMMENT ON COLUMN users.bankroll IS 'User betting bankroll entered during onboarding (in USD)';

-- Create index for bankroll queries
CREATE INDEX IF NOT EXISTS idx_users_bankroll ON users(bankroll) WHERE bankroll IS NOT NULL;
