-- T062 — Phase 7 / US7: public.subscription.
--
-- The pg_cron schedule that materializes due subscriptions lives in its own
-- migration (20260524000014, T089) to keep extension installation isolated
-- from table DDL.

CREATE TABLE public.subscription (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  merchant            TEXT NOT NULL CHECK (length(merchant) BETWEEN 1 AND 100),
  amount_cents        BIGINT NOT NULL CHECK (amount_cents > 0),
  category_id         UUID NOT NULL REFERENCES public.category(id) ON DELETE RESTRICT,
  cadence             TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_renewal_at     DATE NOT NULL,
  paid_by_member_id   UUID REFERENCES public.household_member(id),
  for_member_id       UUID REFERENCES public.household_member(id),
  essential_pct       SMALLINT NOT NULL DEFAULT 100 CHECK (essential_pct BETWEEN 0 AND 100),
  split_rule          TEXT CHECK (split_rule IN ('adult_a', 'adult_b', '50_50', 'by_income')),
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscription_household_renewal
  ON public.subscription (household_id, next_renewal_at)
  WHERE active = true;

CREATE TRIGGER subscription_set_updated_at
  BEFORE UPDATE ON public.subscription
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription FORCE ROW LEVEL SECURITY;

CREATE POLICY subscription_household_isolation ON public.subscription
  FOR ALL
  TO public
  USING (household_id IN (SELECT * FROM public.auth_user_household_ids()))
  WITH CHECK (household_id IN (SELECT * FROM public.auth_user_household_ids()));
