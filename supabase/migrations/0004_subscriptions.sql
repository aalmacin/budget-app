-- 0004_subscriptions.sql — subscription table + cron schedule for auto-log.
-- Implements data-model.md §5 and contracts/subscriptions.md.

create table if not exists public.subscription (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.household(id) on delete cascade,
  merchant            text not null,
  amount_cents        bigint not null check (amount_cents > 0),
  category_id         uuid not null references public.category(id) on delete restrict,
  cadence             text not null check (cadence in ('weekly','biweekly','monthly','quarterly','yearly')),
  next_renewal_at     date not null,
  paid_by_member_id   uuid references public.household_member(id),
  for_member_id       uuid references public.household_member(id),
  essential_pct       smallint not null default 100 check (essential_pct between 0 and 100),
  split_rule          text check (split_rule in ('adult_a','adult_b','50_50','by_income')),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists subscription_household_renewal
  on public.subscription (household_id, next_renewal_at)
  where active = true;

create trigger subscription_set_updated_at
  before update on public.subscription
  for each row execute function public.update_timestamp();

alter table public.subscription enable row level security;

create policy subscription_household_isolation on public.subscription
  for all
  using (household_id in (select * from public.auth_user_household_ids()))
  with check (household_id in (select * from public.auth_user_household_ids()));

-- Hourly cron — meets SC-007 (95% within 24h) structurally.
-- Re-running the schedule is safe via the unique idempotency index on
-- (subscription_id, occurrence_date) on the transaction table (0003).
select cron.schedule(
  'subscriptions-hourly',
  '0 * * * *',
  $$ select public.materialize_due_subscriptions(); $$
);
