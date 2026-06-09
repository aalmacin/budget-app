-- 2026-06-06: prep for 20260606000020_inline_recurring_subscriptions.
-- That migration changes the return signature of three subscription read RPCs
-- by adding `type` and `income_source` columns. Postgres CREATE OR REPLACE
-- FUNCTION cannot change a function's return type (SQLSTATE 42P13), so the
-- old definitions must be dropped before the new ones are created.
--
-- This migration is a no-op on databases where these functions never existed
-- (DROP ... IF EXISTS), so it is safe to apply to any cloud or local state.

DROP FUNCTION IF EXISTS public.list_due_subscriptions();
DROP FUNCTION IF EXISTS public.list_upcoming_subscriptions();
DROP FUNCTION IF EXISTS public.get_subscription_prefill(UUID);
