-- Categories: user-owned classifications for transactions.
-- See specs/001-setup-supabase/data-model.md § budget.categories.

CREATE TABLE budget.categories (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  kind          TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name)
);

CREATE INDEX categories_user_id_idx ON budget.categories (user_id);

ALTER TABLE budget.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_owner ON budget.categories
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicit grants in addition to the default privileges set in 20260522000000,
-- so this migration is self-contained when reviewed in isolation.
GRANT SELECT, INSERT, UPDATE, DELETE ON budget.categories TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE budget.categories_id_seq TO authenticated;
