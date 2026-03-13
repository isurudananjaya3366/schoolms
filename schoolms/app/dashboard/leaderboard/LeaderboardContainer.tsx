"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Trophy } from "lucide-react";

import StudentRankingsTable, {
  type StudentRankingEntry,
} from "@/components/charts/StudentRankingsTable";
import LeaderboardBarChart from "@/components/charts/LeaderboardBarChart";
import RankingsTrendLine from "@/components/charts/RankingsTrendLine";

// ─── Types ────────────────────────────────────────────────

interface StudentRankRow {
  rank: number;
  studentId: string;
  name: string;
  indexNumber: string;
  classLabel: string;
  totalMarks: number;
  avgMark: number;
  count: number;
}

interface LeaderboardData {
  classStudentRankings: StudentRankRow[];
  gradeStudentRankings: StudentRankRow[];
  classTrendData: Record<string, string | number>[];
  sectionTrendData: Record<string, string | number>[];
  top5Classes: string[];
  top5Sections: string[];
}

// ─── Helpers ─────────────────────────────────────────────

function toTableEntry(s: StudentRankRow): StudentRankingEntry {
  return {
    rank: s.rank,
    studentId: s.studentId,
    name: s.name,
    indexNumber: s.indexNumber,
    classLabel: s.classLabel,
    totalMarks: s.totalMarks,
    avgMark: s.avgMark,
    profileUrl: `/dashboard/students/${s.studentId}`,
  };
}

// ─── Section card wrapper ─────────────────────────────────

function SectionCard({
  title,
  description,
  onDownload,
  disabled,
  children,
  cardRef,
}: {
  title: string;
  description: string;
  onDownload?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Card ref={cardRef}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDownload}
            disabled={disabled}
            title={`Download ${title}`}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Podium component for top 3 ───────────────────────────

function Podium({ entries }: { entries: StudentRankRow[] }) {
  const top3 = entries.slice(0, 3);

  const PODIUM_STYLES: Record<
    number,
    { border: string; badge: string; height: string; icon: string }
  > = {
    1: {
      border: "border-amber-400",
      badge: "bg-amber-400 text-white",
      height: "h-20",
      icon: "🥇",
    },
    2: {
      border: "border-slate-400",
      badge: "bg-slate-400 text-white",
      height: "h-14",
      icon: "🥈",
    },
    3: {
      border: "border-orange-400",
      badge: "bg-orange-400 text-white",
      height: "h-10",
      icon: "🥉",
    },
  };

  if (top3.length === 0) return null;

  // Reorder for visual podium: 2nd, 1st, 3rd
  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean);
  const visualRanks = [2, 1, 3];

  return (
    <div className="mb-6 flex items-end justify-center gap-4">
      {ordered.map((entry, i) => {
        const visualRank = entry.rank ?? visualRanks[i];
        const style = PODIUM_STYLES[visualRank] ?? PODIUM_STYLES[3];
        return (
          <div
            key={entry.studentId}
            className="flex flex-col items-center gap-1"
          >
            {/* Name + marks */}
            <div className="text-center">
              <p className="max-w-[110px] truncate text-xs font-semibold leading-tight">
                {entry.name}
              </p>
              <p className="text-xs text-muted-foreground">{entry.classLabel}</p>
              <p className="text-sm font-bold tabular-nums">
                {entry.totalMarks.toLocaleString()}
              </p>
            </div>
            {/* Podium block */}
            <div
              className={`flex w-24 items-start justify-center rounded-t-md border-2 pt-2 ${style.border} ${style.height} bg-muted/40`}
            >
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${style.badge}`}
              >
                {style.icon} {visualRank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Container ───────────────────────────────────────

export default function LeaderboardContainer() {
  const currentYear = new Date().getFullYear();
  const yearOptions = [
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ];

  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [term, setTerm] = useState("TERM_3");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLatestFetched, setIsLatestFetched] = useState(false);

  const classRankRef = useRef<HTMLDivElement>(null);
  const sectionRankRef = useRef<HTMLDivElement>(null);
  const classTrendRef = useRef<HTMLDivElement>(null);
  const sectionTrendRef = useRef<HTMLDivElement>(null);

  // ── Fetch latest period defaults on mount ────────────────
  useEffect(() => {
    async function fetchLatest() {
      try {
        const res = await fetch("/api/analytics/latest-period");
        if (res.ok) {
          const { latestYear, latestTerm } = await res.json();
          setYear(String(latestYear));
          setTerm(latestTerm);
        }
      } catch {
        // Use defaults
      } finally {
        setIsLatestFetched(true);
      }
    }
    fetchLatest();
  }, []);

  // ── Fetch leaderboard data ───────────────────────────────
  const fetchData = useCallback(
    async (g: string, s: string, y: string, t: string) => {
      setIsLoading(true);
      try {
        const sp = new URLSearchParams();
        if (g) sp.set("grade", g);
        if (s) sp.set("section", s);
        if (y) sp.set("year", y);
        if (t) sp.set("term", t);
        const res = await fetch(`/api/analytics/rankings?${sp.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setData(json as LeaderboardData);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Trigger fetch whenever filters or year/term change (wait for latest period)
  useEffect(() => {
    if (!isLatestFetched) return;
    fetchData(grade, section, year, term);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, section, year, term, isLatestFetched]);

  // ── PNG download helper ────────────────────────────────────
  async function downloadPNG(
    ref: React.RefObject<HTMLDivElement | null>,
    filename: string,
  ) {
    if (!ref.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(ref.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `leaderboard-${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG download error:", err);
    }
  }

  const TERM_LABELS: Record<string, string> = {
    TERM_1: "Term 1",
    TERM_2: "Term 2",
    TERM_3: "Term 3",
  };

  const classRankings = data?.classStudentRankings ?? [];
  const gradeRankings = data?.gradeStudentRankings ?? [];

  return (
    <div className="space-y-6">
      {/* ── Filters ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Year */}
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Year
              </label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Term */}
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Term
              </label>
              <Select
                value={term || "__all__"}
                onValueChange={(v) => setTerm(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Terms</SelectItem>
                  <SelectItem value="TERM_1">Term 1</SelectItem>
                  <SelectItem value="TERM_2">Term 2</SelectItem>
                  <SelectItem value="TERM_3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Grade */}
            <div className="w-32">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Grade
              </label>
              <Select
                value={grade || "__all__"}
                onValueChange={(v) => {
                  setGrade(v === "__all__" ? "" : v);
                  setSection("");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Grades</SelectItem>
                  {[6, 7, 8, 9, 10, 11].map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Class */}
            <div className="w-32">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Class
              </label>
              <Select
                value={section || "__all__"}
                onValueChange={(v) => setSection(v === "__all__" ? "" : v)}
                disabled={!grade}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Classes</SelectItem>
                  {["A", "B", "C", "D", "E", "F"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {grade ? `${grade}${s}` : `Section ${s}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Active filter badge */}
            <div className="flex items-end pb-0.5">
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                {grade
                  ? section
                    ? `${grade}${section} · ${TERM_LABELS[term] ?? "All Terms"} · ${year}`
                    : `Grade ${grade} · ${TERM_LABELS[term] ?? "All Terms"} · ${year}`
                  : `All Grades · ${TERM_LABELS[term] ?? "All Terms"} · ${year}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Prompt when no grade selected ───────────────────── */}
      {!grade && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground">
          <Trophy className="h-8 w-8 opacity-30" />
          <p className="text-sm">Select a Grade above to view rankings.</p>
        </div>
      )}

      {/* ── Rankings section (shown when grade is selected) ── */}
      {grade && (
        <>
          {/* Class Rankings ─── */}
          {section && (
            <div ref={classRankRef}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle>
                      Class Rankings — {grade}
                      {section}
                    </CardTitle>
                    <CardDescription>
                      Top 10 students in class {grade}
                      {section} for {TERM_LABELS[term] ?? "all terms"} {year}.
                      Sorted by total marks.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => downloadPNG(classRankRef, `class-${grade}${section}`)}
                    disabled={isLoading}
                    title="Download Class Rankings"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-[300px] w-full" />
                    </div>
                  ) : classRankings.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                      No data for {grade}
                      {section} in the selected period.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Podium for top 3 */}
                      <Podium entries={classRankings} />
                      {/* Table + chart side by side */}
                      <div className="grid gap-6 lg:grid-cols-2">
                        <StudentRankingsTable
                          title={`Top 10 — Class ${grade}${section}`}
                          rankings={classRankings.map(toTableEntry)}
                        />
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Total Marks Comparison
                          </p>
                          <LeaderboardBarChart
                            data={classRankings}
                            isAnimationActive={true}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Section (Grade-wide) Rankings ─── */}
          <div ref={sectionRankRef}>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle>Section Rankings — Grade {grade}</CardTitle>
                  <CardDescription>
                    Top 10 students across all sections of Grade {grade} for{" "}
                    {TERM_LABELS[term] ?? "all terms"} {year}. Sorted by total marks.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => downloadPNG(sectionRankRef, `grade-${grade}-section`)}
                  disabled={isLoading}
                  title="Download Section Rankings"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : gradeRankings.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No student data for Grade {grade} in the selected period.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Podium for top 3 */}
                    <Podium entries={gradeRankings} />
                    {/* Table + chart side by side */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      <StudentRankingsTable
                        title={`Top 10 — Grade ${grade} (All Sections)`}
                        rankings={gradeRankings.map(toTableEntry)}
                      />
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Total Marks Comparison
                        </p>
                        <LeaderboardBarChart
                          data={gradeRankings}
                          isAnimationActive={true}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trend Charts ─── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Class trend */}
            <div ref={classTrendRef}>
              <SectionCard
                title="Top Classes — Performance Trend"
                description={`Average mark per subject for the top classes in Grade ${grade} across all terms (${year}).`}
                cardRef={classTrendRef}
                onDownload={() => downloadPNG(classTrendRef, `trend-classes-grade${grade}`)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : data?.classTrendData?.length ? (
                  <RankingsTrendLine
                    trendData={data.classTrendData}
                    keys={data.top5Classes}
                    isAnimationActive={true}
                  />
                ) : (
                  <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                    No trend data available.
                  </div>
                )}
              </SectionCard>
            </div>
            {/* Section trend */}
            <div ref={sectionTrendRef}>
              <SectionCard
                title="Top Sections — Performance Trend"
                description={`Average mark per subject for the top sections in Grade ${grade} across all terms (${year}).`}
                cardRef={sectionTrendRef}
                onDownload={() =>
                  downloadPNG(sectionTrendRef, `trend-sections-grade${grade}`)
                }
                disabled={isLoading}
              >
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : data?.sectionTrendData?.length ? (
                  <RankingsTrendLine
                    trendData={data.sectionTrendData}
                    keys={data.top5Sections}
                    isAnimationActive={true}
                  />
                ) : (
                  <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                    No trend data available.
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
