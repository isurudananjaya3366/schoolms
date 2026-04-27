"use client";

import { motion } from "framer-motion";
import { StudentPerformanceBar } from "@/components/charts";
import EditableField from "@/components/preview/EditableField";
import type { TermMarkData, ElectiveLabels } from "@/types/charts";
import type { SlideLabelKey } from "@/types/preview";

interface SlidePerformanceChartProps {
  chartData: TermMarkData[];
  electiveLabels: ElectiveLabels;
  /** Fallback title (shown when no label override exists) */
  title?: string;
  /** Label key used for EditableField (determines which label override to use) */
  labelKey?: SlideLabelKey;
}

export default function SlidePerformanceChart({
  chartData,
  electiveLabels,
  title = "Performance Overview",
  labelKey,
}: SlidePerformanceChartProps) {
  return (
    <div className="flex flex-col h-full px-10 py-8">
      <motion.h2
        className="text-3xl font-bold mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        {labelKey ? (
          <EditableField labelKey={labelKey} />
        ) : (
          title
        )}
      </motion.h2>

      <motion.div
        className="flex-1 min-h-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <StudentPerformanceBar
          data={chartData}
          electiveLabels={electiveLabels}
          isAnimationActive={true}
        />
      </motion.div>
    </div>
  );
}
