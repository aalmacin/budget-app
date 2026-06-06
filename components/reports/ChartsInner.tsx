import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type LinePoint = { bucket_start: string; spent_cents: number; income_cents: number };
type PiePoint = { name: string; value: number };
type DonutPoint = { name: string; value: number };

const SAGE = "#2a3d33";
const SAND = "#c9b596";
const BRICK = "#a04030";
const PALETTE = [SAGE, SAND, BRICK, "#7a8f7a", "#d4b48a", "#8a6650"];

function centsToDisplay(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function centsTooltipFormatter(value: number): string {
  const dollars = value / 100;
  return `$${dollars.toFixed(2)}`;
}

export function SpendOverTimeChartInner({ data }: { data: LinePoint[] }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="bucket_start" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={centsToDisplay} />
          <Tooltip formatter={centsTooltipFormatter} />
          <Line type="monotone" dataKey="spent_cents" name="Spent" stroke={BRICK} dot={false} />
          <Line type="monotone" dataKey="income_cents" name="Income" stroke={SAGE} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PerPersonPieInner({ data }: { data: PiePoint[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label={({ value }: { value: number }) => centsToDisplay(value)}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={centsTooltipFormatter} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EssentialsDonutInner({ data }: { data: DonutPoint[] }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? SAGE : SAND} />
            ))}
          </Pie>
          <Tooltip formatter={centsTooltipFormatter} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
