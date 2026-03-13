"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import EditableField from "@/components/preview/EditableField";

interface SubjectHighlight {
  name: string;
  average: number;
  color: string;
  wCount?: number;
}

interface SlideSubjectHighlightsProps {
  highlights: {
    bestSubject: SubjectHighlight | null;
    worstSubject: (SubjectHighlight & { wCount: number }) | null;
  };
  focusTermLabel?: string;
}

export default function SlideSubjectHighlights({
  highlights,
  focusTermLabel,
}: SlideSubjectHighlightsProps) {
  const { bestSubject, worstSubject } = highlights;

  return (
    <div className="flex flex-col h-full px-10 py-8">
      <motion.h2
        className="text-3xl font-bold mb-1"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <EditableField labelKey="highlights" />
      </motion.h2>
      {focusTermLabel && (
        <motion.p
          className="text-sm text-muted-foreground mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          Based on {focusTermLabel} results
        </motion.p>
      )}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Best Subject */}
        <motion.div
          className="flex flex-col items-center gap-4 p-8 rounded-xl border bg-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TrendingUp className="size-10 text-green-500" />
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Best Subject
          </h3>
          {bestSubject ? (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="size-4 rounded-full inline-block"
                  style={{ backgroundColor: bestSubject.color }}
                />
                <span className="text-2xl font-bold">{bestSubject.name}</span>
              </div>
              <motion.span
                className="text-4xl font-bold"
                style={{ color: bestSubject.color }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 120 }}
              >
                {bestSubject.average.toFixed(1)}%
              </motion.span>
            </>
          ) : (
            <p className="text-muted-foreground">No data available</p>
          )}
        </motion.div>

        {/* Worst Subject */}
        <motion.div
          className="flex flex-col items-center gap-4 p-8 rounded-xl border bg-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <TrendingDown className="size-10 text-red-500" />
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Weakest Subject
          </h3>
          {worstSubject ? (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="size-4 rounded-full inline-block"
                  style={{ backgroundColor: worstSubject.color }}
                />
                <span className="text-2xl font-bold">{worstSubject.name}</span>
              </div>
              <motion.span
                className="text-4xl font-bold"
                style={{ color: worstSubject.color }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 120 }}
              >
                {worstSubject.average.toFixed(1)}%
              </motion.span>
              {worstSubject.wCount > 0 && (
                <p className="text-sm text-red-500 font-medium">
                  {worstSubject.wCount} W grade{worstSubject.wCount > 1 ? "s" : ""}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No data available</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
