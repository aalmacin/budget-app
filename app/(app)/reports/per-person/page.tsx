import { PerPersonClient } from "./PerPersonClient";
import { getCurrentHousehold, cachedPerPersonBreakdown } from "@/lib/supabase/cache";

export const dynamic = "force-dynamic";
export const metadata = { title: "Per-person · Budget" };

export default async function Page() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const householdId = await getCurrentHousehold();
  const data = householdId ? await cachedPerPersonBreakdown(householdId, year, month) : [];

  return <PerPersonClient year={year} month={month} initial={(data ?? []) as never} />;
}
