import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { CategoryEssentialRuleList, type CategoryRule } from "@/components/settings/CategoryEssentialRuleList";

export const metadata = { title: "Settings · Budget" };
export const dynamic = "force-dynamic";

type SplitRow = { adult_id: string; ratio: number | string; display_order: number };
type MemberRow = { id: string; display_name: string; monthly_income_cents: number | string };
type CategoryRow = { id: string; name: string; default_essential_pct: number };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("household_member")
    .select("household_id")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const householdId = membership?.household_id as string | undefined;

  const [{ data: splitData }, { data: adultsData }, { data: categoriesData }] =
    await Promise.all([
      householdId
        ? supabase.rpc("compute_income_split", { p_household_id: householdId })
        : Promise.resolve({ data: null }),
      supabase
        .from("household_member")
        .select("id, display_name, monthly_income_cents")
        .eq("role", "adult")
        .is("deleted_at", null)
        .order("created_at"),
      supabase
        .from("category")
        .select("id, name, default_essential_pct")
        .eq("kind", "expense")
        .order("name"),
    ]);

  const adults: MemberRow[] = (adultsData ?? []) as MemberRow[];
  const split: SplitRow[] = (splitData ?? []) as SplitRow[];
  const categories: CategoryRule[] = (categoriesData ?? []) as CategoryRow[];

  const adultName = (id: string) =>
    adults.find((a) => a.id === id)?.display_name ?? "Adult";

  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
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
            Income-split rule
          </div>
          {split.length === 0 ? (
            <p className="text-sm text-muted mt-2">Add adults and incomes first.</p>
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
