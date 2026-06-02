-- Migration 003: Add is_animal_cost flag to expenses
-- When TRUE (default): expense is included in animal cost calculation
-- When FALSE: expense is a farm-only cost, excluded from per-animal cost

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_animal_cost BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_expenses_is_animal_cost ON expenses(is_animal_cost);
