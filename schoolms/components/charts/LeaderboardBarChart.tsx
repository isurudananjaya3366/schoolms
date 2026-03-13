"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

export interface LeaderboardBarEntry {
  rank: number;
  name: string;
  indexNumber: string;
  totalMarks: number;
  classLabel: string;
}

interface LeaderboardBarChartProps {
  data: LeaderboardBarEntry[];
  isAnimationActive?: boolean;
}

// Medal colours for top 3, then a gradient of blues
const RANK_COLORS: Record<number, string> = {
  1: "#EAB308", // gold
  2: "#94A3B8", // silver
  3: "#B45309", // bronze
};
const DEFAULT_COLOR = "#3B82F6";

function getColor(rank: number) {
  return RANK_COLORS[rank] ?? DEFAULT_COLOR;
}

// Custom Y-axis tick that truncates long names
function CustomYTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const label = payload?.value ?? "";
  const truncated = label.length > 18 ? label.slice(0, 17) + "…" : label;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="currentColor"
      className="text-muted-foreground"
      fontSize={11}
    >
      {truncated}
    </text>
  );
}

export default function LeaderboardBarChart({
  data,
  isAnimationActive = true,
}: LeaderboardBarChartProps) {
  if (!data || data.length === 0) return null;

  // Reverse so rank 1 appears at the top of the horizontal bar chart
  const chartData = [...data]
    .slice(0, 10)
    .reverse()
    .map((d) => ({
      ...d,
      label: `${d.rank}. ${d.name}`,
    }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 36)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => v.toLocaleString()}
          domain={[0, "auto"]}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tick={CustomYTick as never}
        />
        <Tooltip
          formatter={(v: number) => [v.toLocaleString(), "Total Marks"]}
          labelFormatter={(label: string) => label}
        />
        <Bar
          dataKey="totalMarks"
          isAnimationActive={isAnimationActive}
          radius={[0, 4, 4, 0]}
        >
          {chartData.map((entry) => (
            <Cell key={`cell-${entry.rank}`} fill={getColor(entry.rank)} />
          ))}
          <LabelList
            dataKey="totalMarks"
            position="right"
            formatter={(v: number) => v.toLocaleString()}
            style={{ fontSize: 11, fill: "var(--foreground)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
