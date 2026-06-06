import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { FamilyClient } from "./FamilyClient";
import type { MemberCardData } from "@/components/family/MemberCard";
import type { KidCardData } from "@/components/family/KidGrid";

export const metadata = { title: "Family · Budget" };
export const dynamic = "force-dynamic";

type RawMember = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
  age_years: number | null;
  monthly_income_cents: number | string;
};

export default async function FamilyPage() {
  const supabase = await createSupabaseServerClient();

  // Principle III: clients call RPCs, never `.from()` against household tables.
  // list_kid_month_summary aggregates per-kid spend for the given month so we
  // don't need a direct .from("transaction").
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [{ data: membersData }, { data: kidSummary }] = await Promise.all([
    supabase.rpc("list_household_members"),
    supabase.rpc("list_kid_month_summary", { p_year: year, p_month: month }),
  ]);

  const members: RawMember[] = (membersData ?? []) as RawMember[];

  const adults: MemberCardData[] = members
    .filter((m) => m.role === "adult")
    .map((m) => ({
      id: m.id,
      display_name: m.display_name,
      role: "adult",
      age_years: null,
      monthly_income_cents: BigInt(
        typeof m.monthly_income_cents === "string" ? m.monthly_income_cents : m.monthly_income_cents,
      ),
    }));

  const kidsBase = members.filter((m) => m.role === "kid");

  type KidSummaryRow = {
    kid_id: string;
    spent_cents: number | string;
    last_activity_day: string | null;
  };
  const summaryByKid = new Map<string, KidSummaryRow>(
    ((kidSummary ?? []) as KidSummaryRow[]).map((r) => [r.kid_id, r]),
  );

  const kids: KidCardData[] = kidsBase.map((k) => {
    const stats = summaryByKid.get(k.id);
    return {
      id: k.id,
      display_name: k.display_name,
      age_years: k.age_years,
      month_spent_cents: stats
        ? BigInt(typeof stats.spent_cents === "string" ? stats.spent_cents : stats.spent_cents)
        : 0n,
      last_activity_day: stats?.last_activity_day ?? null,
    };
  });

  const monthSpentOnKidsCents = kids.reduce((sum, k) => sum + k.month_spent_cents, 0n);
  const monthLabel = now.toLocaleString("en-CA", { month: "long" });

  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Family" subtitle="Members + per-kid spend" />
      <FamilyClient
        adults={adults}
        kids={kids}
        monthSpentOnKidsCents={monthSpentOnKidsCents}
        monthLabel={monthLabel}
      />
    </div>
  );
}
