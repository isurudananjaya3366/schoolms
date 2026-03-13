"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export interface StudentRankingEntry {
  rank: number;
  studentId: string;
  name: string;
  indexNumber: string;
  classLabel: string;
  totalMarks: number;
  avgMark: number;
  profileUrl?: string;
}

interface StudentRankingsTableProps {
  title: string;
  rankings: StudentRankingEntry[];
}

const MEDAL: Record<number, { bg: string; icon: string }> = {
  1: { bg: "bg-amber-50 dark:bg-amber-950/20", icon: "🥇" },
  2: { bg: "bg-slate-100 dark:bg-slate-800/30", icon: "🥈" },
  3: { bg: "bg-orange-50 dark:bg-orange-950/20", icon: "🥉" },
};

export default function StudentRankingsTable({
  title,
  rankings,
}: StudentRankingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium" colSpan={5}>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                {title}
              </div>
            </th>
          </tr>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-3 py-1.5 text-left">Rank</th>
            <th className="px-3 py-1.5 text-left">Index No.</th>
            <th className="px-3 py-1.5 text-left">Name</th>
            <th className="px-3 py-1.5 text-left">Class</th>
            <th className="px-3 py-1.5 text-right">Total Marks</th>
          </tr>
        </thead>
        <tbody>
          {rankings.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-6 text-center text-muted-foreground"
              >
                No student ranking data available.
              </td>
            </tr>
          ) : (
            rankings.map((entry) => {
              const medal = MEDAL[entry.rank];
              return (
                <tr
                  key={entry.rank}
                  className={`border-b last:border-b-0 transition-colors ${
                    medal?.bg ?? "hover:bg-muted/30"
                  }`}
                >
                  {/* Rank / medal */}
                  <td className="px-3 py-2 w-10">
                    {medal ? (
                      <span className="text-base leading-none select-none">
                        {medal.icon}
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground font-mono text-xs">
                        {entry.rank}
                      </span>
                    )}
                  </td>

                  {/* Index number */}
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {entry.indexNumber || "—"}
                  </td>

                  {/* Name — links to profile if available */}
                  <td className="px-3 py-2 font-medium">
                    {entry.profileUrl ? (
                      <Link
                        href={entry.profileUrl}
                        className="text-blue-600 underline-offset-2 hover:underline"
                      >
                        {entry.name}
                      </Link>
                    ) : (
                      entry.name
                    )}
                  </td>

                  {/* Class label */}
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.classLabel}
                  </td>

                  {/* Total marks */}
                  <td className="px-3 py-2 text-right tabular-nums font-mono text-xs">
                    {entry.totalMarks.toLocaleString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
