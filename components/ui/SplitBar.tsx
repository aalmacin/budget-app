type SplitBarProps = {
  /** 0..1 — the essential portion. The treats portion = 1 - essential. */
  essential: number;
  height?: number;
};

/**
 * Two-segment bar showing essential (solid sage) vs treats (sand diagonal
 * stripes). Matches HIFI design `HFSplitBar`.
 */
export function SplitBar({ essential, height = 8 }: SplitBarProps) {
  const clamped = Math.max(0, Math.min(1, essential));
  return (
    <div
      style={{ height, background: "var(--color-ring-bg)" }}
      className="flex rounded-full overflow-hidden"
    >
      <div
        style={{ width: `${clamped * 100}%`, background: "var(--color-sage)" }}
      />
      <div
        style={{
          width: `${(1 - clamped) * 100}%`,
          background: `repeating-linear-gradient(45deg, var(--color-sand-light) 0 4px, var(--color-sand-soft) 4px 8px)`,
        }}
      />
    </div>
  );
}
