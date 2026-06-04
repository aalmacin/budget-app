-- T061 — Phase 7 / US6: public.transaction, household-scoped.
--
-- Client-supplied UUID v7 PK (no default) enables idempotent replay of the
-- offline outbox after reconnection (lib/pwa/dispatch.ts).
--
-- Writes are intentionally NOT allowed via RLS — only SELECT is policied
-- here. All mutations flow through SECURITY DEFINER RPCs (see Phase 7 §7.3).
-- The grant lockdown in 20260524000008 (T063) is what physically prevents
-- direct DML; this matches the Phase 6 pattern (R10).

CREATE TABLE public.transaction (
  id                  UUID PRIMARY KEY,
  household_id        UUID NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount_cents        BIGINT NOT NULL CHECK (amount_cents > 0),
  occurred_on         DATE NOT NULL,
  category_id         UUID NOT NULL REFERENCES public.category(id) ON DELETE RESTRICT,
  notes               TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  paid_by_member_id   UUID REFERENCES public.household_member(id),
  for_member_id       UUID REFERENCES public.household_member(id),
  essential_pct       SMALLINT NOT NULL DEFAULT 100 CHECK (essential_pct BETWEEN 0 AND 100),
  split_rule          TEXT CHECK (split_rule IN ('adult_a', 'adult_b', '50_50', 'by_income')),
  income_source       TEXT CHECK (income_source IN ('Salary', 'Contract', 'Self_employed', 'Benefit', 'Refund', 'Gift')),
  subscription_id     UUID,
  occurrence_date     DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transaction_household_occurred
  ON public.transaction (household_id, occurred_on DESC);

CREATE INDEX transaction_household_category_occurred
  ON public.transaction (household_id, category_id, occurred_on);

-- Idempotency for cron-materialized subscription transactions (FR-032).
CREATE UNIQUE INDEX transaction_subscription_idempotency
  ON public.transaction (subscription_id, occurrence_date)
  WHERE subscription_id IS NOT NULL AND occurrence_date IS NOT NULL;

CREATE INDEX transaction_notes_search
  ON public.transaction USING GIN (to_tsvector('simple', notes));

CREATE TRIGGER transaction_set_updated_at
  BEFORE UPDATE ON public.transaction
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction FORCE ROW LEVEL SECURITY;

CREATE POLICY transaction_select ON public.transaction
  FOR SELECT
  TO public
  USING (household_id IN (SELECT * FROM public.auth_user_household_ids()));

-- FR-029: paid_by_member_id and for_member_id must belong to the same
-- household as the transaction. Deferred so a multi-row insert can satisfy
-- the constraint at commit time even if intermediate rows would violate it.
CREATE FUNCTION public.enforce_member_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.for_member_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_member
      WHERE id = NEW.for_member_id AND household_id = NEW.household_id
    ) THEN
      RAISE EXCEPTION 'for_member_id does not belong to this household'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.paid_by_member_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_member
      WHERE id = NEW.paid_by_member_id AND household_id = NEW.household_id
    ) THEN
      RAISE EXCEPTION 'paid_by_member_id does not belong to this household'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER transaction_member_household
  AFTER INSERT OR UPDATE OF household_id, for_member_id, paid_by_member_id
  ON public.transaction
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_household();
