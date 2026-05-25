-- T059 — Phase 7 / US6: budget.category, household-scoped.
--
-- household_id IS NULL  -> system-global seed (read-only to everyone)
-- household_id IS NOT NULL -> per-household override (clone-on-write)
--
-- The clone-on-write happens at the RPC layer; this table only guarantees
-- that writes to system seeds are rejected by the write policy.

CREATE TABLE budget.category (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           UUID REFERENCES budget.household(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  default_essential_pct  SMALLINT NOT NULL DEFAULT 100 CHECK (default_essential_pct BETWEEN 0 AND 100),
  monthly_budget_cents   BIGINT CHECK (monthly_budget_cents IS NULL OR monthly_budget_cents >= 0),
  kind                   TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'income')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX category_household
  ON budget.category (household_id);

CREATE TRIGGER category_set_updated_at
  BEFORE UPDATE ON budget.category
  FOR EACH ROW EXECUTE FUNCTION budget.update_timestamp();

ALTER TABLE budget.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget.category FORCE ROW LEVEL SECURITY;

CREATE POLICY category_select_visible ON budget.category
  FOR SELECT
  TO public
  USING (
    household_id IS NULL
    OR household_id IN (SELECT * FROM budget.auth_user_household_ids())
  );

CREATE POLICY category_write_own_household ON budget.category
  FOR ALL
  TO public
  USING (household_id IN (SELECT * FROM budget.auth_user_household_ids()))
  WITH CHECK (household_id IN (SELECT * FROM budget.auth_user_household_ids()));

-- System-global seed categories (data-model.md §Phase 7 entities).
INSERT INTO budget.category (household_id, name, default_essential_pct, kind) VALUES
  (NULL, 'Groceries',     80,  'expense'),
  (NULL, 'Utilities',     100, 'expense'),
  (NULL, 'Transport',     70,  'expense'),
  (NULL, 'Kids',          90,  'expense'),
  (NULL, 'Health',        100, 'expense'),
  (NULL, 'Subscriptions', 40,  'expense'),
  (NULL, 'Eating Out',    20,  'expense'),
  (NULL, 'Entertainment', 0,   'expense'),
  (NULL, 'Rogers',        100, 'expense'),
  (NULL, 'Bell',          100, 'expense'),
  (NULL, 'RESP',          100, 'expense'),
  (NULL, 'TFSA',          100, 'expense'),
  (NULL, 'Income',        0,   'income');
