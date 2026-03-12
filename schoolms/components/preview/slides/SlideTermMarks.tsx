"use client";

import { motion } from "framer-motion";

interface EnrichedSubject {
  key: string;
  displayName: string;
  mark: number | null;
  display: string;
  isW: boolean;
}

interface EnrichedTerm {
  termKey: string;
  termLabel: string;
  subjects: EnrichedSubject[];
  hasData: boolean;
}

interface SlideTermMarksProps {
  enrichedTerm: EnrichedTerm;
}

export default function SlideTermMarks({ enrichedTerm }: SlideTermMarksProps) {
  return (
    <div className="flex flex-col h-full px-10 py-8">
      <motion.h2
        className="text-3xl font-bold mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        {enrichedTerm.termLabel} Marks
      </motion.h2>

      {!enrichedTerm.hasData ? (
        <motion.div
          className="flex-1 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-lg text-muted-foreground">
            No marks recorded for this term
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="flex-1 overflow-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-3 px-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Subject
                </th>
                <th className="py-3 px-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  Mark
                </th>
              </tr>
            </thead>
            <tbody>
              {enrichedTerm.subjects.map((subject, idx) => (
                <motion.tr
                  key={subject.key}
                  className={`border-b border-border/50 ${
                    subject.isW ? "bg-red-50 dark:bg-red-950/30" : ""
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + idx * 0.04 }}
                >
                  <td className="py-3 px-4 text-base font-medium">
                    {subject.displayName}
                  </td>
                  <td
                    className={`py-3 px-4 text-base text-right font-mono ${
                      subject.isW
                        ? "text-red-600 dark:text-red-400 font-bold"
                        : subject.mark === null
                          ? "text-gray-400"
                          : ""
                    }`}
                  >
                    {subject.display}
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
