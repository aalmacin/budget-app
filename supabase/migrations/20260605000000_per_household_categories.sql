-- 2026-06-05: remove the system-global category concept. Every category is
-- household-scoped from here on.
--
-- Strategy:
--   1. For each transaction/subscription that still points at a global
--      category, materialize a per-household copy (or reuse an existing
--      household-scoped one with the same name + kind) and re-point.
--   2. Backfill a per-household "Income" category for every household that
--      doesn't already have one — /add-income previously relied on the
--      system-global "Income" seed.
--   3. Delete the remaining global rows.
--   4. Enforce household_id NOT NULL.
--   5. Update bootstrap_household so new households are seeded with their
--      own Income category.
--   6. Tighten the SELECT policy and list_categories so a stray NULL row
--      (if one ever appeared) wouldn't leak across households.

-- 1. Re-point transaction FKs.
DO $$
DECLARE
  r RECORD;
  v_new_id UUID;
BEGIN
  FOR r IN
    SELECT t.id AS txn_id,
           t.household_id,
           c.name,
           c.kind,
           c.default_essential_pct,
           c.monthly_budget_cents
      FROM public.transaction t
      JOIN public.category c ON c.id = t.category_id
     WHERE c.household_id IS NULL
  LOOP
    SELECT id INTO v_new_id
      FROM public.category
     WHERE household_id = r.household_id
       AND name = r.name
       AND kind = r.kind
     LIMIT 1;
    IF v_new_id IS NULL THEN
      INSERT INTO public.category (
        household_id, name, default_essential_pct, monthly_budget_cents, kind
      ) VALUES (
        r.household_id, r.name, r.default_essential_pct, r.monthly_budget_cents, r.kind
      )
      RETURNING id INTO v_new_id;
    END IF;
    UPDATE public.transaction SET category_id = v_new_id WHERE id = r.txn_id;
  END LOOP;

  FOR r IN
    SELECT s.id AS sub_id,
           s.household_id,
           c.name,
           c.kind,
           c.default_essential_pct,
           c.monthly_budget_cents
      FROM public.subscription s
      JOIN public.category c ON c.id = s.category_id
     WHERE c.household_id IS NULL
  LOOP
    SELECT id INTO v_new_id
      FROM public.category
     WHERE household_id = r.household_id
       AND name = r.name
       AND kind = r.kind
     LIMIT 1;
    IF v_new_id IS NULL THEN
      INSERT INTO public.category (
        household_id, name, default_essential_pct, monthly_budget_cents, kind
      ) VALUES (
        r.household_id, r.name, r.default_essential_pct, r.monthly_budget_cents, r.kind
      )
      RETURNING id INTO v_new_id;
    END IF;
    UPDATE public.subscription SET category_id = v_new_id WHERE id = r.sub_id;
  END LOOP;
END $$;

-- 2. Backfill a per-household Income category.
INSERT INTO public.category (household_id, name, default_essential_pct, kind)
SELECT h.id, 'Income', 0, 'income'
  FROM public.household h
 WHERE NOT EXISTS (
   SELECT 1 FROM public.category c
    WHERE c.household_id = h.id AND c.kind = 'income'
 );

-- 3. Drop remaining globals (now unreferenced).
DELETE FROM public.category WHERE household_id IS NULL;

-- 4. Enforce NOT NULL.
ALTER TABLE public.category ALTER COLUMN household_id SET NOT NULL;

-- 5. Bootstrap new households with their own Income category.
CREATE OR REPLACE FUNCTION public.bootstrap_household(
  p_user_id      UUID,
  p_name         TEXT,
  p_display_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'bootstrap_household: p_user_id must match auth.uid()'
      USING ERRCODE = '28000';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'bootstrap_household: name is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.household (name, owner_user_id)
  VALUES (trim(p_name), p_user_id)
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_member (
    household_id, user_id, role, display_name
  ) VALUES (
    v_household_id, p_user_id, 'adult', coalesce(p_display_name, 'Adult')
  );

  INSERT INTO public.category (household_id, name, default_essential_pct, kind)
  VALUES (v_household_id, 'Income', 0, 'income');

  RETURN v_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_household(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_household(UUID, TEXT, TEXT) TO budget_function_owner;

-- 6. Tighten SELECT policy and list_categories — globals no longer exist.
DROP POLICY IF EXISTS category_select_visible ON public.category;
CREATE POLICY category_select_visible ON public.category
  FOR SELECT
  TO public
  USING (household_id IN (SELECT * FROM public.auth_user_household_ids()));

CREATE OR REPLACE FUNCTION public.list_categories(p_kind TEXT DEFAULT NULL)
RETURNS TABLE (
  id                     UUID,
  household_id           UUID,
  name                   TEXT,
  default_essential_pct  SMALLINT,
  monthly_budget_cents   BIGINT,
  kind                   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  RETURN QUERY
  SELECT c.id, c.household_id, c.name, c.default_essential_pct,
         c.monthly_budget_cents, c.kind
  FROM public.category c
  WHERE c.household_id = v_household_id
    AND (p_kind IS NULL OR c.kind = p_kind)
  ORDER BY c.name;
END;
$$;

ALTER FUNCTION public.list_categories(TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_categories(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_categories(TEXT) TO authenticated;
