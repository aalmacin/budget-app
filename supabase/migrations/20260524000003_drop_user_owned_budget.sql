-- T058 — Phase 7 prerequisite: drop the Phase 4 user-owned tables.
--
-- Phase 4 (T020/T021) shipped public.categories and public.transactions as
-- user-owned (auth.uid() = user_id). Phase 7 reintroduces them as
-- household-scoped with the legacy column set (see 20260524000004 and
-- 20260524000006). Safe because Phase 4 shipped without any UI for these
-- tables — the only writers are the Phase 7 RPCs that don't exist yet.
--
-- If a future environment has accumulated real data when this migration
-- ships there, replace this drop with a multi-step backfill (research.md
-- R13 documents the trade-off).

DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP FUNCTION IF EXISTS public.assert_transaction_category_owner() CASCADE;
