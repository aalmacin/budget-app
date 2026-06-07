-- 2026-06-06: saved_expense templates for the Quick Add page.
-- A saved expense is a household-scoped reusable expense template. Tapping
-- one on Quick Add prefills the /add form (it does NOT auto-log). The user
-- can edit any field and either keep the template untouched or check
-- "Override saved values" to update it on submit.

CREATE TABLE public.saved_expense (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  merchant            TEXT NOT NULL CHECK (length(merchant) BETWEEN 1 AND 200),
  amount_cents        BIGINT NOT NULL CHECK (amount_cents > 0),
  category_id         UUID NOT NULL REFERENCES public.category(id) ON DELETE RESTRICT,
  paid_by_member_id   UUID REFERENCES public.household_member(id),
  for_member_id       UUID REFERENCES public.household_member(id),
  essential_pct       SMALLINT NOT NULL DEFAULT 100 CHECK (essential_pct BETWEEN 0 AND 100),
  split_rule          TEXT CHECK (split_rule IN ('adult_a', 'adult_b', '50_50', 'by_income')),
  last_used_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX saved_expense_household_last_used
  ON public.saved_expense (household_id, last_used_at DESC);

CREATE TRIGGER saved_expense_set_updated_at
  BEFORE UPDATE ON public.saved_expense
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.saved_expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_expense FORCE ROW LEVEL SECURITY;

CREATE POLICY saved_expense_household_isolation ON public.saved_expense
  FOR ALL
  TO public
  USING (household_id IN (SELECT * FROM public.auth_user_household_ids()))
  WITH CHECK (household_id IN (SELECT * FROM public.auth_user_household_ids()));
