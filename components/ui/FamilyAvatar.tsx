type Tone = "sage" | "sand" | "soft" | "paper";

type FamilyAvatarProps = {
  /** Single character (typically the first letter of the member's name). */
  initial: string;
  /** Pixel size. Defaults to 28 — match the design header chip. */
  size?: number;
  /** Color tone — adults default to sage, kids to sand. */
  tone?: Tone;
  /** Render the "current user" ring around the avatar. */
  ring?: boolean;
};

const PALETTE: Record<Tone, { bg: string; fg: string }> = {
  sage: { bg: "var(--color-sage)", fg: "#fff" },
  sand: { bg: "var(--color-sand)", fg: "#1c1410" },
  soft: { bg: "var(--color-sand-soft)", fg: "var(--color-ink)" },
  paper: { bg: "#fff", fg: "var(--color-ink)" },
};

export function FamilyAvatar({
  initial,
  size = 28,
  tone = "sand",
  ring = false,
}: FamilyAvatarProps) {
  const palette = PALETTE[tone];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: palette.bg,
        color: palette.fg,
        fontSize: size * 0.42,
        boxShadow: ring
          ? `0 0 0 2px var(--color-bg), 0 0 0 3.5px var(--color-sage)`
          : undefined,
      }}
      className="inline-flex items-center justify-center font-sans font-semibold tracking-tight flex-shrink-0"
      aria-hidden={initial ? undefined : true}
    >
      {initial}
    </div>
  );
}
