-- 2026-06-06: saved_expense RPCs.
-- Mirrors the subscription RPC patterns: SECURITY DEFINER, search_path = '',
-- owner = budget_function_owner, EXECUTE granted to authenticated.

-- ---------------------------------------------------------------------------
-- list_saved_expenses() — household's saved templates, MRU first.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_saved_expenses()
RETURNS TABLE (
  id                 UUID,
  merchant           TEXT,
  amount_cents       BIGINT,
  category_id        UUID,
  category_name      TEXT,
  paid_by_member_id  UUID,
  for_member_id      UUID,
  essential_pct      SMALLINT,
  split_rule         TEXT,
  last_used_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.category_id, c.name,
         s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule,
         s.last_used_at
  FROM public.saved_expense s
  JOIN public.category c ON c.id = s.category_id
  WHERE s.household_id = public.get_current_household()
  ORDER BY s.last_used_at DESC, s.created_at DESC
$$;

ALTER FUNCTION public.list_saved_expenses() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_saved_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_saved_expenses() TO authenticated;

-- ---------------------------------------------------------------------------
-- get_saved_expense(p_id) — single template by id, scoped to caller's
-- household. Returns NULL row on miss. Used by /add?template=<id> prefill.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_saved_expense(p_id UUID)
RETURNS TABLE (
  id                 UUID,
  merchant           TEXT,
  amount_cents       BIGINT,
  category_id        UUID,
  paid_by_member_id  UUID,
  for_member_id      UUID,
  essential_pct      SMALLINT,
  split_rule         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.category_id,
         s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule
  FROM public.saved_expense s
  WHERE s.id = p_id
    AND s.household_id = public.get_current_household()
$$;

ALTER FUNCTION public.get_saved_expense(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.get_saved_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saved_expense(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- create_saved_expense(p jsonb)
-- Required keys: merchant, amount_cents, category_id
-- Optional: paid_by_member_id, for_member_id, essential_pct, split_rule
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_saved_expense(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_merchant     TEXT     := nullif(p->>'merchant', '');
  v_amount       BIGINT   := (p->>'amount_cents')::BIGINT;
  v_category     UUID     := nullif(p->>'category_id', '')::UUID;
  v_paid_by      UUID     := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member   UUID     := nullif(p->>'for_member_id', '')::UUID;
  v_essential    SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split        TEXT     := nullif(p->>'split_rule', '');
  v_cat_owned    BOOLEAN;
  v_id           UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_merchant IS NULL OR v_amount IS NULL OR v_amount <= 0 OR v_category IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;

  SELECT (c.household_id = v_household_id)
    INTO v_cat_owned
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_owned IS NULL OR NOT v_cat_owned THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.saved_expense (
    household_id, merchant, amount_cents, category_id,
    paid_by_member_id, for_member_id, essential_pct, split_rule
  ) VALUES (
    v_household_id, v_merchant, v_amount, v_category,
    v_paid_by, v_for_member, v_essential, v_split
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

ALTER FUNCTION public.create_saved_expense(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.create_saved_expense(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_saved_expense(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_saved_expense(p_id, p jsonb) — full replace of mutable fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_saved_expense(p_id UUID, p JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_merchant     TEXT     := nullif(p->>'merchant', '');
  v_amount       BIGINT   := (p->>'amount_cents')::BIGINT;
  v_category     UUID     := nullif(p->>'category_id', '')::UUID;
  v_paid_by      UUID     := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member   UUID     := nullif(p->>'for_member_id', '')::UUID;
  v_essential    SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split        TEXT     := nullif(p->>'split_rule', '');
  v_cat_owned    BOOLEAN;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_merchant IS NULL OR v_amount IS NULL OR v_amount <= 0 OR v_category IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;

  SELECT (c.household_id = v_household_id)
    INTO v_cat_owned
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_owned IS NULL OR NOT v_cat_owned THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  UPDATE public.saved_expense
     SET merchant          = v_merchant,
         amount_cents      = v_amount,
         category_id       = v_category,
         paid_by_member_id = v_paid_by,
         for_member_id     = v_for_member,
         essential_pct     = v_essential,
         split_rule        = v_split
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.update_saved_expense(UUID, JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.update_saved_expense(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_saved_expense(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- delete_saved_expense(p_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_saved_expense(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.saved_expense
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.delete_saved_expense(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.delete_saved_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_saved_expense(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- touch_saved_expense(p_id) — bumps last_used_at so MRU ordering reflects
-- the latest tap. Called from the /add page when the form is prefilled.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_saved_expense(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.saved_expense
     SET last_used_at = now()
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.touch_saved_expense(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.touch_saved_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_saved_expense(UUID) TO authenticated;
