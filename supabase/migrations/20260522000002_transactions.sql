-- Transactions: user-owned monetary events, classified by exactly one Category.
-- See specs/001-setup-supabase/data-model.md § budget.transactions.

CREATE TABLE budget.transactions (
  id            BIGSERIAL PRIMARY KEY,
  amount        NUMERIC(14, 2) NOT NULL,
  occurred_on   DATE NOT NULL,
  note          TEXT CHECK (note IS NULL OR length(note) <= 500),
  category_id   BIGINT NOT NULL REFERENCES budget.categories(id) ON DELETE RESTRICT,
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_user_id_occurred_on_idx
  ON budget.transactions (user_id, occurred_on DESC);

CREATE INDEX transactions_category_id_idx
  ON budget.transactions (category_id);

-- FR-017: a transaction's category must belong to the same user. RLS alone
-- would block reads, but at write time the FK only checks existence — not
-- ownership. This trigger enforces ownership at the storage layer.
CREATE FUNCTION budget.assert_transaction_category_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  category_owner UUID;
BEGIN
  SELECT user_id INTO category_owner
  FROM budget.categories
  WHERE id = NEW.category_id;

  IF category_owner IS NULL THEN
    RAISE EXCEPTION 'category_id % does not exist', NEW.category_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF category_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'category_id % does not belong to user %',
      NEW.category_id, NEW.user_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_assert_category_owner
  BEFORE INSERT OR UPDATE OF category_id, user_id
  ON budget.transactions
  FOR EACH ROW
  EXECUTE FUNCTION budget.assert_transaction_category_owner();

ALTER TABLE budget.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_owner ON budget.transactions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON budget.transactions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE budget.transactions_id_seq TO authenticated;
