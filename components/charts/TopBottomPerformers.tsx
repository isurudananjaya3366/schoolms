"use client";

import Link from "next/link";
import type { PerformerEntry } from "@/app/dashboard/analytics/AnalyticsContainer";

interface TopBottomPerformersProps {
  topPerformers: PerformerEntry[];
  bottomPerformers: PerformerEntry[];
  count?: number;
}

function PerformerTable({
  title,
  performers,
  variant,
}: {
  title: string;
  performers: PerformerEntry[];
  variant: "top" | "bottom";
}) {
  return (
    <div className="flex-1 overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium" colSpan={6}>
              {title}
            </th>
          </tr>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-3 py-1.5 text-left">#</th>
            <th className="px-3 py-1.5 text-left">Index No.</th>
            <th className="px-3 py-1.5 text-left">Name</th>
            <th className="px-3 py-1.5 text-left">Class</th>
            <th className="px-3 py-1.5 text-right">Total</th>
            <th className="px-3 py-1.5 text-right">W Count</th>
          </tr>
        </thead>
        <tbody>
          {performers.map((p, idx) => {
            const rank = idx + 1;
            const isHighlight =
              (variant === "top" && rank === 1) ||
              (variant === "bottom" && rank === performers.length);

            return (
              <tr
                key={p.studentId}
                className={`border-b last:border-b-0 ${
                  isHighlight
                    ? variant === "top"
                      ? "bg-amber-50"
                      : "bg-red-50"
                    : ""
                }`}
              >
                <td className="px-3 py-2 tabular-nums">{rank}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {p.indexNumber}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={p.profileUrl}
                    className="text-blue-600 underline-offset-2 hover:underline"
                  >
                    {p.studentName}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.section}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.totalMarks}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    p.wCount > 0 ? "font-semibold text-red-600" : ""
                  }`}
                >
                  {p.wCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TopBottomPerformers({
  topPerformers,
  bottomPerformers,
  count = 5,
}: TopBottomPerformersProps) {
  const top = topPerformers.slice(0, count);
  const bottom = bottomPerformers.slice(0, count);

  return (
    <div className="flex flex-col gap-6">
      <PerformerTable title="Top Performers" performers={top} variant="top" />
      <PerformerTable
        title="Bottom Performers"
        performers={bottom}
        variant="bottom"
      />
    </div>
  );
}
