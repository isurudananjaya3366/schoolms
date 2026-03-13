"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PALETTE } from "@/lib/chartPalette";

interface RankingsTrendLineProps {
  /** Recharts-style data: [{ term: "Term 1", "6A": 72.5, "7B": 68.0, ... }] */
  trendData: Record<string, string | number>[];
  /** Data keys (line names) to render — must match keys in trendData */
  keys: string[];
  /** Label shown on the Y-axis */
  yAxisLabel?: string;
  isAnimationActive?: boolean;
}

export default function RankingsTrendLine({
  trendData,
  keys,
  yAxisLabel = "Avg Mark / Subject",
  isAnimationActive = true,
}: RankingsTrendLineProps) {
  const hasData = trendData.some((row) =>
    keys.some((k) => row[k] !== undefined && row[k] !== 0),
  );

  if (!hasData || keys.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No trend data available for the selected period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={trendData}
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="term" tick={{ fontSize: 12 }} />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 11 }}
          label={{
            value: yAxisLabel,
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle", fontSize: 11 },
          }}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            typeof value === "number" ? value.toFixed(2) : value,
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((key, idx) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={PALETTE[idx % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={isAnimationActive}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
