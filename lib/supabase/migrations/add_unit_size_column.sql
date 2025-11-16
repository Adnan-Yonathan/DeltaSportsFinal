-- Add unit_size column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_size DECIMAL(10,2) DEFAULT 20.00;

-- Add comment explaining the column
COMMENT ON COLUMN users.unit_size IS 'Standard betting unit size in dollars for this user';
