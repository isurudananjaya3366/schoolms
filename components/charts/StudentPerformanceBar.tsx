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

// Term opacities - same subject color per term but lighter for later terms
const TERM_OPACITIES = [1, 0.65, 0.38];

function applyOpacity(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const renderCustomLabel = (_termColor: string) => (props: any) => {
  const { x, y, width, value } = props;
  if (value === null || value === undefined) return null;
  const isW = value < 35;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fontSize={10}
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
        if (val === null || val === undefined) return null;
        const isW = val < 35;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.name}:</span>
            <span className={isW ? "font-bold text-red-600" : ""}>{val}</span>
            {isW && <span className="text-red-500">W</span>}
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
  // Reshape: group by subject, with one key per term
  const activeKeys = SUBJECT_KEYS.filter((key) =>
    data.some((row) => row[key] !== null && row[key] !== undefined)
  );

  const chartData = activeKeys.map((key) => {
    const entry: Record<string, any> = {
      subject: getSubjectDisplayName(key, electiveLabels),
      subjectKey: key,
    };
    data.forEach((row) => {
      entry[row.term] = row[key] ?? null;
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 20, bottom: 60, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="subject"
          interval={0}
          tick={{ fontSize: 11, fill: "#374151" }}
          angle={-35}
          textAnchor="end"
          height={65}
        />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="top"
          wrapperStyle={{ paddingBottom: 8 }}
          content={() => (
            <div className="flex justify-center gap-4 pb-2">
              {data.map((termRow, i) => {
                const opacity = TERM_OPACITIES[i] ?? TERM_OPACITIES[0];
                return (
                  <div key={termRow.term} className="flex items-center gap-1.5 text-xs">
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: applyOpacity("#2563eb", opacity),
                        border: "1px solid rgba(0,0,0,0.15)",
                      }}
                    />
                    <span>{termRow.term}</span>
                  </div>
                );
              })}
            </div>
          )}
        />
        <ReferenceLine
          y={35}
          stroke="#dc2626"
          strokeDasharray="4 4"
          label={{ value: "W", position: "right", fill: "#dc2626", fontSize: 12 }}
        />
        {data.map((termRow, i) => {
          const opacity = TERM_OPACITIES[i] ?? TERM_OPACITIES[0];
          return (
            <Bar
              key={termRow.term}
              dataKey={termRow.term}
              name={termRow.term}
              fill="#888"
              isAnimationActive={isAnimationActive}
            >
              <LabelList
                dataKey={termRow.term}
                position="top"
                content={renderCustomLabel("")}
              />
              {chartData.map((entry, idx) => {
                const val = entry[termRow.term] as number | null;
                const subjectColor = getSubjectColor(entry.subjectKey);
                return (
                  <Cell
                    key={`cell-${termRow.term}-${idx}`}
                    fill={
                      val !== null && val < 35
                        ? applyOpacity(W_BAR_COLOR, opacity)
                        : applyOpacity(subjectColor, opacity)
                    }
                  />
                );
              })}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
