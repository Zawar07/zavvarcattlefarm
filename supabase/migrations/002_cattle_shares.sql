-- Migration 002: Add cattle_shares table for partner share tracking on cattle transactions

CREATE TABLE IF NOT EXISTS cattle_shares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id    UUID          NOT NULL REFERENCES cattle(id) ON DELETE CASCADE,
  partner_id   UUID          NOT NULL REFERENCES users(id),
  share_amount NUMERIC(15,2) NOT NULL,
  entry_type   VARCHAR(20)   NOT NULL CHECK (entry_type IN ('purchase', 'sale')),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (cattle_id, partner_id, entry_type)
);

CREATE INDEX IF NOT EXISTS idx_cattle_shares_partner_id ON cattle_shares(partner_id);
CREATE INDEX IF NOT EXISTS idx_cattle_shares_cattle_id ON cattle_shares(cattle_id);
