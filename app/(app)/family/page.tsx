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

  const { data: membersData } = await supabase
    .from("household_member")
    .select("id, display_name, role, age_years, monthly_income_cents, created_at")
    .is("deleted_at", null)
    .order("created_at");

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

  // Per-kid month spending: query transactions for_member_id in this month.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const kidIds = kidsBase.map((k) => k.id);
  const { data: txnData } = kidIds.length
    ? await supabase
        .from("transaction")
        .select("for_member_id, amount_cents, occurred_on")
        .in("for_member_id", kidIds)
        .gte("occurred_on", monthStart)
        .lt("occurred_on", monthEnd)
        .eq("type", "expense")
    : { data: [] as Array<{ for_member_id: string; amount_cents: number | string; occurred_on: string }> };

  const monthByKid = new Map<string, { spent: bigint; last: string | null }>();
  for (const r of txnData ?? []) {
    const k = r.for_member_id;
    const cents = BigInt(typeof r.amount_cents === "string" ? r.amount_cents : r.amount_cents);
    const prev = monthByKid.get(k) ?? { spent: 0n, last: null };
    monthByKid.set(k, {
      spent: prev.spent + cents,
      last:
        prev.last && prev.last > r.occurred_on ? prev.last : r.occurred_on,
    });
  }

  const kids: KidCardData[] = kidsBase.map((k) => {
    const stats = monthByKid.get(k.id) ?? { spent: 0n, last: null };
    return {
      id: k.id,
      display_name: k.display_name,
      age_years: k.age_years,
      month_spent_cents: stats.spent,
      last_activity_day: stats.last,
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
