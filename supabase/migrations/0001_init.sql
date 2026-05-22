-- 0001_init.sql — extensions, shared helpers, update_timestamp trigger.
-- Idempotent: safe to apply multiple times.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- update_timestamp(): trigger function used by every table to maintain
-- updated_at on row mutation.
-- ---------------------------------------------------------------------------
create or replace function public.update_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- auth_user_household_ids(): the set of household ids the calling auth.uid()
-- belongs to as an ACTIVE (non-soft-deleted) member.
--
-- Every household-scoped RLS policy reads from this helper instead of inlining
-- the join, so a future change to the membership model is one edit.
--
-- Marked `stable` because it's deterministic within a single statement and
-- safe to memoize per-statement.
-- ---------------------------------------------------------------------------
create or replace function public.auth_user_household_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select hm.household_id
  from public.household_member hm
  where hm.user_id = auth.uid()
    and hm.deleted_at is null;
$$;

comment on function public.auth_user_household_ids() is
  'Returns the household_ids the current auth user actively belongs to. Used by RLS policies.';
