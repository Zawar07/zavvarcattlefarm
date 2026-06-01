-- ZCF full schema for Supabase PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  phone_number  VARCHAR(15)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('super_admin', 'partner')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_activity TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  invalidated   BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

CREATE TABLE IF NOT EXISTS bank_balance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount     NUMERIC(15,2) NOT NULL,
  updated_by UUID          NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_balance_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  previous_amount NUMERIC(15,2) NOT NULL,
  new_amount      NUMERIC(15,2) NOT NULL,
  changed_by      UUID          NOT NULL REFERENCES users(id),
  changed_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_balance_log_changed_at ON bank_balance_log(changed_at DESC);

CREATE TABLE IF NOT EXISTS expense_categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expenses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount             NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  category_id        INTEGER       NOT NULL REFERENCES expense_categories(id),
  sub_category       VARCHAR(200)  NOT NULL,
  description        TEXT,
  expense_date       DATE          NOT NULL,
  receipt_image_path VARCHAR(500),
  recorded_by        UUID          NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS partner_shares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  partner_id   UUID          NOT NULL REFERENCES users(id),
  share_amount NUMERIC(15,2) NOT NULL,
  UNIQUE (expense_id, partner_id)
);

CREATE TABLE IF NOT EXISTS partner_settlements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID          NOT NULL REFERENCES users(id),
  amount_settled NUMERIC(15,2) NOT NULL,
  settled_by     UUID          NOT NULL REFERENCES users(id),
  settled_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON expenses(recorded_by);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_partner_shares_partner_id ON partner_shares(partner_id);

CREATE TABLE IF NOT EXISTS cattle (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_type    VARCHAR(20)   NOT NULL CHECK (animal_type IN ('bull', 'cow', 'goat', 'sheep', 'chicken')),
  purchase_price NUMERIC(15,2) NOT NULL CHECK (purchase_price > 0),
  purchase_date  DATE          NOT NULL,
  description    TEXT,
  sale_price     NUMERIC(15,2) CHECK (sale_price > 0),
  sale_date      DATE,
  is_sold        BOOLEAN       NOT NULL DEFAULT FALSE,
  image_url      TEXT,
  recorded_by    UUID          NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cattle_animal_type ON cattle(animal_type);
CREATE INDEX IF NOT EXISTS idx_cattle_is_sold ON cattle(is_sold);
CREATE INDEX IF NOT EXISTS idx_cattle_purchase_date ON cattle(purchase_date DESC);

CREATE TABLE IF NOT EXISTS employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100)  NOT NULL,
  base_salary NUMERIC(15,2) NOT NULL CHECK (base_salary >= 0),
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID          NOT NULL REFERENCES employees(id),
  category     VARCHAR(20)   NOT NULL CHECK (category IN ('food', 'transport', 'other')),
  amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  expense_date DATE          NOT NULL,
  description  TEXT,
  recorded_by  UUID          NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payroll_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID          NOT NULL REFERENCES employees(id),
  month          DATE          NOT NULL,
  base_salary    NUMERIC(15,2) NOT NULL,
  total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost     NUMERIC(15,2) NOT NULL,
  processed_by   UUID          NOT NULL REFERENCES users(id),
  processed_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_employee_expenses_employee_id ON employee_expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_expenses_expense_date ON employee_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_month ON payroll_records(employee_id, month);

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id),
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  performed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
