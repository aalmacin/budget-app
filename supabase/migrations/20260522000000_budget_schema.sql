-- Create the dedicated schema for this app.
-- The Supabase instance is shared with other applications (project memory: see
-- specs/001-setup-supabase/spec.md FR-013). All tables, functions, and policies
-- for the Budget app live under `budget` and never leak into `public`.

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
