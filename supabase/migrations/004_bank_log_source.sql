-- Migration 004: Add source column to bank_balance_log
-- to distinguish manual cash injections from system-generated changes

ALTER TABLE bank_balance_log 
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'system';

-- source values:
--   'system'    = automated change from expense/cattle (default)
--   'injection' = manual cash added by user (PATCH /bank/balance)
--   'restore'   = balance restored from history (POST /bank/balance)

-- Backfill: existing rows are system changes
UPDATE bank_balance_log SET source = 'system' WHERE source = 'system';
