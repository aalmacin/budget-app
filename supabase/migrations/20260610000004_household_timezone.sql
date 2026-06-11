ALTER TABLE public.household
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE OR REPLACE FUNCTION public.get_household_timezone()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT timezone
  FROM public.household
  WHERE id = public.get_current_household()
$$;

ALTER FUNCTION public.get_household_timezone() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.get_household_timezone() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_household_timezone() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_household_timezone(p_timezone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Invalid timezone' USING ERRCODE = '22023';
  END IF;
  UPDATE public.household
  SET timezone = p_timezone
  WHERE id = public.get_current_household();
END;
$$;

ALTER FUNCTION public.set_household_timezone(TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.set_household_timezone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_household_timezone(TEXT) TO authenticated;
