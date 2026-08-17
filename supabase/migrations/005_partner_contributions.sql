-- Migration 005: Partner contributions tracking
-- Tracks how much each partner has contributed to the bank balance

CREATE TABLE IF NOT EXISTS partner_contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID          NOT NULL REFERENCES users(id),
  amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  note         TEXT,
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by  UUID          NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_partner_contributions_partner_id ON partner_contributions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_contributions_contributed_at ON partner_contributions(contributed_at DESC);
