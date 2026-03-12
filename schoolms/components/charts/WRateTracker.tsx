"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { getSubjectColor } from "@/lib/chartPalette";

interface WRateTrackerProps {
  wRatesAllTerms: {
    subject: string;
    termLabel: string;
    wPercentage: number;
  }[];
  isAnimationActive?: boolean;
}

export default function WRateTracker({
  wRatesAllTerms,
  isAnimationActive = true,
}: WRateTrackerProps) {
  const { chartData, uniqueSubjects } = useMemo(() => {
    const uniqueTerms = [...new Set(wRatesAllTerms.map((d) => d.termLabel))];
    const subjects = [...new Set(wRatesAllTerms.map((d) => d.subject))];

    const data = uniqueTerms.map((term) => {
      const entry: Record<string, string | number> = { termLabel: term };
      wRatesAllTerms
        .filter((d) => d.termLabel === term)
        .forEach((d) => {
          entry[d.subject] = d.wPercentage;
        });
      return entry;
    });

    return { chartData: data, uniqueSubjects: subjects };
  }, [wRatesAllTerms]);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="termLabel" />
        <YAxis
          domain={[0, 100]}
          label={{
            value: "W Rate (%)",
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle", fontSize: 12 },
          }}
        />
        <Tooltip />
        <Legend />
        <ReferenceLine
          y={50}
          stroke="#9ca3af"
          strokeDasharray="4 4"
        />
        {uniqueSubjects.map((subject) => (
          <Line
            key={subject}
            type="monotone"
            dataKey={subject}
            stroke={getSubjectColor(subject)}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={isAnimationActive}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
