export function TypePill({ type }: { type: "expense" | "income" }) {
  const cls =
    type === "income"
      ? "bg-sage/15 text-sage"
      : "bg-brick/15 text-brick";
  const label = type === "income" ? "In" : "Out";
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md ${cls}`}>
      {label}
    </span>
  );
}
