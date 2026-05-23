import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PerPersonClient } from "./PerPersonClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Per-person · Budget" };

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data } = await supabase.rpc("per_person_breakdown", {
    p_year: year,
    p_month: month,
    p_include_general: false,
  });

  return <PerPersonClient year={year} month={month} initial={(data ?? []) as never} />;
}
