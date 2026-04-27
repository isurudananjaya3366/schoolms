"use client";

import { motion } from "framer-motion";
import { Medal } from "lucide-react";
import type { PreviewRanking } from "@/types/preview";
import EditableField from "@/components/preview/EditableField";

interface SlideTopSectionPerformersProps {
  ranking: PreviewRanking;
  grade: number;
}

const MEDAL_COLOR = ["text-amber-500", "text-slate-400", "text-amber-700"];

export default function SlideTopSectionPerformers({
  ranking,
  grade,
}: SlideTopSectionPerformersProps) {
  return (
    <div className="flex flex-col h-full px-10 py-8">
      <motion.h2
        className="text-3xl font-bold mb-1"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <EditableField labelKey="topSection" suffix={` \u2014 Grade ${grade} Section`} />
      </motion.h2>
      <motion.p
        className="text-sm text-muted-foreground mb-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <EditableField labelKey="topSectionDesc" variables={{ grade: String(grade) }} />{" "}
        &middot; {ranking.sectionTotal} student{ranking.sectionTotal !== 1 ? "s" : ""}
      </motion.p>

      <div className="flex gap-8 flex-1 min-h-0">
        {/* Rank badge */}
        <motion.div
          className="flex flex-col items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-700 px-8 shrink-0 min-w-36"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 200 }}
        >
          <Medal className="size-9 text-blue-500" />
          <span className="text-5xl font-black text-blue-600 dark:text-blue-400">
            #{ranking.sectionRank}
          </span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Section Rank
          </span>
          <span className="text-xs text-muted-foreground">
            of {ranking.sectionTotal}
          </span>
        </motion.div>

        {/* Top 10 list */}
        <div className="flex-1 overflow-auto space-y-1">
          {ranking.sectionTop10.map((entry, i) => (
            <motion.div
              key={`${entry.name}-${i}`}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                entry.isCurrent
                  ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600"
                  : "hover:bg-muted/40"
              }`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
            >
              <span
                className={`w-7 text-center text-sm font-bold shrink-0 ${
                  i < 3 ? MEDAL_COLOR[i] : "text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`flex-1 text-sm ${entry.isCurrent ? "font-bold" : ""}`}
              >
                {entry.name}
                {entry.isCurrent && (
                  <span className="ml-2 text-xs bg-blue-500 text-white rounded px-1.5 py-0.5">
                    You
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {entry.average.toFixed(1)}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
