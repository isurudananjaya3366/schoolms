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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import SubjectAverageBar from "@/components/charts/SubjectAverageBar";
import WRateTracker from "@/components/charts/WRateTracker";
import ClassComparisonRadar from "@/components/charts/ClassComparisonRadar";
import TopBottomPerformers from "@/components/charts/TopBottomPerformers";
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
  school_logo_url: string;
}

// ─── Chart options for report modal ──────────────────────

const CHART_OPTIONS = [
  { key: "heatmap", label: "Grade Distribution Heatmap" },
  { key: "subjectAverages", label: "Subject Averages" },
  { key: "wRates", label: "W-Rate Tracker" },
  { key: "scatter", label: "Student Scatter Plot" },
  { key: "performers", label: "Top / Bottom Performers" },
  { key: "radar", label: "Class Comparison Radar" },
] as const;

type ChartKey = (typeof CHART_OPTIONS)[number]["key"];

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
  const [rankingsYear, setRankingsYear] = useState(String(new Date().getFullYear()));
  const [rankingsTerm, setRankingsTerm] = useState("TERM_3");
  const [isRankingsLoading, setIsRankingsLoading] = useState(false);

  // ── Analytics Report Modal state ────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [includeSignatures, setIncludeSignatures] = useState(false);
  const [sigPrincipalField, setSigPrincipalField] = useState(true);
  const [sigPrincipalDigital, setSigPrincipalDigital] = useState(false);
  const [sigVPField, setSigVPField] = useState(true);
  const [sigVPDigital, setSigVPDigital] = useState(false);
  const [availableSignatures, setAvailableSignatures] = useState<{
    hasPrincipal: boolean;
    hasVicePrincipal: boolean;
    principalUrl: string | null;
    vpUrl: string | null;
  }>({ hasPrincipal: false, hasVicePrincipal: false, principalUrl: null, vpUrl: null });
  const [chartInclusions, setChartInclusions] = useState<Record<ChartKey, boolean>>({
    heatmap: true,
    subjectAverages: true,
    wRates: true,
    scatter: true,
    performers: true,
    radar: true,
  });

  // ── Student Reports modal state ─────────────────────────
  const [showStudentReportsModal, setShowStudentReportsModal] = useState(false);
  const [srYear, setSrYear] = useState(String(new Date().getFullYear()));
  const [srGrade, setSrGrade] = useState("");
  const [srSection, setSrSection] = useState("");
  const [srTerm, setSrTerm] = useState("");
  const [srIsGenerating, setSrIsGenerating] = useState(false);
  const [srAvailableYears, setSrAvailableYears] = useState<number[]>([]);
  const [srSections, setSrSections] = useState<string[]>([]);
  const [srIncludeSignatures, setSrIncludeSignatures] = useState(false);
  const [srSigPrincipalField, setSrSigPrincipalField] = useState(true);
  const [srSigPrincipalDigital, setSrSigPrincipalDigital] = useState(false);
  const [srSigVPField, setSrSigVPField] = useState(true);
  const [srSigVPDigital, setSrSigVPDigital] = useState(false);

  // ── Chart refs for PNG / PDF capture ───────────────────
  const heatmapRef = useRef<HTMLDivElement>(null);
  const subjectAveragesRef = useRef<HTMLDivElement>(null);
  const wRatesRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);
  const performersRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const rankingsRef = useRef<HTMLDivElement>(null);
  const rankingsTrendRef = useRef<HTMLDivElement>(null);

  // ── Fetch latest period for rankings defaults ──────────
  useEffect(() => {
    async function fetchLatestPeriod() {
      try {
        const res = await fetch("/api/analytics/latest-period");
        if (res.ok) {
          const { latestYear, latestTerm } = await res.json();
          setRankingsYear(String(latestYear));
          setRankingsTerm(latestTerm);
        }
      } catch {
        // Keep defaults
      }
    }
    fetchLatestPeriod();
  }, []);

  // ── Fetch available signatures ─────────────────────────
  useEffect(() => {
    async function fetchSigs() {
      try {
        const res = await fetch("/api/uploads/signature");
        if (!res.ok) return;
        const { signatures } = await res.json();
        const principal = signatures.find(
          (s: { type: string; url: string }) => s.type === "principal",
        );
        const vp = signatures.find(
          (s: { type: string; url: string }) => s.type === "vice_principal",
        );
        setAvailableSignatures({
          hasPrincipal: !!principal,
          hasVicePrincipal: !!vp,
          principalUrl: principal?.url ?? null,
          vpUrl: vp?.url ?? null,
        });
      } catch {
        // ignore
      }
    }
    fetchSigs();
  }, []);

  // ── Fetch available years for Student Reports modal ────
  useEffect(() => {
    if (!showStudentReportsModal) return;
    fetch("/api/marks/years")
      .then((r) => r.json())
      .then((years: number[]) => {
        setSrAvailableYears(years);
        if (years.length > 0) setSrYear(String(years[0]));
      })
      .catch(() => {});
  }, [showStudentReportsModal]);

  // ── Fetch sections for the selected grade in SR modal ──
  useEffect(() => {
    if (!srGrade) {
      setSrSections([]);
      setSrSection("");
      return;
    }
    fetch(`/api/class-groups?grade=${srGrade}`)
      .then((r) => r.json())
      .then((groups: { section: string }[]) => {
        const secs = groups.map((g) => g.section).sort();
        setSrSections(secs);
        setSrSection("");
      })
      .catch(() => {});
  }, [srGrade]);

  // ── Download Student Reports PDF ───────────────────────
  const downloadStudentReports = async () => {
    if (!srYear) return;
    setSrIsGenerating(true);
    try {
      const res = await fetch("/api/analytics/student-reports-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: srYear,
          grade: srGrade || undefined,
          section: srSection || undefined,
          term: srTerm || undefined,
          principalField: srIncludeSignatures ? srSigPrincipalField : false,
          principalSignUrl:
            srIncludeSignatures && srSigPrincipalDigital
              ? availableSignatures.principalUrl
              : null,
          vicePrincipalField: srIncludeSignatures ? srSigVPField : false,
          vicePrincipalSignUrl:
            srIncludeSignatures && srSigVPDigital
              ? availableSignatures.vpUrl
              : null,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const { toast } = await import("sonner");
        toast.error(errBody?.error || "Failed to generate student reports");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `student-reports-${srYear}${srGrade ? `-grade${srGrade}` : ""}${srSection ? srSection : ""}${srTerm ? `-${srTerm}` : ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowStudentReportsModal(false);
    } catch (err) {
      console.error("Student reports error:", err);
      const { toast } = await import("sonner");
      toast.error("Failed to generate student reports");
    } finally {
      setSrIsGenerating(false);
    }
  };

  // Year options: fetched from DB + current calendar year as fallback
  const currentYear = new Date().getFullYear();
  const [yearOptions, setYearOptions] = useState<number[]>([
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ]);
  const [yearOptionsLoading, setYearOptionsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marks/years")
      .then((r) => r.json())
      .then((years: number[]) => {
        const merged = Array.from(new Set([...years, currentYear])).sort(
          (a, b) => b - a
        );
        if (merged.length > 0) setYearOptions(merged);
      })
      .catch(() => {})
      .finally(() => setYearOptionsLoading(false));
  // currentYear is stable (computed once), no need to re-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    async (localGrade: string, localSection: string, localYear: string, localTerm: string) => {
      setIsRankingsLoading(true);
      try {
        const sp = new URLSearchParams();
        if (localGrade) sp.set("grade", localGrade);
        if (localSection) sp.set("section", localSection);
        if (localTerm) sp.set("term", localTerm);
        if (localYear) sp.set("year", localYear);
        const res = await fetch(`/api/analytics/rankings?${sp.toString()}`);
        if (res.ok) {
          const json: RankingsData = await res.json();
          setRankingsData(json);
        }
      } catch {
        /* ignore - stale data will remain */
      } finally {
        setIsRankingsLoading(false);
      }
    },
    [],
  );

  // Auto-fetch rankings when local filters change (independent of global year/term)
  useEffect(() => {
    fetchRankings(rankingsGrade, rankingsSection, rankingsYear, rankingsTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingsGrade, rankingsSection, rankingsYear, rankingsTerm]);

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
        /* ignore - will show stale or empty data */
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

  // Rankings fetch is driven by its own useEffect above - no separate mount call needed.

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
    setShowReportModal(false);
    setIsCapturing(true);
    setIsAnimationActive(false);
    await new Promise((r) => setTimeout(r, 300));

    const chartEntries: {
      name: ChartKey;
      ref: React.RefObject<HTMLDivElement | null>;
      fallbackId: string;
      caption: string;
      hasData: boolean;
    }[] = [
      {
        name: "heatmap",
        ref: heatmapRef,
        fallbackId: "chart-heatmap",
        caption: "Grade Distribution Heatmap",
        hasData: !!(data?.heatmapData?.length),
      },
      {
        name: "subjectAverages",
        ref: subjectAveragesRef,
        fallbackId: "chart-subject-averages",
        caption: "Subject Averages",
        hasData: !!(data?.subjectAverages?.length),
      },
      {
        name: "wRates",
        ref: wRatesRef,
        fallbackId: "chart-w-rates",
        caption: "W-Rate Tracker",
        hasData: !!(wRatesAllTerms?.length),
      },
      {
        name: "scatter",
        ref: scatterRef,
        fallbackId: "chart-scatter",
        caption: "Student Scatter Plot",
        hasData: !!(data?.scatterData?.length),
      },
      {
        name: "performers",
        ref: performersRef,
        fallbackId: "chart-performers",
        caption: "Top / Bottom Performers",
        hasData: !!(data?.topPerformers?.length),
      },
      {
        name: "radar",
        ref: radarRef,
        fallbackId: "chart-radar",
        caption: "Class Comparison Radar",
        hasData: !!(data?.classComparisons),
      },
    ];

    const images: string[] = [];
    const captions: string[] = [];

    try {
      const entries = chartEntries.filter((e) => e.hasData && chartInclusions[e.name]);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setCaptureProgress(
          `Capturing chart ${i + 1} of ${entries.length}…`,
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

      const principalSignUrl =
        includeSignatures && sigPrincipalDigital
          ? availableSignatures.principalUrl
          : null;
      const vpSignUrl =
        includeSignatures && sigVPDigital
          ? availableSignatures.vpUrl
          : null;

      const res = await fetch("/api/preview/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          chartCaptions: captions,
          schoolName: settings?.school_name || "SchoolMS",
          schoolLogoUrl: settings?.school_logo_url || "",
          reportTitle: `${gradeStr} Analytics Report`,
          generatedDate: new Date().toISOString(),
          filterScope: `${gradeStr} - ${termStr} - ${year}`,
          principalField: includeSignatures && sigPrincipalField,
          principalSignUrl,
          vicePrincipalField: includeSignatures && sigVPField,
          vicePrincipalSignUrl: vpSignUrl,
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
    <>
    <div className="space-y-6">
      {/* Filters row */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-end gap-3 flex-wrap">
          {/* Grade */}
          <div className="w-40">
            <label className="mb-1 block text-sm font-medium">Grade</label>
            <Select value={grade || "__all__"} onValueChange={handleGradeChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Grades</SelectItem>
                {[10, 11].map((g) => (
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
            <Select value={year} onValueChange={handleYearChange} disabled={yearOptionsLoading}>
              <SelectTrigger>
                {yearOptionsLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <SelectValue />
                )}
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

        {/* Download buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowReportModal(true)}
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
          {/* Download Student Reports */}
          <Button
            variant="outline"
            onClick={() => setShowStudentReportsModal(true)}
            disabled={isLoading || isCapturing}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Student Reports
          </Button>
        </div>
      </div>

      {/* Row 1: Full width - Heatmap */}
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

      {/* Row 3: Full width - Scatter Plot */}
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

      {/* Row 4: Full width - Top / Bottom Performers */}
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

      {/* Row 5: Full width - Class Comparison Radar */}
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
                        {[10, 11].map((gr) => (
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
              Top 10 rankings by total marks. 1st–3rd are highlighted with medals. Defaults to the
              latest available year and term.
            </p>
          </div>
          {/* Local independent filters for the rankings section */}
          <div className="flex flex-wrap items-end gap-2">
            {/* Year */}
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Year</label>
              <Select
                value={rankingsYear}
                onValueChange={(v) => setRankingsYear(v)}
              >
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Term</label>
              <Select
                value={rankingsTerm || "__all__"}
                onValueChange={(v) => setRankingsTerm(v === "__all__" ? "" : v)}
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
                  {[10, 11].map((g) => (
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
              ? `Rankings - Class ${rankingsGrade}${rankingsSection}`
              : rankingsGrade
              ? `Rankings - Grade ${rankingsGrade}`
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
            /* No grade selected - prompt user */
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <Trophy className="h-8 w-8 opacity-30" />
              <p className="text-sm">Select a Grade and Class above to see rankings.</p>
            </div>
          ) : rankingsData ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left - Class Ranking: top 10 students in the selected class */}
              {rankingsGrade && rankingsSection ? (
                <StudentRankingsTable
                  title={`Class Ranking - Class ${rankingsGrade}${rankingsSection}`}
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
              {/* Right - Section Ranking: top 10 students across all sections in the grade */}
              <StudentRankingsTable
                title={`Section Ranking - Grade ${rankingsGrade} (All Sections)`}
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
            title="Top Classes - Performance Trend"
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
            title="Top Sections - Performance Trend"
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

    {/* ── Analytics Report Modal ──────────────────────────── */}
    <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Download Analytics Report</DialogTitle>
          <DialogDescription>
            Configure options for the PDF report before generating it.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2 pr-1">
          {/* Chart sections to include */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Charts to Include</p>
            {(() => {
              const chartHasData: Record<ChartKey, boolean> = {
                heatmap: !!(data?.heatmapData?.length),
                subjectAverages: !!(data?.subjectAverages?.length),
                wRates: !!(wRatesAllTerms?.length),
                scatter: !!(data?.scatterData?.length),
                performers: !!(data?.topPerformers?.length),
                radar: !!(data?.classComparisons),
              };
              return CHART_OPTIONS.map((opt) => (
                <div key={opt.key} className="flex items-center justify-between">
                  <Label
                    htmlFor={`chart-inc-${opt.key}`}
                    className={`text-sm ${!chartHasData[opt.key] ? "text-muted-foreground line-through" : ""}`}
                  >
                    {opt.label}
                    {!chartHasData[opt.key] && (
                      <span className="ml-1 text-xs">(no data)</span>
                    )}
                  </Label>
                  <Switch
                    id={`chart-inc-${opt.key}`}
                    checked={chartInclusions[opt.key] && chartHasData[opt.key]}
                    disabled={!chartHasData[opt.key]}
                    onCheckedChange={(v) =>
                      setChartInclusions((prev) => ({ ...prev, [opt.key]: v }))
                    }
                  />
                </div>
              ));
            })()}
          </div>

          {/* Signature toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="sig-toggle" className="font-medium">
              Include Signatures
            </Label>
            <Switch
              id="sig-toggle"
              checked={includeSignatures}
              onCheckedChange={setIncludeSignatures}
            />
          </div>

          {includeSignatures && (
            <div className="space-y-4 rounded-md border p-4">
              {/* Principal */}
              <p className="text-sm font-semibold text-muted-foreground">
                Principal
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="sig-principal-field" className="text-sm">
                  Signature field (blank line)
                </Label>
                <Switch
                  id="sig-principal-field"
                  checked={sigPrincipalField}
                  onCheckedChange={setSigPrincipalField}
                />
              </div>
              {availableSignatures.hasPrincipal && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="sig-principal-digital" className="text-sm">
                    Digital signature image
                  </Label>
                  <Switch
                    id="sig-principal-digital"
                    checked={sigPrincipalDigital}
                    onCheckedChange={setSigPrincipalDigital}
                  />
                </div>
              )}

              {/* Vice-Principal */}
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Vice Principal
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="sig-vp-field" className="text-sm">
                  Signature field (blank line)
                </Label>
                <Switch
                  id="sig-vp-field"
                  checked={sigVPField}
                  onCheckedChange={setSigVPField}
                />
              </div>
              {availableSignatures.hasVicePrincipal && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="sig-vp-digital" className="text-sm">
                    Digital signature image
                  </Label>
                  <Switch
                    id="sig-vp-digital"
                    checked={sigVPDigital}
                    onCheckedChange={setSigVPDigital}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={downloadFullReport} disabled={isCapturing}>
            {isCapturing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {captureProgress || "Generating…"}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate & Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── Student Reports Modal ────────────────────────────── */}
    <Dialog open={showStudentReportsModal} onOpenChange={setShowStudentReportsModal}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Download Student Reports</DialogTitle>
          <DialogDescription>
            Select filters to generate a landscape PDF with student marks.
            Year is the only required field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Year (required) */}
          <div className="space-y-1">
            <Label htmlFor="sr-year" className="text-sm font-medium">
              Year <span className="text-destructive">*</span>
            </Label>
            <Select value={srYear} onValueChange={setSrYear}>
              <SelectTrigger id="sr-year">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {(srAvailableYears.length > 0 ? srAvailableYears : yearOptions).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grade (optional) */}
          <div className="space-y-1">
            <Label htmlFor="sr-grade" className="text-sm font-medium">
              Grade <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Select value={srGrade || "__all__"} onValueChange={(v) => setSrGrade(v === "__all__" ? "" : v)}>
              <SelectTrigger id="sr-grade">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Grades</SelectItem>
                {[10, 11].map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Grade {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section (optional, only when grade is selected) */}
          {srGrade && (
            <div className="space-y-1">
              <Label htmlFor="sr-section" className="text-sm font-medium">
                Section <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Select
                value={srSection || "__all__"}
                onValueChange={(v) => setSrSection(v === "__all__" ? "" : v)}
              >
                <SelectTrigger id="sr-section">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Sections</SelectItem>
                  {srSections.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Term (optional) */}
          <div className="space-y-1">
            <Label htmlFor="sr-term" className="text-sm font-medium">
              Term <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Select value={srTerm || "__all__"} onValueChange={(v) => setSrTerm(v === "__all__" ? "" : v)}>
              <SelectTrigger id="sr-term">
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

          {/* Signature toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="sr-sig-toggle" className="font-medium">
              Include Signatures
            </Label>
            <Switch
              id="sr-sig-toggle"
              checked={srIncludeSignatures}
              onCheckedChange={setSrIncludeSignatures}
            />
          </div>

          {srIncludeSignatures && (
            <div className="space-y-4 rounded-md border p-4">
              {/* Principal */}
              <p className="text-sm font-semibold text-muted-foreground">Principal</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="sr-sig-principal-field" className="text-sm">
                  Signature field (blank line)
                </Label>
                <Switch
                  id="sr-sig-principal-field"
                  checked={srSigPrincipalField}
                  onCheckedChange={setSrSigPrincipalField}
                />
              </div>
              {availableSignatures.hasPrincipal && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="sr-sig-principal-digital" className="text-sm">
                    Digital signature image
                  </Label>
                  <Switch
                    id="sr-sig-principal-digital"
                    checked={srSigPrincipalDigital}
                    onCheckedChange={setSrSigPrincipalDigital}
                  />
                </div>
              )}
              {/* Vice-Principal */}
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Vice Principal
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="sr-sig-vp-field" className="text-sm">
                  Signature field (blank line)
                </Label>
                <Switch
                  id="sr-sig-vp-field"
                  checked={srSigVPField}
                  onCheckedChange={setSrSigVPField}
                />
              </div>
              {availableSignatures.hasVicePrincipal && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="sr-sig-vp-digital" className="text-sm">
                    Digital signature image
                  </Label>
                  <Switch
                    id="sr-sig-vp-digital"
                    checked={srSigVPDigital}
                    onCheckedChange={setSrSigVPDigital}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={downloadStudentReports}
            disabled={srIsGenerating || !srYear}
          >
            {srIsGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
