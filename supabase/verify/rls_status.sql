-- Run this in the Supabase SQL editor (or psql) to spot-check the budget
-- schema's isolation posture. See specs/001-setup-supabase/quickstart.md
-- "Verify the success criteria" → US2.

-- Both tables must live in the budget schema with RLS enabled.
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'budget'
  AND tablename IN ('categories', 'transactions')
ORDER BY tablename;
-- Expected: 2 rows; rowsecurity = true on both.

-- Owner policies must exist for both tables.
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE schemaname = 'budget'
ORDER BY tablename, policyname;
-- Expected: categories_owner / categories, transactions_owner / transactions; cmd = ALL.

-- FR-013: no Budget tables leaked into the shared public schema.
SELECT count(*) AS leaked_tables
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('categories', 'transactions');
-- Expected: 0.
