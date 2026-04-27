"use client";

import { motion } from "framer-motion";
import type { EnrichedTerm, PreviewTermRank } from "@/types/preview";
import type { TermMarkData, ElectiveLabels } from "@/types/charts";
import EditableField from "@/components/preview/EditableField";
import { StudentPerformanceBar } from "@/components/charts";

interface SlideAllTermsMarksProps {
  terms: EnrichedTerm[];
  focusTerm: string;
  scholarshipMarks?: number | null;
  termRanks?: PreviewTermRank[];
  focusChartData?: TermMarkData[];
  electiveLabels?: ElectiveLabels;
}

export default function SlideAllTermsMarks({
  terms,
  focusTerm,
  scholarshipMarks,
  termRanks = [],
  focusChartData,
  electiveLabels,
}: SlideAllTermsMarksProps) {
  // All terms share the same subject list; use the first term's subjects as row headers
  const subjects = terms[0]?.subjects ?? [];
  // Only show term ranks for terms that have data
  const visibleTermRanks = termRanks.filter((tr) =>
    terms.some((t) => t.termKey === tr.termKey)
  );

  const hasChart = !!focusChartData && focusChartData.length > 0 && !!electiveLabels;
  const hasMetrics = visibleTermRanks.length > 0 || scholarshipMarks != null;

  return (
    <div className="flex flex-col h-full px-7 py-4 gap-2">
      {/* Title */}
      <motion.h2
        className="text-2xl font-bold shrink-0"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <EditableField labelKey="allTermsMarks" />
      </motion.h2>

      {/* Marks table */}
      <motion.div
        className="shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="py-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Term
              </th>
              {subjects.map((subject) => (
                <th
                  key={subject.key}
                  className="py-1 px-2 text-xs font-semibold uppercase tracking-wider text-right text-muted-foreground"
                >
                  {subject.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((term, termIdx) => {
              const isFocus = term.termKey === focusTerm;
              return (
                <motion.tr
                  key={term.termKey}
                  className="border-b border-border/50"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + termIdx * 0.06 }}
                >
                  <td
                    className={`py-1.5 px-2 text-sm font-medium whitespace-nowrap ${
                      isFocus ? "text-amber-600 dark:text-amber-400" : ""
                    }`}
                  >
                    {term.termLabel}
                    {isFocus && (
                      <span className="ml-1 normal-case font-normal text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded px-1 py-0.5 align-middle">
                        focus
                      </span>
                    )}
                  </td>
                  {subjects.map((subject, subIdx) => {
                    const cell = term.subjects[subIdx];
                    return (
                      <td
                        key={subject.key}
                        className={`py-1.5 px-2 text-sm text-right font-mono ${
                          cell?.isW
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : cell?.mark === null
                              ? "text-gray-400"
                              : isFocus
                                ? "font-semibold"
                                : ""
                        }`}
                      >
                        {cell?.display ?? "\u2014"}
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>

      {/* Metrics + Chart row: pushed to bottom */}
      {(hasMetrics || hasChart) && (
        <motion.div
          className="mt-auto flex gap-4 items-stretch"
          style={{ height: 340 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {/* Metrics column */}
          {hasMetrics && (
            <div className="flex flex-col gap-2 shrink-0 justify-center">
              {visibleTermRanks.map((tr) => {
                const isFocus = tr.termKey === focusTerm;
                return (
                  <div
                    key={tr.termKey}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                      isFocus
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${isFocus ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                        {tr.termLabel}
                        {isFocus && <span className="ml-1 normal-case font-normal text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded px-1">focus</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Class Rank</span>
                    </div>
                    {tr.classRank != null ? (
                      <span className={`text-lg font-bold tabular-nums leading-none ${isFocus ? "text-amber-700 dark:text-amber-300" : ""}`}>
                        {tr.classRank}
                        <span className="text-xs font-normal text-muted-foreground">/{tr.classTotal}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })}
              {scholarshipMarks != null && (
                <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Scholarship</span>
                    <span className="text-[10px] text-muted-foreground">/ 200</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums leading-none text-blue-700 dark:text-blue-300">
                    {scholarshipMarks}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Chart fills remaining space */}
          {hasChart && (
            <div className="flex-1 min-w-0 min-h-0">
              <StudentPerformanceBar
                data={focusChartData!}
                electiveLabels={electiveLabels!}
                isAnimationActive={true}
              />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
