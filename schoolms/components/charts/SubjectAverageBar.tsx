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
import { THRESHOLD_COLORS } from "@/lib/chartPalette";

interface SubjectAverageBarProps {
  subjectAverages: {
    subject: string;
    average: number | null;
    count: number;
  }[];
  isAnimationActive?: boolean;
}

function getBarColor(average: number | null): string {
  if (average === null) return "#d1d5db";
  if (average < 35) return THRESHOLD_COLORS.fail;
  if (average < 50) return THRESHOLD_COLORS.atRisk;
  return THRESHOLD_COLORS.pass;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { subject, average, count } = payload[0].payload;
  return (
    <div className="rounded-md border bg-white p-3 shadow-sm">
      <p className="mb-1 font-medium text-sm">{subject}</p>
      <p className="text-xs">
        Average:{" "}
        <span className="font-semibold">
          {average === null ? "—" : average.toFixed(1)}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">Students: {count}</p>
    </div>
  );
};

const renderLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (value === null || value === undefined) return null;
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      textAnchor="start"
      dominantBaseline="central"
      fontSize={11}
      fill="#374151"
    >
      {Number(value).toFixed(1)}
    </text>
  );
};

export default function SubjectAverageBar({
  subjectAverages,
  isAnimationActive = true,
}: SubjectAverageBarProps) {
  const chartHeight = Math.max(360, subjectAverages.length * 40);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={subjectAverages}
        layout="vertical"
        margin={{ top: 5, right: 50, bottom: 5, left: 10 }}
      >
        <CartesianGrid
          horizontal
          vertical={false}
          strokeDasharray="3 3"
          opacity={0.3}
        />
        <YAxis
          type="category"
          dataKey="subject"
          width={100}
          tick={{ fontSize: 12 }}
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="average"
          isAnimationActive={isAnimationActive}
          radius={[0, 4, 4, 0]}
        >
          <LabelList dataKey="average" position="right" content={renderLabel} />
          {subjectAverages.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.average)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
