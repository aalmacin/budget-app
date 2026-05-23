type BarProps = {
  /** 0..1 fill ratio. Values outside are clamped. */
  value: number;
  /** Fill color CSS value. Defaults to sage. */
  color?: string;
  /** Track color CSS value. Defaults to ring-bg. */
  track?: string;
  /** Height in px. */
  height?: number;
};

export function Bar({
  value,
  color = "var(--color-sage)",
  track = "var(--color-ring-bg)",
  height = 6,
}: BarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      style={{ height, background: track, borderRadius: 999 }}
      className="overflow-hidden"
    >
      <div
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}
