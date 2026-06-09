-- Drop for_member_id from transaction and saved_expense.
-- Recreate enforce_member_household to validate array elements instead.

BEGIN;

DROP TRIGGER IF EXISTS transaction_member_household ON public.transaction;
DROP FUNCTION IF EXISTS public.enforce_member_household();

ALTER TABLE public.transaction
  DROP COLUMN for_member_id;

ALTER TABLE public.saved_expense
  DROP COLUMN for_member_id;

CREATE FUNCTION public.enforce_member_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  IF NEW.for_member_ids IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY NEW.for_member_ids
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.household_member
        WHERE id = v_member_id AND household_id = NEW.household_id
      ) THEN
        RAISE EXCEPTION 'for_member_ids element % does not belong to this household', v_member_id
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
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

ALTER FUNCTION public.enforce_member_household() OWNER TO budget_function_owner;

CREATE CONSTRAINT TRIGGER transaction_member_household
  AFTER INSERT OR UPDATE OF household_id, for_member_ids, paid_by_member_id
  ON public.transaction
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_household();

COMMIT;
