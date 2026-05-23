import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EssentialsDonut } from "@/components/reports/charts";
import { formatCAD } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Essentials · Budget" };

type SubLine = {
  subscription_id: string;
  merchant: string;
  amount_cents: number | string;
  cadence: string;
  essential_pct: number;
};

type Payload = {
  overall: { essential_cents: number | string; treats_cents: number | string };
  recurring: {
    essential: SubLine[];
    treats: SubLine[];
    essential_total_cents: number | string;
    treats_total_cents: number | string;
    treats_percent: number;
  };
};

function toBig(v: number | string): bigint {
  return BigInt(typeof v === "string" ? v : Math.trunc(v));
}

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const { data } = await supabase.rpc("essentials_breakdown", {
    p_year: now.getFullYear(),
    p_month: now.getMonth() + 1,
  });
  const p = (data ?? {}) as Partial<Payload>;

  const donut = [
    { name: "Essential", value: Number(p.overall?.essential_cents ?? 0) },
    { name: "Treats", value: Number(p.overall?.treats_cents ?? 0) },
  ];

  return (
    <div className="px-4 space-y-4">
      <div className="rounded-2xl bg-surface p-3 shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted mb-2">
          Essential vs treats
        </div>
        <EssentialsDonut data={donut} />
      </div>

      {p.recurring && (
        <>
          <div className="rounded-2xl bg-surface p-3 shadow-sm">
            <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted mb-1">
              Recurring · essential ({formatCAD(toBig(p.recurring.essential_total_cents)).replace("CA$", "$")})
            </div>
            <ul className="text-sm text-ink space-y-1">
              {(p.recurring.essential ?? []).map((s) => (
                <li key={s.subscription_id} className="flex justify-between">
                  <span>{s.merchant} · <span className="text-faint">{s.cadence}</span></span>
                  <span className="font-mono">{formatCAD(toBig(s.amount_cents)).replace("CA$", "$")}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-surface p-3 shadow-sm">
            <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted mb-1">
              Recurring · treats ({formatCAD(toBig(p.recurring.treats_total_cents)).replace("CA$", "$")})
              {" · "}{p.recurring.treats_percent}% of recurring
            </div>
            <ul className="text-sm text-ink space-y-1">
              {(p.recurring.treats ?? []).map((s) => (
                <li key={s.subscription_id} className="flex justify-between">
                  <span>{s.merchant} · <span className="text-faint">{s.cadence}</span></span>
                  <span className="font-mono">{formatCAD(toBig(s.amount_cents)).replace("CA$", "$")}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
