type DonutProps = {
  size?: number;
  /** Ratios of the donut. Should sum to ≤ 1; remainder draws the track only. */
  parts: number[];
  /** Stroke colors per part. Falls back to sage soft. */
  strokes?: string[];
  /** Track color behind the parts. */
  track?: string;
  /** Stroke thickness in viewBox units (80x80 viewBox). */
  thickness?: number;
};

/**
 * Inline-SVG donut chart. Used for the essentials/treats donut on Dashboard
 * and Budget overview. Kept as inline SVG (not Recharts) so it doesn't pull
 * the chart bundle onto the cold-load pages.
 */
export function Donut({
  size = 120,
  parts,
  strokes,
  track = "var(--color-ring-bg)",
  thickness = 14,
}: DonutProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      style={{ overflow: "visible" }}
    >
      <circle
        cx={40}
        cy={40}
        r={radius}
        fill="none"
        stroke={track}
        strokeWidth={thickness}
      />
      {parts.map((p, i) => {
        const dash = `${p * circumference} ${circumference}`;
        const offset = -accumulated * circumference;
        accumulated += p;
        return (
          <circle
            key={i}
            cx={40}
            cy={40}
            r={radius}
            fill="none"
            stroke={strokes?.[i] ?? "var(--color-sage-soft)"}
            strokeWidth={thickness}
            strokeDasharray={dash}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
        );
      })}
    </svg>
  );
}
