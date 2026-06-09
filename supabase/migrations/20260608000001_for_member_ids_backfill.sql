-- Add for_member_ids UUID[] to transaction and saved_expense, back-filling
-- from for_member_id. The drop migration (20260608000002) follows next.

ALTER TABLE public.transaction
  ADD COLUMN for_member_ids UUID[];

ALTER TABLE public.saved_expense
  ADD COLUMN for_member_ids UUID[];

UPDATE public.transaction
   SET for_member_ids = ARRAY[for_member_id]
 WHERE for_member_id IS NOT NULL;

UPDATE public.saved_expense
   SET for_member_ids = ARRAY[for_member_id]
 WHERE for_member_id IS NOT NULL;
