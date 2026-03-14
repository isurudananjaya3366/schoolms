"use client";

import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle } from "lucide-react";
import EditableField from "@/components/preview/EditableField";

interface WEntry {
  termLabel: string;
  subject: string;
  mark: number;
}

interface SlideWSummaryProps {
  wSummary: {
    hasWGrades: boolean;
    wEntries: WEntry[];
    totalWCount: number;
  };
}

export default function SlideWSummary({ wSummary }: SlideWSummaryProps) {
  const { hasWGrades, wEntries, totalWCount } = wSummary;

  if (!hasWGrades) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-10 py-8 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <CheckCircle className="size-20 text-green-500" />
        </motion.div>
        <motion.h2
          className="text-3xl font-bold text-green-600"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          No W Grades!
        </motion.h2>
        <motion.p
          className="text-lg text-muted-foreground text-center max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          This student has achieved marks above the W threshold (35) in every
          recorded subject. Excellent performance!
        </motion.p>
      </div>
    );
  }

  // Group entries by term
  const grouped = wEntries.reduce<Record<string, WEntry[]>>((acc, entry) => {
    if (!acc[entry.termLabel]) acc[entry.termLabel] = [];
    acc[entry.termLabel].push(entry);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full px-10 py-8">
      <motion.div
        className="flex items-center gap-3 mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <AlertTriangle className="size-8 text-red-500" />
        <h2 className="text-3xl font-bold">
          <EditableField labelKey="wSummary" />
          {" "}
          <span className="text-red-500 text-xl font-normal">
            ({totalWCount} total)
          </span>
        </h2>
      </motion.div>

      <div className="flex-1 overflow-auto space-y-6">
        {Object.entries(grouped).map(([termLabel, entries], groupIdx) => (
          <motion.div
            key={termLabel}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + groupIdx * 0.1 }}
          >
            <h3 className="text-lg font-semibold mb-2">{termLabel}</h3>
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div
                  key={`${termLabel}-${idx}`}
                  className="flex items-center justify-between px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                >
                  <span className="font-medium">{entry.subject}</span>
                  <span className="font-mono text-red-600 dark:text-red-400 font-bold">
                    {entry.mark} / 100
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.p
        className="mt-6 text-sm text-muted-foreground border-t pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <strong>Note:</strong>{" "}
        <EditableField labelKey="wNote" />
      </motion.p>
    </div>
  );
}
