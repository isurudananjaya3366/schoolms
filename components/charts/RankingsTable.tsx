"use client";

import { Trophy } from "lucide-react";

export interface RankingEntry {
  rank: number;
  label: string;
  sublabel?: string;
  avgMark: number;
  count: number;
}

interface RankingsTableProps {
  title: string;
  rankings: RankingEntry[];
  entryLabel?: string;
  avgLabel?: string;
}

const MEDAL: Record<number, { bg: string; icon: string }> = {
  1: { bg: "bg-amber-50 dark:bg-amber-950/20", icon: "🥇" },
  2: { bg: "bg-slate-100 dark:bg-slate-800/30", icon: "🥈" },
  3: { bg: "bg-orange-50 dark:bg-orange-950/20", icon: "🥉" },
};

export default function RankingsTable({
  title,
  rankings,
  entryLabel = "Class",
  avgLabel = "Avg Mark",
}: RankingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium" colSpan={4}>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                {title}
              </div>
            </th>
          </tr>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-3 py-1.5 text-left">Rank</th>
            <th className="px-3 py-1.5 text-left">{entryLabel}</th>
            <th className="px-3 py-1.5 text-right">{avgLabel}</th>
            <th className="px-3 py-1.5 text-right">Entries</th>
          </tr>
        </thead>
        <tbody>
          {rankings.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-6 text-center text-muted-foreground"
              >
                No ranking data available.
              </td>
            </tr>
          ) : (
            rankings.map((entry) => {
              const medal = MEDAL[entry.rank];
              return (
                <tr
                  key={entry.rank}
                  className={`border-b last:border-b-0 transition-colors ${medal?.bg ?? "hover:bg-muted/30"}`}
                >
                  <td className="px-3 py-2 w-12">
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
                  <td className="px-3 py-2 font-medium">
                    {entry.label}
                    {entry.sublabel && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {entry.sublabel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono text-xs">
                    {Number.isInteger(entry.avgMark)
                      ? entry.avgMark.toLocaleString()
                      : entry.avgMark.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground text-xs">
                    {entry.count}
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
