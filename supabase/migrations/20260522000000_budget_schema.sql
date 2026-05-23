-- Create the dedicated schema for this app.
-- The Budget app currently runs against a local Supabase stack only; a
-- dedicated paid cloud Supabase project is a later feature (see
-- specs/001-setup-supabase/research.md § R9). All tables, functions, and
-- policies for this app live under `budget` so the same migrations apply
-- unchanged when the dedicated cloud project arrives.

CREATE SCHEMA IF NOT EXISTS budget;

GRANT USAGE ON SCHEMA budget TO anon, authenticated;

-- Default privileges on future tables/sequences/functions in this schema, so
-- subsequent migrations do not need to re-grant per object.
ALTER DEFAULT PRIVILEGES IN SCHEMA budget
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA budget
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA budget
  GRANT EXECUTE ON FUNCTIONS TO authenticated;
