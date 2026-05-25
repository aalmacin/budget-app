-- T089 — Phase 7 / US7: hourly cron to materialize due subscriptions.
--
-- pg_cron lives in the `extensions` schema (Supabase convention) so the
-- `extension_in_public` advisor lint that T044 closed stays closed.
--
-- The cron job calls budget.materialize_due_subscriptions(true) so it can
-- process every household in one pass — true is the only place that flag
-- is allowed (the function still runs as budget_function_owner, but
-- row_security is disabled inside that branch).

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'subscriptions-hourly',
  '0 * * * *',
  $$ SELECT budget.materialize_due_subscriptions(true); $$
);
