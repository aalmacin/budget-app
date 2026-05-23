-- 0003_transactions.sql — category + transaction tables, indexes, RLS,
-- deferred household-match trigger, seed system-global categories.

-- ---------------------------------------------------------------------------
-- category
--   household_id IS NULL  -> system-global seed (read-only to everyone)
--   household_id IS NOT NULL -> per-household override (clone-on-write)
-- ---------------------------------------------------------------------------
create table if not exists public.category (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid references public.household(id) on delete cascade,
  name                   text not null,
  default_essential_pct  smallint not null default 100 check (default_essential_pct between 0 and 100),
  monthly_budget_cents   bigint check (monthly_budget_cents is null or monthly_budget_cents >= 0),
  kind                   text not null default 'expense' check (kind in ('expense','income')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists category_household
  on public.category (household_id);

create trigger category_set_updated_at
  before update on public.category
  for each row execute function public.update_timestamp();

alter table public.category enable row level security;

create policy category_select_visible on public.category
  for select
  using (
    household_id is null
    or household_id in (select * from public.auth_user_household_ids())
  );

create policy category_write_own_household on public.category
  for all
  using (household_id in (select * from public.auth_user_household_ids()))
  with check (household_id in (select * from public.auth_user_household_ids()));

-- System-global seed categories (data-model.md §3).
insert into public.category (household_id, name, default_essential_pct, kind) values
  (null, 'Groceries',     80,  'expense'),
  (null, 'Utilities',     100, 'expense'),
  (null, 'Transport',     70,  'expense'),
  (null, 'Kids',          90,  'expense'),
  (null, 'Health',        100, 'expense'),
  (null, 'Subscriptions', 40,  'expense'),
  (null, 'Eating Out',    20,  'expense'),
  (null, 'Entertainment', 0,   'expense'),
  (null, 'Rogers',        100, 'expense'),
  (null, 'Bell',          100, 'expense'),
  (null, 'RESP',          100, 'expense'),
  (null, 'TFSA',          100, 'expense'),
  (null, 'Income',        0,   'income')
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- transaction
-- ---------------------------------------------------------------------------
create table if not exists public.transaction (
  id                  uuid primary key,  -- client-supplied UUID v7 for offline-replay idempotency
  household_id        uuid not null references public.household(id) on delete cascade,
  type                text not null check (type in ('expense','income')),
  amount_cents        bigint not null check (amount_cents > 0),
  occurred_on         date not null,
  category_id         uuid not null references public.category(id) on delete restrict,
  notes               text not null default '',
  paid_by_member_id   uuid references public.household_member(id),
  for_member_id       uuid references public.household_member(id),
  essential_pct       smallint not null default 100 check (essential_pct between 0 and 100),
  split_rule          text check (split_rule in ('adult_a','adult_b','50_50','by_income')),
  income_source       text check (income_source in ('Salary','Contract','Self_employed','Benefit','Refund','Gift')),
  subscription_id     uuid,
  occurrence_date     date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists transaction_household_occurred
  on public.transaction (household_id, occurred_on desc);

create index if not exists transaction_household_category_occurred
  on public.transaction (household_id, category_id, occurred_on);

create unique index if not exists transaction_subscription_idempotency
  on public.transaction (subscription_id, occurrence_date)
  where subscription_id is not null and occurrence_date is not null;

create index if not exists transaction_notes_search
  on public.transaction using gin (to_tsvector('simple', notes));

create trigger transaction_set_updated_at
  before update on public.transaction
  for each row execute function public.update_timestamp();

alter table public.transaction enable row level security;

-- Read-only RLS via household isolation. Writes go through RPCs (security
-- definer / invoker), so we deliberately do NOT grant INSERT/UPDATE/DELETE
-- to authenticated callers — only SELECT.
create policy transaction_select on public.transaction
  for select
  using (household_id in (select * from public.auth_user_household_ids()));

revoke insert, update, delete on public.transaction from authenticated;


-- ---------------------------------------------------------------------------
-- enforce_member_household(): deferred trigger ensuring for_member_id and
-- paid_by_member_id belong to the same household as the transaction. Soft-
-- delete state is NOT checked here (historical attribution must survive).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_member_household()
returns trigger
language plpgsql
as $$
begin
  if new.for_member_id is not null then
    if not exists (
      select 1 from public.household_member
      where id = new.for_member_id and household_id = new.household_id
    ) then
      raise exception 'for_member_id does not belong to this household' using errcode = 'P0001';
    end if;
  end if;
  if new.paid_by_member_id is not null then
    if not exists (
      select 1 from public.household_member
      where id = new.paid_by_member_id and household_id = new.household_id
    ) then
      raise exception 'paid_by_member_id does not belong to this household' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create constraint trigger transaction_member_household
  after insert or update of household_id, for_member_id, paid_by_member_id
  on public.transaction
  deferrable initially deferred
  for each row execute function public.enforce_member_household();
