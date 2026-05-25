-- Add type column to factures table (simple / optique)
ALTER TABLE factures ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'simple'
  CHECK (type IN ('simple', 'optique'));
