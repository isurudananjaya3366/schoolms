import type { TermMarkData, ElectiveLabels } from "@/types/charts";

/** Keys that identify each slide type (used for label overrides) */
export type SlideLabelKey =
  | "overview"
  | "allTermsMarks"
  | "topClass"
  | "topSection"
  | "focusChart"
  | "chart"
  | "annualSummary"
  | "highlights"
  | "wSummary"
  | "overallSummary";

/** Overrideable labels per slide type */
export type SlideLabels = Partial<Record<SlideLabelKey, string>>;

/** Default English labels (used as fallback) */
export const DEFAULT_SLIDE_LABELS: Record<SlideLabelKey, string> = {
  overview: "Academic Performance",
  allTermsMarks: "Term Marks",
  topClass: "Top Performers",
  topSection: "Top Performers",
  focusChart: "Focus Term Performance",
  chart: "Performance Overview",
  annualSummary: "Annual Summary",
  highlights: "Subject Highlights",
  wSummary: "W-Grade Summary",
  overallSummary: "Overall Summary",
};

export interface RankingEntry {
  name: string;
  average: number;
  isCurrent: boolean;
}

export interface PreviewRanking {
  classRank: number | null;
  classTotal: number;
  classTop10: RankingEntry[];
  sectionRank: number | null;
  sectionTotal: number;
  sectionTop10: RankingEntry[];
}

export interface EnrichedSubject {
  key: string;
  displayName: string;
  mark: number | null;
  display: string; // "85" or "W" or "—"
  isW: boolean;
}

export interface EnrichedTerm {
  termKey: string;   // "TERM_1"
  termLabel: string; // "Term 1"
  subjects: EnrichedSubject[];
  hasData: boolean;
}

export interface AnnualSubjectAverage {
  name: string;
  average: number;
  color: string;
  wCount: number;
}

export interface PreviewData {
  student: {
    id: string;
    name: string;
    indexNumber: string | null;
    grade: number;
    section: string;
    className: string; // "10A"
    electives: { categoryI: string; categoryII: string; categoryIII: string };
  };
  schoolName: string;
  academicYear: string;
  electiveLabels: ElectiveLabels;
  enrichedTerms: EnrichedTerm[];
  chartData: TermMarkData[];
  highlights: {
    bestSubject: { name: string; average: number; color: string } | null;
    worstSubject: { name: string; average: number; color: string; wCount: number } | null;
  };
  wSummary: {
    hasWGrades: boolean;
    wEntries: { termLabel: string; subject: string; mark: number }[];
    totalWCount: number;
  };
  overallStats: {
    totalMarks: number;
    overallAverage: number;
    descriptor: string;
    descriptorColor: string;
    totalSubjectsRecorded: number;
  };
  /** The term key that overallStats and highlights are calculated from (e.g. "TERM_2") */
  focusTerm: string;
  /** Populated only when all 3 terms have data — shows year-level averages */
  annualStats: {
    overallAverage: number;
    descriptor: string;
    descriptorColor: string;
    totalSubjectsRecorded: number;
    subjectAverages: AnnualSubjectAverage[];
  } | null;
  ranking: PreviewRanking | null;
}
