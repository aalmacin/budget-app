-- Principle III enforcement at the grant layer.
--
-- Revokes all direct table grants from `authenticated` and `anon` on the
-- `budget.*` tables, so client-side `supabase.from('categories').select()`
-- (and equivalent insert/update/delete paths) are rejected with
-- `permission denied`. Future CRUD features MUST go through SECURITY DEFINER
-- Postgres functions called via `supabase.rpc()`.
--
-- FORCE ROW LEVEL SECURITY + `TO public` policies means RLS still filters
-- every row even when the RPC runs as `postgres` (the SECURITY DEFINER owner).
-- Without FORCE RLS, the table owner bypasses RLS entirely. Without the
-- `TO public` change, policies scoped `TO authenticated` do not apply to
-- `postgres`, so SECURITY DEFINER RPCs would be unfiltered.
--
-- Closes Supabase Advisor lints `pg_graphql_authenticated_table_exposed` for
-- `budget.categories` and `budget.transactions`: with no SELECT grant for
-- `authenticated`, pg_graphql no longer exposes the tables in its introspected
-- schema for signed-in users.

---------------------------------------------------------------------------
-- budget.categories
---------------------------------------------------------------------------
REVOKE ALL ON budget.categories FROM authenticated, anon;
REVOKE ALL ON SEQUENCE budget.categories_id_seq FROM authenticated, anon;

ALTER TABLE budget.categories FORCE ROW LEVEL SECURITY;

DROP POLICY categories_owner ON budget.categories;
CREATE POLICY categories_owner ON budget.categories
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------------------
-- budget.transactions
---------------------------------------------------------------------------
REVOKE ALL ON budget.transactions FROM authenticated, anon;
REVOKE ALL ON SEQUENCE budget.transactions_id_seq FROM authenticated, anon;

ALTER TABLE budget.transactions FORCE ROW LEVEL SECURITY;

DROP POLICY transactions_owner ON budget.transactions;
CREATE POLICY transactions_owner ON budget.transactions
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
