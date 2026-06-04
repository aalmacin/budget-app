-- T056 — Phase 7 / US4: public.household.
--
-- The RLS policy referencing public.auth_user_household_ids() is created in
-- 20260524000005 (T060) because the helper depends on household_member,
-- which doesn't exist until 20260524000002 (T057).

CREATE TABLE public.household (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  currency      TEXT NOT NULL DEFAULT 'CAD',
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER household_set_updated_at
  BEFORE UPDATE ON public.household
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.household ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household FORCE ROW LEVEL SECURITY;
