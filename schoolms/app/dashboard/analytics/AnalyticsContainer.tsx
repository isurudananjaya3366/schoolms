"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Download, Loader2, RotateCcw, Trophy } from "lucide-react";

import SubjectAverageBar from "@/components/charts/SubjectAverageBar";
import WRateTracker from "@/components/charts/WRateTracker";
import ClassComparisonRadar from "@/components/charts/ClassComparisonRadar";
import TopBottomPerformers from "@/components/charts/TopBottomPerformers";
import RankingsTable from "@/components/charts/RankingsTable";
import RankingsTrendLine from "@/components/charts/RankingsTrendLine";
import StudentRankingsTable from "@/components/charts/StudentRankingsTable";
import GradeDistributionHeatmap from "@/components/infographics/GradeDistributionHeatmap";
import StudentScatterPlot from "@/components/infographics/StudentScatterPlot";

// ─── Types ───────────────────────────────────────────────

export interface PerformerEntry {
  studentId: string;
  studentName: string;
  indexNumber: string;
  section: string;
  totalMarks: number;
  wCount: number;
  profileUrl: string;
}

export interface ScatterEntry {
  studentId: string;
  name: string;
  indexNumber: string;
  section: string;
  totalMarks: number;
  wCount: number;
  profileUrl: string;
}

export interface AnalyticsData {
  subjectAverages: {
    subject: string;
    average: number | null;
    count: number;
  }[];
  wRates: {
    subject: string;
    wRate: number;
    wCount: number;
    total: number;
  }[];
  classComparisons: {
    section: string;
    subjectAverages: { subject: string; average: number }[];
  }[];
  topPerformers: PerformerEntry[];
  bottomPerformers: PerformerEntry[];
  heatmapData: {
    subject: string;
    bands: {
      label: string;
      range: [number, number];
      count: number;
      percentage: number;
    }[];
  }[];
  scatterData: ScatterEntry[];
}

// ─── Rankings type ──────────────────────────────────────

export interface RankingsData {
  classStudentRankings: Array<{
    rank: number;
    studentId: string;
    name: string;
    indexNumber: string;
    classLabel: string;
    totalMarks: number;
    avgMark: number;
    count: number;
  }>;
  gradeStudentRankings: Array<{
    rank: number;
    studentId: string;
    name: string;
    indexNumber: string;
    classLabel: string;
    totalMarks: number;
    avgMark: number;
    count: number;
  }>;
  classRankings: Array<{
    rank: number;
    classLabel: string;
    grade: number;
    section: string;
    avgMark: number;
    count: number;
  }>;
  sectionRankings: Array<{
    rank: number;
    section: string;
    avgMark: number;
    count: number;
  }>;
  classTrendData: Record<string, string | number>[];
  sectionTrendData: Record<string, string | number>[];
  top5Classes: string[];
  top5Sections: string[];
}

// ─── Settings type ───────────────────────────────────────

interface AppSettings {
  elective_label_I: string;
  elective_label_II: string;
  elective_label_III: string;
  school_name: string;
}

// ─── WRateAllTerms type ──────────────────────────────────

interface WRateAllTermsEntry {
  subject: string;
  termLabel: string;
  wPercentage: number;
}

// ─── EmptyState ──────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-[360px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
      No data available for the current filter.
    </div>
  );
}

// ─── ChartCard ───────────────────────────────────────────

function ChartCard({
  title,
  description,
  onDownload,
  disabled,
  headerExtra,
  children,
}: {
  title: string;
  description: string;
  onDownload: () => void;
  disabled?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {headerExtra && <div className="mt-2 flex items-end gap-2">{headerExtra}</div>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDownload}
          disabled={disabled}
          title={`Download ${title} as PNG`}
        >
          <Download className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Component ───────────────────────────────────────────

interface AnalyticsContainerProps {
  initialData: AnalyticsData | null;
  initialFilters: { grade: string; term: string; year: string; section?: string };
}

export default function AnalyticsContainer({
  initialData,
  initialFilters,
}: AnalyticsContainerProps) {
  const router = useRouter();

  const [grade, setGrade] = useState(initialFilters.grade);
  const [term, setTerm] = useState(initialFilters.term);
  const [year, setYear] = useState(initialFilters.year);
  const [data, setData] = useState<AnalyticsData | null>(initialData);
  const [wRatesAllTerms, setWRatesAllTerms] = useState<
    WRateAllTermsEntry[] | null
  >(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isAnimationActive, setIsAnimationActive] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState("");
  const [section, setSection] = useState(initialFilters.section || "");
  const [radarGrade, setRadarGrade] = useState("");
  const [radarSection, setRadarSection] = useState("");
  const [rankingsData, setRankingsData] = useState<RankingsData | null>(null);
  const [rankingsGrade, setRankingsGrade] = useState("");
  const [rankingsSection, setRankingsSection] = useState("");
  const [isRankingsLoading, setIsRankingsLoading] = useState(false);

  // ── Chart refs for PNG / PDF capture ───────────────────
  const heatmapRef = useRef<HTMLDivElement>(null);
  const subjectAveragesRef = useRef<HTMLDivElement>(null);
  const wRatesRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);
  const performersRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const rankingsRef = useRef<HTMLDivElement>(null);
  const rankingsTrendRef = useRef<HTMLDivElement>(null);

  // Year options: current year and two prior
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  // ── URL sync ───────────────────────────────────────────
  const syncUrl = useCallback(
    (newGrade: string, newSection: string, newTerm: string, newYear: string) => {
      const sp = new URLSearchParams();
      if (newGrade) sp.set("grade", newGrade);
      if (newSection) sp.set("section", newSection);
      if (newTerm) sp.set("term", newTerm);
      if (newYear) sp.set("year", newYear);
      router.replace(`/dashboard/analytics?${sp.toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  // ── Fetch rankings data ────────────────────────────────
  const fetchRankings = useCallback(
    async (localGrade: string, localSection: string, globalYear: string, globalTerm: string) => {
      setIsRankingsLoading(true);
      try {
        const sp = new URLSearchParams();
        if (localGrade) sp.set("grade", localGrade);
        if (localSection) sp.set("section", localSection);
        if (globalTerm) sp.set("term", globalTerm);
        if (globalYear) sp.set("year", globalYear);
        const res = await fetch(`/api/analytics/rankings?${sp.toString()}`);
        if (res.ok) {
          const json: RankingsData = await res.json();
          setRankingsData(json);
        }
      } catch {
        /* ignore — stale data will remain */
      } finally {
        setIsRankingsLoading(false);
      }
    },
    [],
  );

  // Auto-fetch rankings when local filters or global year/term change
  useEffect(() => {
    fetchRankings(rankingsGrade, rankingsSection, year, term);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingsGrade, rankingsSection, year, term]);

  // ── Fetch data ─────────────────────────────────────────
  const fetchData = useCallback(
    async (g: string, s: string, t: string, y: string) => {
      setIsLoading(true);
      try {
        const sp = new URLSearchParams();
        if (g) sp.set("grade", g);
        if (s) sp.set("section", s);
        if (t) sp.set("term", t);
        if (y) sp.set("year", y);
        const res = await fetch(`/api/analytics/summary?${sp.toString()}`);
        if (res.ok) {
          const json: AnalyticsData = await res.json();
          setData(json);
        }
      } catch {
        /* ignore — will show stale or empty data */
      }
      setIsLoading(false);
    },
    [],
  );

  // Fetch on mount if no initial data
  useEffect(() => {
    if (!initialData) {
      fetchData(grade, section, term, year);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rankings fetch is driven by its own useEffect above — no separate mount call needed.

  // ── Fetch W-rate data for all terms ────────────────────
  useEffect(() => {
    async function fetchAllTermsWRates() {
      const terms = ["TERM_1", "TERM_2", "TERM_3"] as const;
      const termLabels: Record<string, string> = {
        TERM_1: "Term 1",
        TERM_2: "Term 2",
        TERM_3: "Term 3",
      };
      const results: WRateAllTermsEntry[] = [];
      for (const t of terms) {
        const sp = new URLSearchParams();
        if (grade) sp.set("grade", grade);
        if (section) sp.set("section", section);
        sp.set("term", t);
        if (year) sp.set("year", year);
        try {
          const res = await fetch(`/api/analytics/summary?${sp.toString()}`);
          if (res.ok) {
            const json: AnalyticsData = await res.json();
            json.wRates.forEach((wr) => {
              results.push({
                subject: wr.subject,
                termLabel: termLabels[t],
                wPercentage: wr.wRate,
              });
            });
          }
        } catch {
          /* skip term on error */
        }
      }
      setWRatesAllTerms(results);
    }
    fetchAllTermsWRates();
  }, [grade, section, year]); // re-fetch on grade/section/year change, NOT on term change

  // ── Fetch settings on mount ────────────────────────────
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSettings)
      .catch(() => {});
  }, []);

  // ── PNG download handler ───────────────────────────────
  const captureElement = async (
    el: HTMLElement,
  ): Promise<string> => {
    const { toPng } = await import("html-to-image");
    return await toPng(el, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
  };

  const downloadPNG = async (
    ref: React.RefObject<HTMLDivElement | null>,
    chartName: string,
    fallbackId?: string,
  ) => {
    const el = ref.current || (fallbackId ? document.getElementById(fallbackId) as HTMLDivElement : null);
    if (!el) return;
    setIsAnimationActive(false);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const url = await captureElement(el);
      const a = document.createElement("a");
      a.href = url;
      const gradeStr = grade ? `grade${grade}` : "all-grades";
      const termStr = term
        ? term.toLowerCase().replace("_", "")
        : "all-terms";
      a.download = `${chartName}-${gradeStr}-${termStr}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("PNG download error:", err);
      const { toast } = await import("sonner");
      toast.error("Failed to download chart image.");
    }
    setIsAnimationActive(true);
  };

  // ── Full PDF download handler ──────────────────────────
  const downloadFullReport = async () => {
    setIsCapturing(true);
    setIsAnimationActive(false);
    await new Promise((r) => setTimeout(r, 300));

    const chartEntries: { name: string; ref: React.RefObject<HTMLDivElement | null>; fallbackId: string; caption: string }[] = [
      { name: "heatmap", ref: heatmapRef, fallbackId: "chart-heatmap", caption: "Grade Distribution Heatmap" },
      { name: "subjectAverages", ref: subjectAveragesRef, fallbackId: "chart-subject-averages", caption: "Subject Averages" },
      { name: "wRates", ref: wRatesRef, fallbackId: "chart-w-rates", caption: "W-Rate Tracker" },
      { name: "scatter", ref: scatterRef, fallbackId: "chart-scatter", caption: "Student Scatter Plot" },
      { name: "performers", ref: performersRef, fallbackId: "chart-performers", caption: "Top / Bottom Performers" },
      { name: "radar", ref: radarRef, fallbackId: "chart-radar", caption: "Class Comparison Radar" },
      { name: "rankings", ref: rankingsRef, fallbackId: "chart-rankings", caption: "Class & Section Rankings" },
      { name: "rankingsTrend", ref: rankingsTrendRef, fallbackId: "chart-rankings-trend", caption: "Rankings Performance Trend" },
    ];

    const images: string[] = [];
    const captions: string[] = [];

    try {
      for (let i = 0; i < chartEntries.length; i++) {
        const entry = chartEntries[i];
        setCaptureProgress(
          `Capturing chart ${i + 1} of ${chartEntries.length}…`,
        );
        const el = entry.ref.current || document.getElementById(entry.fallbackId) as HTMLElement | null;
        if (!el) {
          console.warn(`Chart ref "${entry.name}" not found, skipping`);
          continue;
        }
        try {
          const dataUrl = await captureElement(el);
          images.push(dataUrl);
          captions.push(entry.caption);
        } catch (err) {
          console.warn(`Failed to capture chart "${entry.name}":`, err);
        }
      }

      if (images.length === 0) {
        throw new Error("No charts could be captured");
      }

      setCaptureProgress("Generating PDF…");
      const gradeStr = grade ? `Grade ${grade}` : "All Grades";
      const termStr = term ? term.replace("TERM_", "Term ") : "All Terms";

      const res = await fetch("/api/preview/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          chartCaptions: captions,
          schoolName: settings?.school_name || "School",
          reportTitle: `${gradeStr} Analytics Report`,
          generatedDate: new Date().toISOString(),
          filterScope: `${gradeStr} — ${termStr} — ${year}`,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("PDF API error:", res.status, errBody);
        throw new Error(`PDF generation failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-report-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Full report download error:", err);
      const { toast } = await import("sonner");
      toast.error(
        err instanceof Error
          ? `Report failed: ${err.message}`
          : "Failed to generate report. Please try again."
      );
    }

    setIsCapturing(false);
    setCaptureProgress("");
    setIsAnimationActive(true);
  };

  // ── Filter handlers ────────────────────────────────────
  const handleGradeChange = (v: string) => {
    const val = v === "__all__" ? "" : v;
    setGrade(val);
    setSection("");
    setRadarGrade("");
    setRadarSection("");
    syncUrl(val, "", term, year);
    fetchData(val, "", term, year);
  };

  const handleSectionChange = (v: string) => {
    const val = v === "__all__" ? "" : v;
    setSection(val);
    setRadarSection("");
    syncUrl(grade, val, term, year);
    fetchData(grade, val, term, year);
  };

  const handleTermChange = (v: string) => {
    const val = v === "__all__" ? "" : v;
    setTerm(val);
    syncUrl(grade, section, val, year);
    fetchData(grade, section, val, year);
  };

  const handleYearChange = (v: string) => {
    setYear(v);
    syncUrl(grade, section, term, v);
    fetchData(grade, section, term, v);
  };

  const handleReset = () => {
    const defaultYear = String(currentYear);
    setGrade("");
    setSection("");
    setTerm("");
    setYear(defaultYear);
    setRadarGrade("");
    setRadarSection("");
    syncUrl("", "", "", defaultYear);
    fetchData("", "", "", defaultYear);
  };

  // ── Radar local filter logic ─────────────────────────
  const filteredClassComparisons = useMemo(() => {
    if (!data?.classComparisons) return [];
    let filtered = data.classComparisons;

    // Apply local radar grade filter (only relevant when no top-level grade)
    const effectiveRadarGrade = grade || radarGrade;
    if (effectiveRadarGrade) {
      filtered = filtered.filter((c) =>
        c.section.startsWith(effectiveRadarGrade)
      );
    }

    // Apply local radar section filter
    if (radarSection) {
      filtered = filtered.filter((c) => c.section.endsWith(radarSection));
    }

    return filtered;
  }, [data?.classComparisons, grade, radarGrade, radarSection]);

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Filters row */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-3">
          {/* Grade */}
          <div className="w-40">
            <label className="mb-1 block text-sm font-medium">Grade</label>
            <Select value={grade || "__all__"} onValueChange={handleGradeChange}>
              <SelectTrigger>
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

          {/* Class (Section) */}
          <div className="w-40">
            <label className="mb-1 block text-sm font-medium">Class</label>
            <Select
              value={section || "__all__"}
              onValueChange={handleSectionChange}
              disabled={!grade}
            >
              <SelectTrigger>
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

          {/* Term */}
          <div className="w-40">
            <label className="mb-1 block text-sm font-medium">Term</label>
            <Select value={term || "__all__"} onValueChange={handleTermChange}>
              <SelectTrigger>
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

          {/* Year */}
          <div className="w-36">
            <label className="mb-1 block text-sm font-medium">Year</label>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger>
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

          {/* Reset */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isLoading}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>

        {/* Download Report */}
        <Button
          variant="outline"
          onClick={downloadFullReport}
          disabled={isLoading || isCapturing || !data}
        >
          {isCapturing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {captureProgress}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Full Analytics Report
            </>
          )}
        </Button>
      </div>

      {/* Row 1: Full width — Heatmap */}
      <div ref={heatmapRef} id="chart-heatmap">
        <ChartCard
          title="Grade Distribution Heatmap"
          description="Mark distribution across five performance bands per subject."
          onDownload={() =>
            downloadPNG(heatmapRef, "grade-distribution-heatmap", "chart-heatmap")
          }
          disabled={isLoading || isCapturing}
        >
          {isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : data?.heatmapData?.length ? (
            <GradeDistributionHeatmap heatmapData={data.heatmapData} />
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* Row 2: Subject Averages + W-Rate Tracker */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div ref={subjectAveragesRef} id="chart-subject-averages">
          <ChartCard
            title="Subject Averages"
            description="Mean marks per subject across the selected cohort."
            onDownload={() =>
              downloadPNG(subjectAveragesRef, "subject-averages", "chart-subject-averages")
            }
            disabled={isLoading || isCapturing}
          >
            {isLoading ? (
              <Skeleton className="h-[360px] w-full" />
            ) : data?.subjectAverages?.length ? (
              <SubjectAverageBar
                subjectAverages={data.subjectAverages}
                isAnimationActive={isAnimationActive}
              />
            ) : (
              <EmptyState />
            )}
          </ChartCard>
        </div>
        <div ref={wRatesRef} id="chart-w-rates">
          <ChartCard
            title="W-Rate Tracker"
            description="Percentage of students below the W threshold (&lt; 35) by subject across all terms."
            onDownload={() =>
              downloadPNG(wRatesRef, "w-rate-tracker", "chart-w-rates")
            }
            disabled={isLoading || isCapturing}
          >
            {isLoading && !wRatesAllTerms ? (
              <Skeleton className="h-[360px] w-full" />
            ) : wRatesAllTerms?.length ? (
              <WRateTracker
                wRatesAllTerms={wRatesAllTerms}
                isAnimationActive={isAnimationActive}
              />
            ) : (
              <EmptyState />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Row 3: Full width — Scatter Plot */}
      <div ref={scatterRef} id="chart-scatter">
        <ChartCard
          title="Student Scatter Plot"
          description="Total marks vs. W count for every student."
          onDownload={() =>
            downloadPNG(scatterRef, "student-scatter-plot", "chart-scatter")
          }
          disabled={isLoading || isCapturing}
        >
          {isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : data?.scatterData?.length ? (
            <div className="max-h-[500px] overflow-y-auto">
              <StudentScatterPlot scatterData={data.scatterData} />
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* Row 4: Full width — Top / Bottom Performers */}
      <div ref={performersRef} id="chart-performers">
        <ChartCard
          title="Top / Bottom Performers"
          description="Highest and lowest scoring students in the cohort."
          onDownload={() =>
            downloadPNG(performersRef, "top-bottom-performers", "chart-performers")
          }
          disabled={isLoading || isCapturing}
        >
          {isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : data?.topPerformers?.length ? (
            <TopBottomPerformers
              topPerformers={data.topPerformers}
              bottomPerformers={data.bottomPerformers}
            />
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* Row 5: Full width — Class Comparison Radar */}
      <div ref={radarRef} id="chart-radar" className="scroll-mt-4">
        <ChartCard
          title="Class Comparison Radar"
          description="Per-section subject averages overlaid for comparison."
          onDownload={() =>
            downloadPNG(radarRef, "class-comparison-radar", "chart-radar")
          }
          disabled={isLoading || isCapturing}
          headerExtra={
            !(grade && section) ? (
              <>
                {!grade && (
                  <div className="w-32">
                    <label className="mb-1 block text-xs text-muted-foreground">Grade</label>
                    <Select
                      value={radarGrade || "__all__"}
                      onValueChange={(v) => {
                        setRadarGrade(v === "__all__" ? "" : v);
                        setRadarSection("");
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Grades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Grades</SelectItem>
                        {[6, 7, 8, 9, 10, 11].map((gr) => (
                          <SelectItem key={gr} value={String(gr)}>
                            Grade {gr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(grade || radarGrade) && !section && (
                  <div className="w-32">
                    <label className="mb-1 block text-xs text-muted-foreground">Section</label>
                    <Select
                      value={radarSection || "__all__"}
                      onValueChange={(v) => setRadarSection(v === "__all__" ? "" : v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Sections</SelectItem>
                        {["A", "B", "C", "D", "E", "F"].map((s) => (
                          <SelectItem key={s} value={s}>
                            Section {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : undefined
          }
        >
          {isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : filteredClassComparisons.length ? (
            <ClassComparisonRadar
              classComparisons={filteredClassComparisons}
              isAnimationActive={isAnimationActive}
            />
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* ── Rankings Section ─────────────────────────────── */}
      <div className="pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Class &amp; Section Rankings</h2>
            <p className="text-sm text-muted-foreground">
              Top 10 rankings by average mark per subject. 1st–3rd are highlighted with medals.
            </p>
          </div>
          {/* Local per-class filter for the rankings section */}
          <div className="flex items-end gap-2">
            <div className="w-36">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Grade</label>
              <Select
                value={rankingsGrade || "__all__"}
                onValueChange={(v) => {
                  setRankingsGrade(v === "__all__" ? "" : v);
                  setRankingsSection("");
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
            <div className="w-36">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Class
              </label>
              <Select
                value={rankingsSection || "__all__"}
                onValueChange={(v) =>
                  setRankingsSection(v === "__all__" ? "" : v)
                }
                disabled={!rankingsGrade}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Classes</SelectItem>
                  {["A", "B", "C", "D", "E", "F"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {rankingsGrade ? `${rankingsGrade}${s}` : `Section ${s}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Row 6: Class & Section Rankings tables */}
      <div ref={rankingsRef} id="chart-rankings">
        <ChartCard
          title={
            rankingsGrade && rankingsSection
              ? `Rankings — Class ${rankingsGrade}${rankingsSection}`
              : rankingsGrade
              ? `Rankings — Grade ${rankingsGrade}`
              : "Class & Section Rankings"
          }
          description={
            rankingsGrade && rankingsSection
              ? `Top 10 students in class ${rankingsGrade}${rankingsSection} (by total marks) alongside section comparison.`
              : rankingsGrade
              ? `Top 10 students in Grade ${rankingsGrade} alongside class averages.`
              : "Top 10 students overall alongside top class averages. Select a grade or class for drill-down."
          }
          onDownload={() =>
            downloadPNG(rankingsRef, "rankings", "chart-rankings")
          }
          disabled={isLoading || isCapturing}
        >
          {isRankingsLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-[400px] w-full" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : !rankingsGrade ? (
            /* No grade selected — prompt user */
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <Trophy className="h-8 w-8 opacity-30" />
              <p className="text-sm">Select a Grade and Class above to see rankings.</p>
            </div>
          ) : rankingsData ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left — Class Ranking: top 10 students in the selected class */}
              {rankingsGrade && rankingsSection ? (
                <StudentRankingsTable
                  title={`Class Ranking — Class ${rankingsGrade}${rankingsSection}`}
                  rankings={rankingsData.classStudentRankings.map((s) => ({
                    rank: s.rank,
                    studentId: s.studentId,
                    name: s.name,
                    indexNumber: s.indexNumber,
                    classLabel: s.classLabel,
                    totalMarks: s.totalMarks,
                    avgMark: s.avgMark,
                    profileUrl: `/dashboard/students/${s.studentId}`,
                  }))}
                />
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-md border text-muted-foreground">
                  <Trophy className="h-6 w-6 opacity-30" />
                  <p className="text-sm">Select a specific Class for class-level ranking.</p>
                </div>
              )}
              {/* Right — Section Ranking: top 10 students across all sections in the grade */}
              <StudentRankingsTable
                title={`Section Ranking — Grade ${rankingsGrade} (All Sections)`}
                rankings={rankingsData.gradeStudentRankings.map((s) => ({
                  rank: s.rank,
                  studentId: s.studentId,
                  name: s.name,
                  indexNumber: s.indexNumber,
                  classLabel: s.classLabel,
                  totalMarks: s.totalMarks,
                  avgMark: s.avgMark,
                  profileUrl: `/dashboard/students/${s.studentId}`,
                }))}
              />
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* Row 7: Rankings trend line charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div ref={rankingsTrendRef} id="chart-rankings-trend">
          <ChartCard
            title="Top Classes — Performance Trend"
            description={
              rankingsGrade
                ? `Average mark per subject for the top classes in Grade ${rankingsGrade} across all terms.`
                : "Average mark per subject for the top 5 classes across all terms."
            }
            onDownload={() =>
              downloadPNG(
                rankingsTrendRef,
                "rankings-trend-classes",
                "chart-rankings-trend",
              )
            }
            disabled={isRankingsLoading || isCapturing}
          >
            {isRankingsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : rankingsData?.classTrendData?.length ? (
              <RankingsTrendLine
                trendData={rankingsData.classTrendData}
                keys={rankingsData.top5Classes}
                isAnimationActive={isAnimationActive}
              />
            ) : (
              <EmptyState />
            )}
          </ChartCard>
        </div>
        <div id="chart-rankings-trend-sections">
          <ChartCard
            title="Top Sections — Performance Trend"
            description={
              rankingsGrade
                ? `Average mark per subject for sections in Grade ${rankingsGrade} across all terms.`
                : "Average mark per subject for the top 5 sections across all terms."
            }
            onDownload={() =>
              downloadPNG(
                { current: document.getElementById(
                    "chart-rankings-trend-sections",
                  ) as HTMLDivElement | null },
                "rankings-trend-sections",
                "chart-rankings-trend-sections",
              )
            }
            disabled={isRankingsLoading || isCapturing}
          >
            {isRankingsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : rankingsData?.sectionTrendData?.length ? (
              <RankingsTrendLine
                trendData={rankingsData.sectionTrendData}
                keys={rankingsData.top5Sections}
                isAnimationActive={isAnimationActive}
              />
            ) : (
              <EmptyState />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
