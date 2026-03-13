"use client";

import { motion } from "framer-motion";
import type { AnnualSubjectAverage } from "@/types/preview";

interface AnnualStats {
  overallAverage: number;
  descriptor: string;
  descriptorColor: string;
  totalSubjectsRecorded: number;
  subjectAverages: AnnualSubjectAverage[];
}

interface SlideAnnualSummaryProps {
  annualStats: AnnualStats;
  academicYear: string;
}

export default function SlideAnnualSummary({
  annualStats,
  academicYear,
}: SlideAnnualSummaryProps) {
  const {
    overallAverage,
    descriptor,
    descriptorColor,
    subjectAverages,
  } = annualStats;

  return (
    <div className="flex flex-col h-full px-10 py-8 gap-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-3xl font-bold">Annual Summary</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Overall performance across all 3 terms &middot; {academicYear}
        </p>
      </motion.div>

      {/* Top stats row */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        <motion.div
          className="flex flex-col items-center gap-1 rounded-xl border bg-card px-4 py-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Year Average
          </span>
          <span
            className="text-4xl font-extrabold"
            style={{ color: descriptorColor }}
          >
            {overallAverage.toFixed(1)}%
          </span>
        </motion.div>

        <motion.div
          className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-card px-4 py-4 col-span-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Grade
          </span>
          <span
            className="text-4xl font-extrabold"
            style={{ color: descriptorColor }}
          >
            {descriptor}
          </span>
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-1 rounded-xl border bg-card px-4 py-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Subjects
          </span>
          <span className="text-4xl font-extrabold">9</span>
        </motion.div>
      </div>

      {/* Per-subject averages */}
      {subjectAverages.length > 0 && (
        <motion.div
          className="flex-1 overflow-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Subject Averages (across all 3 terms)
          </p>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subject
                </th>
                <th className="py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  Avg
                </th>
                <th className="py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  W Count
                </th>
              </tr>
            </thead>
            <tbody>
              {subjectAverages.map((s, idx) => (
                <motion.tr
                  key={s.name}
                  className="border-b border-border/50"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.03 }}
                >
                  <td className="py-1.5 px-3 text-sm font-medium">{s.name}</td>
                  <td
                    className="py-1.5 px-3 text-sm text-right font-mono font-semibold"
                    style={{ color: s.color }}
                  >
                    {s.average.toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-3 text-sm text-right text-muted-foreground">
                    {s.wCount > 0 ? (
                      <span className="text-red-500 font-bold">{s.wCount}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
