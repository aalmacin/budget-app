"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Lazy-loaded Recharts surfaces. Each is dynamic-imported with `ssr: false`
 * so the ~80 kB chart bundle is excluded from the dashboard cold load
 * (Constitution VI). All chart shells share a fixed height so SSR can reserve
 * layout space.
 */

type LinePoint = { bucket_start: string; spent_cents: number; income_cents: number };
type PiePoint = { name: string; value: number };
type DonutPoint = { name: string; value: number };

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer as unknown as ComponentType<{ width: string | number; height: string | number; children: React.ReactElement }>),
  { ssr: false },
);

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart as unknown as ComponentType<Record<string, unknown>>), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line as unknown as ComponentType<Record<string, unknown>>), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis as unknown as ComponentType<Record<string, unknown>>), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis as unknown as ComponentType<Record<string, unknown>>), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip as unknown as ComponentType<Record<string, unknown>>), { ssr: false });

const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart as unknown as ComponentType<Record<string, unknown>>), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie as unknown as ComponentType<Record<string, unknown>>), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell as unknown as ComponentType<Record<string, unknown>>), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend as unknown as ComponentType<Record<string, unknown>>), { ssr: false });

const SAGE = "#2a3d33";
const SAND = "#c9b596";
const BRICK = "#a04030";

export function SpendOverTimeChart({ data }: { data: LinePoint[] }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="bucket_start" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="spent_cents" stroke={BRICK} dot={false} />
          <Line type="monotone" dataKey="income_cents" stroke={SAGE} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const PALETTE = [SAGE, SAND, BRICK, "#7a8f7a", "#d4b48a", "#8a6650"];

export function PerPersonPie({ data }: { data: PiePoint[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EssentialsDonut({ data }: { data: DonutPoint[] }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? SAGE : SAND} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
