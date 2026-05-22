import { centsToDollars } from "@/lib/money";

type AmountHeroProps = {
  /** Cents value. Decimal portion is rendered smaller per HIFI design. */
  cents: bigint;
  /** Label above the amount (e.g. "Amount", "Net amount"). */
  label: string;
};

/**
 * Big centered amount display used by Add Expense / Add Income screens.
 * Splits the dollar and cent portions so the cents render in a smaller,
 * fainter weight per the design.
 */
export function AmountHero({ cents, label }: AmountHeroProps) {
  const dollars = centsToDollars(cents);
  const whole = Math.trunc(dollars);
  const fraction = Math.abs(dollars - whole)
    .toFixed(2)
    .slice(2); // "00".."99"

  return (
    <div className="text-center py-3">
      <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
        {label}
      </div>
      <div className="flex items-baseline justify-center gap-1 mt-2">
        <span className="font-mono text-sm text-muted mb-3">$</span>
        <span className="font-mono text-6xl font-medium tracking-tight leading-none text-ink">
          {whole.toLocaleString("en-CA")}
        </span>
        <span className="font-mono text-3xl text-faint leading-none self-baseline">
          .{fraction}
        </span>
      </div>
    </div>
  );
}
