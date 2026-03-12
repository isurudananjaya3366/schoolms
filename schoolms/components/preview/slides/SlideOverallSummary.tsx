"use client";

import { motion } from "framer-motion";

interface SlideOverallSummaryProps {
  overallStats: {
    totalMarks: number;
    overallAverage: number;
    descriptor: string;
    descriptorColor: string;
    totalSubjectsRecorded: number;
  };
}

export default function SlideOverallSummary({
  overallStats,
}: SlideOverallSummaryProps) {
  const {
    totalMarks,
    overallAverage,
    descriptor,
    descriptorColor,
    totalSubjectsRecorded,
  } = overallStats;

  return (
    <div className="flex flex-col items-center justify-center h-full px-10 py-8 gap-8">
      <motion.h2
        className="text-3xl font-bold"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        Overall Summary
      </motion.h2>

      <motion.div
        className="text-6xl font-extrabold"
        style={{ color: descriptorColor }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 100 }}
      >
        {descriptor}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-4 w-full max-w-2xl">
        <motion.div
          className="flex flex-col items-center gap-2 p-6 rounded-xl border bg-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
            Total Marks
          </span>
          <span className="text-3xl font-bold">{totalMarks}</span>
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-2 p-6 rounded-xl border bg-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
            Average
          </span>
          <span className="text-3xl font-bold" style={{ color: descriptorColor }}>
            {overallAverage.toFixed(1)}%
          </span>
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-2 p-6 rounded-xl border bg-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
            Subjects Recorded
          </span>
          <span className="text-3xl font-bold">{totalSubjectsRecorded}</span>
        </motion.div>
      </div>
    </div>
  );
}
