-- T078–T082 — Phase 7 / US6: category / budget RPCs.
-- Every function: SECURITY DEFINER, search_path = '', owner =
-- budget_function_owner, EXECUTE granted to authenticated.
--
-- Editing a system-global category (household_id IS NULL) is rejected. The
-- caller should clone-on-write at the UI layer before editing — there is no
-- clone_category RPC yet because no current call site needs one.

CREATE OR REPLACE FUNCTION budget._assert_household_category(p_category_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_owner        UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;

  SELECT household_id INTO v_owner
  FROM budget.category WHERE id = p_category_id;

  IF v_owner IS NULL THEN
    -- Either non-existent or a system seed. Distinguish for a clearer error.
    IF EXISTS (SELECT 1 FROM budget.category WHERE id = p_category_id) THEN
      RAISE EXCEPTION 'Cannot modify a system-global category; clone it into your household first'
        USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'category_id % does not exist', p_category_id USING ERRCODE = '23503';
  END IF;
  IF v_owner <> v_household_id THEN
    RAISE EXCEPTION 'category_id % belongs to another household', p_category_id USING ERRCODE = '42501';
  END IF;
  RETURN v_household_id;
END;
$$;

ALTER FUNCTION budget._assert_household_category(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget._assert_household_category(UUID) FROM PUBLIC;
-- Internal helper; not granted to authenticated.

CREATE OR REPLACE FUNCTION budget.set_category_essential_pct(p_category_id UUID, p_pct INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 100 THEN
    RAISE EXCEPTION 'p_pct must be between 0 and 100' USING ERRCODE = '22023';
  END IF;
  PERFORM budget._assert_household_category(p_category_id);
  UPDATE budget.category
     SET default_essential_pct = p_pct::SMALLINT
   WHERE id = p_category_id;
END;
$$;

ALTER FUNCTION budget.set_category_essential_pct(UUID, INT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.set_category_essential_pct(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.set_category_essential_pct(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION budget.set_category_budget(
  p_category_id UUID, p_monthly_budget_cents BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_monthly_budget_cents IS NOT NULL AND p_monthly_budget_cents < 0 THEN
    RAISE EXCEPTION 'p_monthly_budget_cents must be >= 0 or NULL' USING ERRCODE = '22023';
  END IF;
  PERFORM budget._assert_household_category(p_category_id);
  UPDATE budget.category
     SET monthly_budget_cents = p_monthly_budget_cents
   WHERE id = p_category_id;
END;
$$;

ALTER FUNCTION budget.set_category_budget(UUID, BIGINT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.set_category_budget(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.set_category_budget(UUID, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_budget_progress(p_year, p_month, p_filter) — per-category month spend
-- vs. monthly_budget_cents.
-- p_filter: 'all' | 'essential' | 'treats'
-- Categories considered: every system-global + every household-owned with a
-- non-null monthly_budget_cents.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.get_budget_progress(
  p_year INT, p_month INT, p_filter TEXT DEFAULT 'all'
)
RETURNS TABLE (
  category_id          UUID,
  category_name        TEXT,
  monthly_budget_cents BIGINT,
  spent_cents          BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_start        DATE;
  v_end          DATE;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + INTERVAL '1 month')::DATE;

  RETURN QUERY
  SELECT c.id,
         c.name,
         c.monthly_budget_cents,
         coalesce(sum(t.amount_cents), 0)::BIGINT AS spent_cents
  FROM budget.category c
  LEFT JOIN budget.transaction t
         ON t.category_id = c.id
        AND t.household_id = v_household_id
        AND t.type = 'expense'
        AND t.occurred_on >= v_start
        AND t.occurred_on <  v_end
        AND (p_filter = 'all'
             OR (p_filter = 'essential' AND t.essential_pct >= 50)
             OR (p_filter = 'treats'    AND t.essential_pct <  50))
  WHERE (c.household_id IS NULL OR c.household_id = v_household_id)
    AND c.monthly_budget_cents IS NOT NULL
  GROUP BY c.id, c.name, c.monthly_budget_cents
  ORDER BY c.name;
END;
$$;

ALTER FUNCTION budget.get_budget_progress(INT, INT, TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.get_budget_progress(INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.get_budget_progress(INT, INT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- compute_income_split(p_household_id) — per-adult ratio of total household
-- income. Validates the caller is a member of p_household_id (otherwise the
-- parameter would be cross-household-bypassable). When total income is 0,
-- returns an equal split.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.compute_income_split(p_household_id UUID)
RETURNS TABLE (
  adult_id      UUID,
  ratio         NUMERIC,
  display_order INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_member BOOLEAN;
  v_total     BIGINT;
  v_adult_n   INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM budget.household_member
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  ) INTO v_is_member;
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Not a member of household %', p_household_id USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(monthly_income_cents), 0), count(*)
  INTO v_total, v_adult_n
  FROM budget.household_member
  WHERE household_id = p_household_id
    AND role = 'adult'
    AND deleted_at IS NULL;

  IF v_total = 0 AND v_adult_n > 0 THEN
    RETURN QUERY
    SELECT id,
           (1.0 / v_adult_n)::NUMERIC,
           row_number() OVER (ORDER BY created_at)::INT
    FROM budget.household_member
    WHERE household_id = p_household_id
      AND role = 'adult'
      AND deleted_at IS NULL
    ORDER BY created_at;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT id,
         (monthly_income_cents::NUMERIC / nullif(v_total, 0)::NUMERIC)::NUMERIC,
         row_number() OVER (ORDER BY created_at)::INT
  FROM budget.household_member
  WHERE household_id = p_household_id
    AND role = 'adult'
    AND deleted_at IS NULL
  ORDER BY created_at;
END;
$$;

ALTER FUNCTION budget.compute_income_split(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.compute_income_split(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.compute_income_split(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_categories(p_kind) — returns system-global + household-scoped
-- categories matching kind. Replaces direct from('category') reads.
-- p_kind NULL => return all kinds.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.list_categories(p_kind TEXT DEFAULT NULL)
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
  v_household_id UUID := budget.get_current_household();
BEGIN
  RETURN QUERY
  SELECT c.id, c.household_id, c.name, c.default_essential_pct,
         c.monthly_budget_cents, c.kind
  FROM budget.category c
  WHERE (c.household_id IS NULL OR c.household_id = v_household_id)
    AND (p_kind IS NULL OR c.kind = p_kind)
  ORDER BY c.name;
END;
$$;

ALTER FUNCTION budget.list_categories(TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.list_categories(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.list_categories(TEXT) TO authenticated;
