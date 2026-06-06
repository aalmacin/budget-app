-- Fix: log_income / log_expense fail at COMMIT with
-- "permission denied for table household_member" on cloud Supabase.
--
-- Root cause: public.enforce_member_household() (defined in 20260524000006)
-- is SECURITY INVOKER and is fired by a DEFERRABLE INITIALLY DEFERRED
-- constraint trigger on public.transaction. At COMMIT time, the SECURITY
-- DEFINER context of log_income / _insert_transaction has already ended, so
-- PostgREST's role is back to `authenticated`. The lockdown in
-- 20260524000008 revoked all DML grants on public.household_member from
-- `authenticated`, so the trigger's `SELECT 1 FROM public.household_member`
-- raises 42501.
--
-- Pattern (matches every other write helper in Phase 7): SECURITY DEFINER
-- owned by budget_function_owner. The role has SELECT on household_member,
-- and FORCE RLS still filters via the household_id IN auth_user_household_ids
-- policy, so cross-household reads remain blocked.

CREATE OR REPLACE FUNCTION public.enforce_member_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

ALTER FUNCTION public.enforce_member_household() OWNER TO budget_function_owner;
