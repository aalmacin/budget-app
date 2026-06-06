"use client";

import dynamic from "next/dynamic";

/**
 * Each export is a single dynamic import of a complete chart component.
 * Recharts primitives (Line, XAxis, Pie, etc.) must live inside the loaded
 * module with their real displayNames intact — wrapping each primitive
 * individually in dynamic() gives them all displayName='LoadableComponent',
 * which breaks recharts' child-recognition logic and produces an empty SVG.
 */

export const SpendOverTimeChart = dynamic(
  () => import("./ChartsInner").then((m) => ({ default: m.SpendOverTimeChartInner })),
  { ssr: false },
);

export const PerPersonPie = dynamic(
  () => import("./ChartsInner").then((m) => ({ default: m.PerPersonPieInner })),
  { ssr: false },
);

export const EssentialsDonut = dynamic(
  () => import("./ChartsInner").then((m) => ({ default: m.EssentialsDonutInner })),
  { ssr: false },
);
