"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, Crown, TrendingUp } from "lucide-react";
import type {
  StudentRankings,
  TermRanking,
  YearRanking,
} from "@/lib/rankings";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface RankingDisplayProps {
  studentId: string;
  year: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Return ordinal suffix string: 1→"1st", 2→"2nd", 3→"3rd", 11→"11th", etc. */
function getOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"] as const;
  const mod100 = n % 100;
  // 11, 12, 13 are special - always "th"
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${suffixes[n % 10] ?? "th"}`;
}

/** Icon + styling per rank position */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        <Trophy className="size-3.5" />
        1st
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
        <Medal className="size-3.5" />
        2nd
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
        <Award className="size-3.5" />
        3rd
      </span>
    );
  return (
    <span className="text-sm font-medium text-muted-foreground">
      {getOrdinal(rank)}
    </span>
  );
}

function RankOfTotal({ rank, total }: { rank: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RankBadge rank={rank} />
      <span className="text-xs text-muted-foreground">of {total}</span>
    </span>
  );
}

/** Row background tint for top-3 ranks (based on best rank in that term) */
function termRowClass(tr: TermRanking): string {
  const best = Math.min(tr.classRank, tr.sectionRank);
  if (best === 1) return "bg-amber-50/60";
  if (best === 2) return "bg-gray-100/50";
  if (best === 3) return "bg-orange-50/50";
  return "";
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TermRankingsTable({
  termRankings,
}: {
  termRankings: TermRanking[];
}) {
  if (termRankings.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 font-medium text-muted-foreground">
              Term
            </th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">
              Class Rank
            </th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">
              Section Rank
            </th>
            <th className="pb-2 font-medium text-muted-foreground text-right">
              Total Marks
            </th>
          </tr>
        </thead>
        <tbody>
          {termRankings.map((tr) => (
            <tr key={tr.term} className={`border-b last:border-0 ${termRowClass(tr)}`}>
              <td className="py-2.5 pr-4 font-medium">{tr.termLabel}</td>
              <td className="py-2.5 pr-4">
                <RankOfTotal rank={tr.classRank} total={tr.classTotal} />
              </td>
              <td className="py-2.5 pr-4">
                <RankOfTotal rank={tr.sectionRank} total={tr.sectionTotal} />
              </td>
              <td className="py-2.5 text-right tabular-nums font-medium">
                {tr.totalMarks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearOverview({
  yearRanking,
  className: cls,
  grade,
}: {
  yearRanking: YearRanking;
  className: string;
  grade: number;
}) {
  const isClassBest = yearRanking.classRank === 1;
  const isSectionBest = yearRanking.sectionRank === 1;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* Class rank */}
      <div
        className={`rounded-lg border p-3 ${isClassBest ? "border-amber-300 bg-amber-50/60" : ""}`}
      >
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {isClassBest ? (
            <Crown className="size-3.5 text-amber-600" />
          ) : (
            <Trophy className="size-3.5" />
          )}
          Class Rank
        </div>
        <p className="text-sm font-semibold">
          {isClassBest ? (
            <>Best Performer of {cls}</>
          ) : (
            <>
              {getOrdinal(yearRanking.classRank)} of{" "}
              {yearRanking.classTotal} in {cls}
            </>
          )}
        </p>
      </div>

      {/* Section (grade) rank */}
      <div
        className={`rounded-lg border p-3 ${isSectionBest ? "border-amber-300 bg-amber-50/60" : ""}`}
      >
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {isSectionBest ? (
            <Crown className="size-3.5 text-amber-600" />
          ) : (
            <Medal className="size-3.5" />
          )}
          Section Rank
        </div>
        <p className="text-sm font-semibold">
          {isSectionBest ? (
            <>Best of Grade {grade}</>
          ) : (
            <>
              {getOrdinal(yearRanking.sectionRank)} of{" "}
              {yearRanking.sectionTotal} in Grade {grade}
            </>
          )}
        </p>
      </div>

      {/* Average marks */}
      <div className="rounded-lg border p-3">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <TrendingUp className="size-3.5" />
          Average Marks
        </div>
        <p className="text-sm font-semibold tabular-nums">
          {yearRanking.averageMarks.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function RankingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function RankingDisplay({
  studentId,
  year,
}: RankingDisplayProps) {
  const [rankings, setRankings] = useState<StudentRankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setRankings(null);

    fetch(`/api/rankings/${studentId}?year=${year}`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data: StudentRankings) => {
        if (!cancelled) setRankings(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, year]);

  // Loading
  if (loading) return <RankingSkeleton />;

  // Error - gracefully hidden
  if (error) return null;

  // No data (student has no marks for this year)
  if (
    !rankings ||
    (rankings.termRankings.length === 0 && !rankings.yearRanking)
  )
    return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-primary" />
          Rankings - {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Term rankings table */}
        {rankings.termRankings.length > 0 && (
          <TermRankingsTable termRankings={rankings.termRankings} />
        )}

        {/* Year overall */}
        {rankings.yearRanking && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Year Overall
            </h4>
            <YearOverview
              yearRanking={rankings.yearRanking}
              className={rankings.className}
              grade={rankings.grade}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
