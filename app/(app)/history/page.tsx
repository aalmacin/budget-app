import Link from "next/link";
import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { getCurrentHousehold, cachedListHistoryMonths } from "@/lib/supabase/cache";

export const metadata = { title: "History · Budget" };
export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type MonthRow = { year: number; month: number };

export default async function HistoryPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const householdId = await getCurrentHousehold();
  const data = householdId ? await cachedListHistoryMonths(householdId) : [];

  const pastMonths = ((data ?? []) as MonthRow[])
    .filter((r) => !(r.year === currentYear && r.month === currentMonth))
    .sort((a, b) => b.year - a.year || b.month - a.month);

  return (
    <div className="pt-3 pb-32">
      <AppBar />
      <PageTitle title="History" />

      {pastMonths.length === 0 ? (
        <p className="text-sm text-muted px-4 py-8 text-center">
          No past months yet.
        </p>
      ) : (
        <ul className="mx-4 rounded-3xl bg-surface shadow-sm divide-y divide-line/40">
          {pastMonths.map((r) => (
            <li key={`${r.year}-${r.month}`}>
              <Link
                href={`/history/${r.year}/${r.month}`}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-soft transition-colors"
              >
                <span className="text-sm font-mono text-ink">
                  {MONTH_NAMES[r.month - 1]} {r.year}
                </span>
                <span className="text-muted text-sm">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
