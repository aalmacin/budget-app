import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { CategoryEssentialRuleList, type CategoryRule } from "@/components/settings/CategoryEssentialRuleList";
import { TimezoneSelector } from "@/components/settings/TimezoneSelector";

export const metadata = { title: "Settings · Budget" };
export const dynamic = "force-dynamic";

type SplitRow = { adult_id: string; ratio: number | string; display_order: number };
type MemberRow = { id: string; display_name: string; role?: string };
type CategoryRow = { id: string; name: string; default_essential_pct: number };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();

  // Principle III: clients call RPCs, never `.from()` against household tables.
  const { data: householdId } = await supabase.rpc("get_current_household");

  const [{ data: splitData }, { data: membersData }, { data: categoriesData }, { data: timezoneData }] =
    await Promise.all([
      householdId
        ? supabase.rpc("compute_income_split", { p_household_id: householdId })
        : Promise.resolve({ data: null }),
      supabase.rpc("list_household_members"),
      supabase.rpc("list_categories", { p_kind: "expense" }),
      supabase.rpc("get_household_timezone"),
    ]);

  const timezone = (timezoneData as string | null) ?? "UTC";

  const adults: MemberRow[] = ((membersData ?? []) as MemberRow[]).filter(
    (m) => m.role === "adult",
  );
  const split: SplitRow[] = (splitData ?? []) as SplitRow[];
  const categories: CategoryRule[] = ((categoriesData ?? []) as CategoryRow[])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const adultName = (id: string) =>
    adults.find((a) => a.id === id)?.display_name ?? "Adult";

  return (
    <div className="pt-3 pb-32">
      <AppBar />
      <PageTitle title="Settings" />

      <div className="px-4 space-y-4">
        <section className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            Currency
          </div>
          <div className="text-sm text-ink mt-1">CAD · Canadian Dollar</div>
          <div className="text-[11px] text-faint mt-0.5">
            Multi-currency is out of scope for v1.
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            Timezone
          </div>
          <TimezoneSelector current={timezone} />
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            Income-split rule
          </div>
          {split.length === 0 ? (
            <p className="text-sm text-muted mt-2">Add income transactions first.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {split.map((r) => (
                <li
                  key={r.adult_id}
                  className="flex justify-between text-sm text-ink font-mono"
                >
                  <span>{adultName(r.adult_id)}</span>
                  <span>
                    {Math.round(Number(r.ratio) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/family"
            className="inline-block mt-3 text-xs text-sage"
          >
            Manage members →
          </Link>
        </section>

        <section>
          <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted px-1 mb-2">
            Category essential rules
          </div>
          <CategoryEssentialRuleList categories={categories} />
        </section>
      </div>
    </div>
  );
}
