/**
 * HIFI design tokens — lifted from
 * `specs/001-family-budget-app/design/project/hifi-shared.jsx` and surfaced as
 * a typed const so non-Tailwind consumers (inline styles, SVG fills, Recharts
 * theme objects) can reference the same palette.
 *
 * The matching CSS custom properties + Tailwind utility classes live in
 * `app/globals.css` under the `@theme` block.
 */
export const HIFI = {
  bg: "#f4f0e6",
  surface: "#ffffff",
  surfaceWarm: "#faf6ec",
  surfaceSoft: "#efe8d6",
  ink: "#1c2622",
  ink2: "#3a4843",
  muted: "#7d8079",
  faint: "#a8a89e",
  line: "#e6dfcc",
  sage: "#2a3d33",
  sageMid: "#4a6151",
  sageSoft: "#8aa898",
  sand: "#c8a87a",
  sandLight: "#e6d4b3",
  sandSoft: "#f2ead8",
  brick: "#a8533f",
  ringBg: "#ece5d2",
} as const;

export type HifiColor = keyof typeof HIFI;
