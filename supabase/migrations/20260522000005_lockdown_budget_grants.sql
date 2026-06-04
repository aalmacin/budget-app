-- Principle III enforcement at the grant layer.
--
-- Revokes all direct table grants from `authenticated` and `anon` on the
-- `public.categories` and `public.transactions` tables, so client-side
-- `supabase.from('categories').select()` (and equivalent insert/update/delete
-- paths) are rejected with `permission denied`. Future CRUD features MUST go
-- through SECURITY DEFINER Postgres functions called via `supabase.rpc()`.
--
-- FORCE ROW LEVEL SECURITY + `TO public` policies means RLS still filters
-- every row even when the RPC runs as `postgres` (the SECURITY DEFINER owner).
-- Without FORCE RLS, the table owner bypasses RLS entirely. Without the
-- `TO public` change, policies scoped `TO authenticated` do not apply to
-- `postgres`, so SECURITY DEFINER RPCs would be unfiltered.

---------------------------------------------------------------------------
-- public.categories
---------------------------------------------------------------------------
REVOKE ALL ON public.categories FROM authenticated, anon;
REVOKE ALL ON SEQUENCE public.categories_id_seq FROM authenticated, anon;

ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

DROP POLICY categories_owner ON public.categories;
CREATE POLICY categories_owner ON public.categories
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------------------
-- public.transactions
---------------------------------------------------------------------------
REVOKE ALL ON public.transactions FROM authenticated, anon;
REVOKE ALL ON SEQUENCE public.transactions_id_seq FROM authenticated, anon;

ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

DROP POLICY transactions_owner ON public.transactions;
CREATE POLICY transactions_owner ON public.transactions
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
