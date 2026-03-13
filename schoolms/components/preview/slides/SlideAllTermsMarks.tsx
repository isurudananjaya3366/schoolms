"use client";

import { motion } from "framer-motion";
import type { EnrichedTerm } from "@/types/preview";

interface SlideAllTermsMarksProps {
  terms: EnrichedTerm[];
  focusTerm: string;
}

export default function SlideAllTermsMarks({
  terms,
  focusTerm,
}: SlideAllTermsMarksProps) {
  // All terms share the same subject list; use the first term's subjects as row headers
  const subjects = terms[0]?.subjects ?? [];

  return (
    <div className="flex flex-col h-full px-10 py-8">
      <motion.h2
        className="text-3xl font-bold mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        Term Marks
      </motion.h2>

      <motion.div
        className="flex-1 overflow-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="py-2 px-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Subject
              </th>
              {terms.map((term) => {
                const isFocus = term.termKey === focusTerm;
                return (
                  <th
                    key={term.termKey}
                    className={`py-2 px-4 text-sm font-semibold uppercase tracking-wider text-right ${
                      isFocus
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {term.termLabel}
                    {isFocus && (
                      <span className="ml-1 normal-case font-normal text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded px-1 py-0.5 align-middle">
                        focus
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject, idx) => {
              const rowHasW = terms.some(
                (t) => t.subjects[idx]?.isW,
              );
              return (
                <motion.tr
                  key={subject.key}
                  className={`border-b border-border/50 ${
                    rowHasW ? "bg-red-50 dark:bg-red-950/30" : ""
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + idx * 0.04 }}
                >
                  <td className="py-2 px-4 text-base font-medium">
                    {subject.displayName}
                  </td>
                  {terms.map((term) => {
                    const cell = term.subjects[idx];
                    const isFocus = term.termKey === focusTerm;
                    return (
                      <td
                        key={term.termKey}
                        className={`py-2 px-4 text-base text-right font-mono ${
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
    </div>
  );
}
