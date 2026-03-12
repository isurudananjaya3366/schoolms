"use client";

import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PALETTE } from "@/lib/chartPalette";

interface ClassComparisonRadarProps {
  classComparisons: {
    section: string;
    subjectAverages: { subject: string; average: number }[];
  }[];
  isAnimationActive?: boolean;
}

export default function ClassComparisonRadar({
  classComparisons,
  isAnimationActive = true,
}: ClassComparisonRadarProps) {
  const { chartData, sections } = useMemo(() => {
    const subjects =
      classComparisons[0]?.subjectAverages.map((s) => s.subject) || [];
    const secs = classComparisons.map((c) => c.section);

    const data = subjects.map((subj) => {
      const entry: Record<string, string | number> = { subject: subj };
      classComparisons.forEach((cl) => {
        const sa = cl.subjectAverages.find((s) => s.subject === subj);
        entry[cl.section] = sa?.average ?? 0;
      });
      return entry;
    });

    return { chartData: data, sections: secs };
  }, [classComparisons]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart outerRadius="80%" data={chartData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} />
        <Tooltip />
        <Legend />
        {sections.map((section, idx) => (
          <Radar
            key={section}
            name={section}
            dataKey={section}
            stroke={PALETTE[idx % PALETTE.length]}
            fill={PALETTE[idx % PALETTE.length]}
            fillOpacity={0.2}
            strokeWidth={2}
            isAnimationActive={isAnimationActive}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
