-- 0002_household.sql — household + household_member tables, RLS, triggers.
-- Implements data-model.md sections 1-2 and the contracts in
-- contracts/household.md. Required for US1 (sign-in + onboarding).

-- ---------------------------------------------------------------------------
-- household
-- ---------------------------------------------------------------------------
create table if not exists public.household (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  currency      text not null default 'CAD',
  owner_user_id uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger household_set_updated_at
  before update on public.household
  for each row execute function public.update_timestamp();

alter table public.household enable row level security;

-- A household row is visible to every active member of that household.
create policy household_household_isolation on public.household
  for all
  using (id in (select * from public.auth_user_household_ids()))
  with check (id in (select * from public.auth_user_household_ids()));


-- ---------------------------------------------------------------------------
-- household_member
-- ---------------------------------------------------------------------------
create table if not exists public.household_member (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references public.household(id) on delete cascade,
  user_id              uuid references auth.users(id),
  role                 text not null check (role in ('adult','kid')),
  display_name         text not null,
  age_years            smallint check (age_years between 0 and 25),
  avatar_url           text,
  monthly_income_cents bigint not null default 0 check (monthly_income_cents >= 0),
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Kids must have an age; adults must not.
  constraint household_member_age_for_kid_only
    check ((role = 'kid' and age_years is not null)
        or (role = 'adult' and age_years is null))
);

-- Each auth user appears at most once per household (active or soft-deleted).
create unique index if not exists household_member_user_per_household
  on public.household_member (household_id, user_id)
  where user_id is not null;

create index if not exists household_member_household_active
  on public.household_member (household_id)
  where deleted_at is null;

create trigger household_member_set_updated_at
  before update on public.household_member
  for each row execute function public.update_timestamp();

alter table public.household_member enable row level security;

-- Read/update isolation by household. Soft-deleted rows remain readable so
-- historical reports can resolve display names (data-model.md §2).
create policy household_member_household_isolation on public.household_member
  for all
  using (household_id in (select * from public.auth_user_household_ids()))
  with check (household_id in (select * from public.auth_user_household_ids()));


-- ---------------------------------------------------------------------------
-- enforce_adult_cap(): at most 2 active adults per household.
-- Counts only rows with role='adult' AND deleted_at IS NULL.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_adult_cap()
returns trigger
language plpgsql
as $$
declare
  v_active_adults int;
begin
  if new.role <> 'adult' then
    return new;
  end if;
  if new.deleted_at is not null then
    return new;
  end if;

  select count(*) into v_active_adults
  from public.household_member
  where household_id = new.household_id
    and role = 'adult'
    and deleted_at is null
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_active_adults >= 2 then
    raise exception 'Households are limited to 2 adults' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger household_member_enforce_adult_cap
  before insert or update on public.household_member
  for each row execute function public.enforce_adult_cap();


-- ---------------------------------------------------------------------------
-- forbid_undelete_of_adult_when_capped(): prevent flipping deleted_at from
-- non-null to null on an adult if it would breach the 2-adult cap.
-- ---------------------------------------------------------------------------
create or replace function public.forbid_undelete_of_adult_when_capped()
returns trigger
language plpgsql
as $$
declare
  v_active_adults int;
begin
  if new.role <> 'adult' then
    return new;
  end if;
  if old.deleted_at is null or new.deleted_at is not null then
    return new;  -- only act on null→non-null reversal
  end if;

  select count(*) into v_active_adults
  from public.household_member
  where household_id = new.household_id
    and role = 'adult'
    and deleted_at is null
    and id <> new.id;

  if v_active_adults >= 2 then
    raise exception 'Cannot restore adult: household already has 2 active adults' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger household_member_forbid_undelete_capped
  before update of deleted_at on public.household_member
  for each row execute function public.forbid_undelete_of_adult_when_capped();
