-- Fix: log_income / log_expense / update_transaction / delete_transaction RPCs
-- were failing with "new row violates row-level security policy for table
-- transaction".
--
-- Root cause: 20260524000006_transaction.sql defined only `transaction_select`
-- (FOR SELECT). With FORCE ROW LEVEL SECURITY on, INSERT/UPDATE/DELETE need a
-- permissive policy too. The RPCs run as `budget_function_owner` (non-
-- superuser, on purpose so RLS still applies), so the missing WITH CHECK
-- branch caused every write to be denied. public.subscription's `FOR ALL`
-- policy is the correct pattern; this migration brings transaction in line.

DROP POLICY IF EXISTS transaction_select ON public.transaction;

CREATE POLICY transaction_household_isolation ON public.transaction
  FOR ALL
  TO public
  USING (household_id IN (SELECT * FROM public.auth_user_household_ids()))
  WITH CHECK (household_id IN (SELECT * FROM public.auth_user_household_ids()));
