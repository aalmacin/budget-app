-- T057 — Phase 7 / US5: budget.household_member + adult cap triggers.
-- Ported from legacy public.household_member (0002_household.sql) into the
-- budget schema, with the timestamp trigger from the new shared helper.

CREATE TABLE budget.household_member (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID NOT NULL REFERENCES budget.household(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES auth.users(id),
  role                 TEXT NOT NULL CHECK (role IN ('adult', 'kid')),
  display_name         TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  age_years            SMALLINT CHECK (age_years BETWEEN 0 AND 25),
  avatar_url           TEXT,
  monthly_income_cents BIGINT NOT NULL DEFAULT 0 CHECK (monthly_income_cents >= 0),
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT household_member_age_for_kid_only
    CHECK ((role = 'kid'   AND age_years IS NOT NULL)
        OR (role = 'adult' AND age_years IS NULL))
);

CREATE UNIQUE INDEX household_member_user_per_household
  ON budget.household_member (household_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX household_member_household_active
  ON budget.household_member (household_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER household_member_set_updated_at
  BEFORE UPDATE ON budget.household_member
  FOR EACH ROW EXECUTE FUNCTION budget.update_timestamp();

ALTER TABLE budget.household_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget.household_member FORCE ROW LEVEL SECURITY;

CREATE FUNCTION budget.enforce_adult_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_active_adults INT;
BEGIN
  IF NEW.role <> 'adult' THEN
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_active_adults
  FROM budget.household_member
  WHERE household_id = NEW.household_id
    AND role = 'adult'
    AND deleted_at IS NULL
    AND id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_active_adults >= 2 THEN
    RAISE EXCEPTION 'Households are limited to 2 adults'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER household_member_enforce_adult_cap
  BEFORE INSERT OR UPDATE ON budget.household_member
  FOR EACH ROW EXECUTE FUNCTION budget.enforce_adult_cap();

CREATE FUNCTION budget.forbid_undelete_of_adult_when_capped()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_active_adults INT;
BEGIN
  IF NEW.role <> 'adult' THEN
    RETURN NEW;
  END IF;
  -- Only act on a null → non-null reversal of deleted_at.
  IF OLD.deleted_at IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_active_adults
  FROM budget.household_member
  WHERE household_id = NEW.household_id
    AND role = 'adult'
    AND deleted_at IS NULL
    AND id <> NEW.id;

  IF v_active_adults >= 2 THEN
    RAISE EXCEPTION 'Cannot restore adult: household already has 2 active adults'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER household_member_forbid_undelete_capped
  BEFORE UPDATE OF deleted_at ON budget.household_member
  FOR EACH ROW EXECUTE FUNCTION budget.forbid_undelete_of_adult_when_capped();
