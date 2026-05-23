"use client";

type Props = {
  value: number;
  onChange: (next: number) => void;
  /** When true, also renders a hidden input named `essential_pct`. */
  asFormField?: boolean;
};

const SNAPS = [0, 25, 50, 75, 100];

/**
 * 0..100 essential split slider. Snaps to 25% increments per the design.
 * Renders the current essential / treats split inline.
 */
export function SplitSlider({ value, onChange, asFormField }: Props) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between font-mono text-xs text-muted">
        <span>{clamped}% essential</span>
        <span>{100 - clamped}% treats</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={clamped}
        onChange={(e) => {
          const raw = Number(e.target.value);
          const snapped =
            SNAPS.reduce((best, s) =>
              Math.abs(s - raw) < Math.abs(best - raw) ? s : best,
            0);
          onChange(snapped);
        }}
        className="w-full"
        aria-label="Essential percent"
      />
      {asFormField && (
        <input type="hidden" name="essential_pct" value={clamped} />
      )}
    </div>
  );
}
