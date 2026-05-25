-- T055 — Phase 7 foundation: shared trigger function + non-superuser
-- function-owner role.
--
-- The role exists because SECURITY DEFINER functions owned by `postgres`
-- (a superuser) bypass RLS regardless of FORCE ROW LEVEL SECURITY. The
-- Phase 7 RPCs are owned by `budget_function_owner` so RLS still applies.
-- See research.md R10 ("Validation gap acknowledged") and R14.

CREATE OR REPLACE FUNCTION budget.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'budget_function_owner') THEN
    CREATE ROLE budget_function_owner NOLOGIN;
  END IF;
END
$$;

-- USAGE lets the role resolve `budget.<name>`; CREATE is required so the role
-- can "own" objects in the schema (ALTER FUNCTION ... OWNER TO checks that
-- the new owner has CREATE on the containing schema).
GRANT USAGE, CREATE ON SCHEMA budget TO budget_function_owner;

-- Subsequent migrations do `ALTER FUNCTION ... OWNER TO budget_function_owner`.
-- PostgreSQL rejects that with `42501 must be able to SET ROLE` unless the
-- current role is a member of the target role — even superusers like `postgres`
-- are subject to this specific check. Granting the role to postgres unblocks
-- every later RPC migration; it does NOT grant any new privilege to postgres
-- beyond what it already has (postgres is a superuser).
GRANT budget_function_owner TO postgres;

-- Every household-scoped RPC is SECURITY DEFINER and calls auth.uid() to
-- resolve the caller. auth.uid() is SECURITY INVOKER, so the effective role
-- at that call site — budget_function_owner — needs USAGE on the auth schema
-- and EXECUTE on auth.uid(). In local Supabase, `postgres` lacks GRANT OPTION
-- on auth-owned objects, so direct `GRANT USAGE ON SCHEMA auth TO
-- budget_function_owner` silently no-ops (warning 01007). Granting role
-- membership in `authenticated` instead makes budget_function_owner inherit
-- the auth schema USAGE + auth.uid() EXECUTE that Supabase already wires up
-- for that role. All household-scoped RLS policies are `TO public`, so this
-- inheritance does not change any policy's targeting.
GRANT authenticated TO budget_function_owner;
