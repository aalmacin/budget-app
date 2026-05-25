-- T065–T070 — Phase 7 / US5: family-member RPCs + small read helpers.
-- Every function: SECURITY DEFINER, search_path = '', owner =
-- budget_function_owner, EXECUTE granted to authenticated.

-- ---------------------------------------------------------------------------
-- get_current_household() — returns the first household the caller is an
-- active member of. The app today assumes one household per user; if a user
-- ever joins multiple, returns the earliest joined (deterministic).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.get_current_household()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hm.household_id
  FROM budget.household_member hm
  WHERE hm.user_id = auth.uid()
    AND hm.deleted_at IS NULL
  ORDER BY hm.created_at ASC
  LIMIT 1
$$;

ALTER FUNCTION budget.get_current_household() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.get_current_household() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.get_current_household() TO authenticated;

-- ---------------------------------------------------------------------------
-- list_household_members() — every active member in the caller's household.
-- Returns the full row shape the family / transactions / settings / dashboard
-- pages consume (replaces five direct from('household_member') call sites).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.list_household_members()
RETURNS TABLE (
  id                   UUID,
  household_id         UUID,
  user_id              UUID,
  role                 TEXT,
  display_name         TEXT,
  age_years            SMALLINT,
  avatar_url           TEXT,
  monthly_income_cents BIGINT,
  created_at           TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hm.id, hm.household_id, hm.user_id, hm.role, hm.display_name,
         hm.age_years, hm.avatar_url, hm.monthly_income_cents, hm.created_at
  FROM budget.household_member hm
  WHERE hm.household_id = budget.get_current_household()
    AND hm.deleted_at IS NULL
  ORDER BY hm.created_at
$$;

ALTER FUNCTION budget.list_household_members() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.list_household_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.list_household_members() TO authenticated;

-- ---------------------------------------------------------------------------
-- add_adult_by_email(p_email) — resolves an existing auth.users row and
-- inserts/restores them as an adult in the caller's household.
--
-- Returns (status, member_id):
--   inserted     — new household_member row created
--   restored     — soft-deleted member row's deleted_at cleared
--   already_member — that user already has an active membership in this household
--   not_found    — no auth.users row with that email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.add_adult_by_email(p_email TEXT)
RETURNS TABLE (status TEXT, member_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_target_uid   UUID;
  v_display_name TEXT;
  v_existing_id  UUID;
  v_existing_deleted TIMESTAMPTZ;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email is required' USING ERRCODE = '22023';
  END IF;

  SELECT au.id,
         coalesce(nullif(au.raw_user_meta_data->>'full_name', ''),
                  split_part(au.email, '@', 1),
                  'Adult')
  INTO v_target_uid, v_display_name
  FROM auth.users au
  WHERE lower(au.email) = lower(trim(p_email))
  LIMIT 1;

  IF v_target_uid IS NULL THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT hm.id, hm.deleted_at
  INTO v_existing_id, v_existing_deleted
  FROM budget.household_member hm
  WHERE hm.household_id = v_household_id
    AND hm.user_id = v_target_uid
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_deleted IS NULL THEN
      RETURN QUERY SELECT 'already_member'::TEXT, v_existing_id;
      RETURN;
    END IF;
    -- forbid_undelete_of_adult_when_capped trigger may reject this update.
    UPDATE budget.household_member
       SET deleted_at = NULL
     WHERE id = v_existing_id;
    RETURN QUERY SELECT 'restored'::TEXT, v_existing_id;
    RETURN;
  END IF;

  -- enforce_adult_cap trigger may reject this insert.
  INSERT INTO budget.household_member (
    household_id, user_id, role, display_name
  ) VALUES (
    v_household_id, v_target_uid, 'adult', v_display_name
  )
  RETURNING id INTO v_existing_id;

  RETURN QUERY SELECT 'inserted'::TEXT, v_existing_id;
END;
$$;

ALTER FUNCTION budget.add_adult_by_email(TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.add_adult_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.add_adult_by_email(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- add_kid(p_display_name, p_age_years) — inserts a kid in the caller's
-- household. No cap on kids.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.add_kid(p_display_name TEXT, p_age_years INT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_id           UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name is required' USING ERRCODE = '22023';
  END IF;
  IF p_age_years IS NULL OR p_age_years < 0 OR p_age_years > 25 THEN
    RAISE EXCEPTION 'age_years must be between 0 and 25' USING ERRCODE = '22023';
  END IF;

  INSERT INTO budget.household_member (
    household_id, role, display_name, age_years
  ) VALUES (
    v_household_id, 'kid', trim(p_display_name), p_age_years::SMALLINT
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

ALTER FUNCTION budget.add_kid(TEXT, INT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.add_kid(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.add_kid(TEXT, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- soft_delete_member(p_member_id) — sets deleted_at = now() if the member
-- belongs to the caller's household. RLS already filters cross-household.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.soft_delete_member(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;

  UPDATE budget.household_member
     SET deleted_at = now()
   WHERE id = p_member_id
     AND household_id = v_household_id
     AND deleted_at IS NULL;
END;
$$;

ALTER FUNCTION budget.soft_delete_member(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.soft_delete_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.soft_delete_member(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_member_income(p_member_id, p_monthly_income_cents) — updates an
-- adult's monthly_income_cents in the caller's household.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.update_member_income(
  p_member_id UUID,
  p_monthly_income_cents BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF p_monthly_income_cents IS NULL OR p_monthly_income_cents < 0 THEN
    RAISE EXCEPTION 'monthly_income_cents must be >= 0' USING ERRCODE = '22023';
  END IF;

  UPDATE budget.household_member
     SET monthly_income_cents = p_monthly_income_cents
   WHERE id = p_member_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION budget.update_member_income(UUID, BIGINT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.update_member_income(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.update_member_income(UUID, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_kid_month_summary(p_year, p_month) — replaces the direct
-- supabase.from('transaction').select('for_member_id, amount_cents,
-- occurred_on').in('for_member_id', kidIds) read in family/page.tsx.
-- Returns one row per kid: total expense spend for the calendar month +
-- the last occurred_on for that kid in that month.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.list_kid_month_summary(p_year INT, p_month INT)
RETURNS TABLE (
  kid_id            UUID,
  spent_cents       BIGINT,
  last_activity_day DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT make_date(p_year, p_month, 1)                    AS month_start,
           (make_date(p_year, p_month, 1) + INTERVAL '1 month')::DATE AS month_end
  ),
  kids AS (
    SELECT hm.id
    FROM budget.household_member hm
    WHERE hm.household_id = budget.get_current_household()
      AND hm.role = 'kid'
      AND hm.deleted_at IS NULL
  )
  SELECT k.id AS kid_id,
         coalesce(sum(t.amount_cents), 0)::BIGINT AS spent_cents,
         max(t.occurred_on) AS last_activity_day
  FROM kids k
  LEFT JOIN budget.transaction t
         ON t.for_member_id = k.id
        AND t.type = 'expense'
        AND t.occurred_on >= (SELECT month_start FROM bounds)
        AND t.occurred_on <  (SELECT month_end   FROM bounds)
  GROUP BY k.id
$$;

ALTER FUNCTION budget.list_kid_month_summary(INT, INT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.list_kid_month_summary(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.list_kid_month_summary(INT, INT) TO authenticated;
