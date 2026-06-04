-- Categories: user-owned classifications for transactions.
-- See specs/001-setup-supabase/data-model.md § categories.

CREATE TABLE public.categories (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  kind          TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name)
);

CREATE INDEX categories_user_id_idx ON public.categories (user_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_owner ON public.categories
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.categories_id_seq TO authenticated;
