"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import {
  SUBJECT_KEYS,
  W_BAR_COLOR,
  getSubjectColor,
  getSubjectDisplayName,
} from "@/lib/chartPalette";
import type { TermMarkData, ElectiveLabels } from "@/types/charts";

interface StudentPerformanceBarProps {
  data: TermMarkData[];
  electiveLabels: ElectiveLabels;
  isAnimationActive?: boolean;
}

const renderCustomLabel = (props: any, _subjectKey: string) => {
  const { x, y, width, value } = props;
  if (value === null || value === undefined) return null;
  const isW = value < 35;
  return (
    <text
      x={x + width / 2}
      y={y - 5}
      textAnchor="middle"
      fontSize={11}
      fontWeight={isW ? "bold" : "normal"}
      fill={isW ? "#dc2626" : "#374151"}
    >
      {isW ? "W" : value}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-white p-3 shadow-sm">
      <p className="mb-1 font-medium text-sm">{label}</p>
      {payload.map((entry: any) => {
        const val = entry.value;
        const isW = val !== null && val < 35;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.name}:</span>
            <span className={isW ? "font-bold text-red-600" : ""}>
              {val === null ? "-" : val}
            </span>
            <span className="text-muted-foreground">
              {val === null ? "" : isW ? "W" : "Pass"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function StudentPerformanceBar({
  data,
  electiveLabels,
  isAnimationActive = true,
}: StudentPerformanceBarProps) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="term" />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <ReferenceLine
          y={35}
          stroke="#dc2626"
          strokeDasharray="4 4"
          label={{ value: "W threshold", position: "right", fill: "#dc2626", fontSize: 12 }}
        />
        {SUBJECT_KEYS.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            name={getSubjectDisplayName(key, electiveLabels)}
            fill={getSubjectColor(key)}
            isAnimationActive={isAnimationActive}
          >
            <LabelList
              dataKey={key}
              position="top"
              content={(props: any) => renderCustomLabel(props, key)}
            />
            {data.map((entry, index) => {
              const val = entry[key] as number | null;
              return (
                <Cell
                  key={`cell-${key}-${index}`}
                  fill={val !== null && val < 35 ? W_BAR_COLOR : getSubjectColor(key)}
                />
              );
            })}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
