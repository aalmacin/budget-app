"use server";

import { updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentHousehold, mbrTag, finTag } from "@/lib/supabase/cache";

export type AddAdultResult = { status?: string; error?: string };

export async function addAdultAction(email: string): Promise<AddAdultResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_adult_by_email", {
    p_email: email,
  });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) updateTag(mbrTag(hid));
  const row = Array.isArray(data) ? data[0] : data;
  return { status: (row?.status as string | undefined) ?? "inserted" };
}

export async function addKidAction(displayName: string, ageYears: number): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_kid", {
    p_display_name: displayName,
    p_age_years: ageYears,
  });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) updateTag(mbrTag(hid));
  return {};
}

export async function removeMemberAction(memberId: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("soft_delete_member", {
    p_member_id: memberId,
  });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) {
    updateTag(mbrTag(hid));
    updateTag(finTag(hid));
  }
  return {};
}

export async function updateDisplayNameAction(
  memberId: string,
  displayName: string,
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_member_display_name", {
    p_member_id: memberId,
    p_display_name: displayName,
  });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) updateTag(mbrTag(hid));
  return {};
}
