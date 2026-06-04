-- Drops artifacts created by the prior `family-budget-app` migrations
-- (`0001_init.sql` through `0004_subscriptions.sql`). They produce the
-- public.* lint warnings reported by Supabase Advisors
-- (function_search_path_mutable, extension_in_public,
-- pg_graphql_anon_table_exposed, pg_graphql_authenticated_table_exposed) and
-- their `public.transaction` / `public.household` / etc. table names predate
-- the current schema; the active tables are `public.categories` and
-- `public.transactions` (plural), created by the 20260522000001/2 migrations
-- above and not touched by the drops below.
--
-- The original migrations remain in `supabase/migrations/` for history but no
-- longer have any runtime effect after this drop.

-- Tables first. CASCADE so we don't have to enumerate dependent FKs / triggers
-- / policies / sequences / RLS. IF EXISTS so re-running on a fresh DB (where
-- the legacy migrations no longer apply) is a no-op.
DROP TABLE IF EXISTS public.subscription CASCADE;
DROP TABLE IF EXISTS public.transaction CASCADE;
DROP TABLE IF EXISTS public.household_member CASCADE;
DROP TABLE IF EXISTS public.category CASCADE;
DROP TABLE IF EXISTS public.household CASCADE;

-- Functions next. CASCADE drops any remaining triggers / defaults referencing
-- them (defensive; all tables above are already dropped).
DROP FUNCTION IF EXISTS public.enforce_member_household() CASCADE;
DROP FUNCTION IF EXISTS public.forbid_undelete_of_adult_when_capped() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_adult_cap() CASCADE;
DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;

-- Extension installed in `public` by the legacy migrations. The Budget app does
-- not use citext.
DROP EXTENSION IF EXISTS citext;
