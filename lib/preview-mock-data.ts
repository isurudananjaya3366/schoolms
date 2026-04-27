/**
 * Mock PreviewData objects for the slide editor/configure page.
 * Each student is designed to trigger a different set of conditional slides:
 *
 * Mock 1 - ALL slides: 3 terms, classRank 2, sectionRank 4, W grades, annual stats
 * Mock 2 - No ranking slides: 3 terms, classRank 15, sectionRank 12, no W, annual stats
 * Mock 3 - Only class slide: 2 terms, classRank 3, sectionRank 16, W grades
 * Mock 4 - Only section slide: 2 terms, classRank 18, sectionRank 2, no W
 * Mock 5 - Minimal: 1 term, no rankings, no W
 */

import type { PreviewData } from "@/types/preview";

const SCHOOL = "Royal Academy";
const YEAR = "2025";

const ELECTIVE_LABELS = { labelI: "Art", labelII: "Music", labelIII: "ICT" };

const ELECTIVES = { categoryI: "Art", categoryII: "Music", categoryIII: "ICT" };

function subject(
  key: string,
  displayName: string,
  mark: number | null,
): {
  key: string;
  displayName: string;
  mark: number | null;
  display: string;
  isW: boolean;
} {
  const isW = mark !== null && mark < 35;
  const display = mark === null ? "-" : isW ? "W" : String(mark);
  return { key, displayName, mark, display, isW };
}

function makeSubjects(marks: Record<string, number | null>) {
  return [
    subject("sinhala", "Sinhala", marks.sinhala ?? null),
    subject("buddhism", "Buddhism", marks.buddhism ?? null),
    subject("maths", "Maths", marks.maths ?? null),
    subject("science", "Science", marks.science ?? null),
    subject("english", "English", marks.english ?? null),
    subject("history", "History", marks.history ?? null),
    subject("categoryI", "Art", marks.categoryI ?? null),
    subject("categoryII", "Music", marks.categoryII ?? null),
    subject("categoryIII", "ICT", marks.categoryIII ?? null),
  ];
}

function makeChartEntry(
  termKey: string,
  termLabel: string,
  marks: Record<string, number | null>,
) {
  return {
    term: termLabel,
    termKey,
    sinhala: marks.sinhala ?? null,
    buddhism: marks.buddhism ?? null,
    maths: marks.maths ?? null,
    science: marks.science ?? null,
    english: marks.english ?? null,
    history: marks.history ?? null,
    categoryI: marks.categoryI ?? null,
    categoryII: marks.categoryII ?? null,
    categoryIII: marks.categoryIII ?? null,
  };
}

// ─── Mock Student 1 - ALL slides ─────────────────────────────────────────────
// 3 terms, classRank 2, sectionRank 4, W grades, annual stats

const MOCK1_T1 = { sinhala: 78, buddhism: 85, maths: 92, science: 88, english: 30, history: 71, categoryI: 80, categoryII: 75, categoryIII: 82 };
const MOCK1_T2 = { sinhala: 82, buddhism: 88, maths: 94, science: 91, english: 34, history: 74, categoryI: 83, categoryII: 78, categoryIII: 85 };
const MOCK1_T3 = { sinhala: 85, buddhism: 90, maths: 95, science: 92, english: 36, history: 76, categoryI: 85, categoryII: 80, categoryIII: 87 };

export const mockStudent1: PreviewData = {
  student: {
    id: "mock-1",
    name: "Kavindu Perera",
    indexNumber: "2025001",
    grade: 11,
    section: "A",
    className: "11A",
    electives: ELECTIVES,
    scholarshipMarks: null,
  },
  schoolName: SCHOOL,
  academicYear: YEAR,
  electiveLabels: ELECTIVE_LABELS,
  enrichedTerms: [
    { termKey: "TERM_1", termLabel: "Term 1", subjects: makeSubjects(MOCK1_T1), hasData: true },
    { termKey: "TERM_2", termLabel: "Term 2", subjects: makeSubjects(MOCK1_T2), hasData: true },
    { termKey: "TERM_3", termLabel: "Term 3", subjects: makeSubjects(MOCK1_T3), hasData: true },
  ],
  chartData: [
    makeChartEntry("TERM_1", "Term 1", MOCK1_T1),
    makeChartEntry("TERM_2", "Term 2", MOCK1_T2),
    makeChartEntry("TERM_3", "Term 3", MOCK1_T3),
  ],
  highlights: {
    bestSubject: { name: "Maths", average: 94, color: "#3b82f6" },
    worstSubject: { name: "English", average: 33.3, color: "#f59e0b", wCount: 2 },
  },
  wSummary: {
    hasWGrades: true,
    wEntries: [
      { termLabel: "Term 1", subject: "English", mark: 30 },
      { termLabel: "Term 2", subject: "English", mark: 34 },
    ],
    totalWCount: 2,
  },
  overallStats: {
    totalMarks: 740,
    overallAverage: 82.2,
    descriptor: "Excellent",
    descriptorColor: "#16a34a",
    totalSubjectsRecorded: 9,
  },
  focusTerm: "TERM_3",
  termRanks: [
    { termKey: "TERM_1", termLabel: "Term 1", classRank: 4, classTotal: 38 },
    { termKey: "TERM_2", termLabel: "Term 2", classRank: 3, classTotal: 38 },
    { termKey: "TERM_3", termLabel: "Term 3", classRank: 2, classTotal: 38 },
  ],
  annualStats: {
    overallAverage: 82.4,
    descriptor: "Excellent",
    descriptorColor: "#16a34a",
    totalSubjectsRecorded: 9,
    subjectAverages: [
      { name: "Sinhala", average: 81.7, color: "#8b5cf6", wCount: 0 },
      { name: "Buddhism", average: 87.7, color: "#06b6d4", wCount: 0 },
      { name: "Maths", average: 93.7, color: "#3b82f6", wCount: 0 },
      { name: "Science", average: 90.3, color: "#10b981", wCount: 0 },
      { name: "English", average: 33.3, color: "#f59e0b", wCount: 2 },
      { name: "History", average: 73.7, color: "#f97316", wCount: 0 },
      { name: "Art", average: 82.7, color: "#ec4899", wCount: 0 },
      { name: "Music", average: 77.7, color: "#6366f1", wCount: 0 },
      { name: "ICT", average: 84.7, color: "#14b8a6", wCount: 0 },
    ],
  },
  ranking: {
    classRank: 2,
    classTotal: 38,
    classTop10: [
      { name: "Nimasha Fernando", average: 91.2, isCurrent: false },
      { name: "Kavindu Perera", average: 88.4, isCurrent: true },
      { name: "Dilani Jayasinghe", average: 86.7, isCurrent: false },
      { name: "Hasitha Bandara", average: 85.1, isCurrent: false },
      { name: "Tharushi Silva", average: 83.9, isCurrent: false },
      { name: "Chamara Wickrama", average: 82.4, isCurrent: false },
      { name: "Sanduni Rathnayake", average: 81.0, isCurrent: false },
      { name: "Kavindya Pathirana", average: 79.6, isCurrent: false },
      { name: "Ravindu Gunawardena", average: 78.2, isCurrent: false },
      { name: "Malsha Kumari", average: 77.5, isCurrent: false },
    ],
    sectionRank: 4,
    sectionTotal: 156,
    sectionTop10: [
      { name: "Amara Seneviratne", average: 93.1, isCurrent: false },
      { name: "Priya Liyanage", average: 91.8, isCurrent: false },
      { name: "Shehan Mendis", average: 90.4, isCurrent: false },
      { name: "Kavindu Perera", average: 88.4, isCurrent: true },
      { name: "Dinusha Ekanayake", average: 87.9, isCurrent: false },
      { name: "Thilina Rajapaksha", average: 87.0, isCurrent: false },
      { name: "Anuki Dissanayake", average: 86.3, isCurrent: false },
      { name: "Ruwan Sampath", average: 85.8, isCurrent: false },
      { name: "Chathu Mahathanthila", average: 85.1, isCurrent: false },
      { name: "Nilmini Herath", average: 84.4, isCurrent: false },
    ],
  },
};

// ─── Mock Student 2 - No ranking slides ──────────────────────────────────────
// 3 terms, classRank 15, sectionRank 12, no W, annual stats

const MOCK2_T1 = { sinhala: 60, buddhism: 65, maths: 58, science: 62, english: 55, history: 63, categoryI: 59, categoryII: 61, categoryIII: 57 };
const MOCK2_T2 = { sinhala: 62, buddhism: 67, maths: 60, science: 64, english: 57, history: 65, categoryI: 61, categoryII: 63, categoryIII: 59 };
const MOCK2_T3 = { sinhala: 64, buddhism: 69, maths: 62, science: 66, english: 59, history: 67, categoryI: 63, categoryII: 65, categoryIII: 61 };

export const mockStudent2: PreviewData = {
  student: {
    id: "mock-2",
    name: "Sanduni Rathnayake",
    indexNumber: "2025002",
    grade: 11,
    section: "B",
    className: "11B",
    electives: ELECTIVES,
    scholarshipMarks: null,
  },
  schoolName: SCHOOL,
  academicYear: YEAR,
  electiveLabels: ELECTIVE_LABELS,
  enrichedTerms: [
    { termKey: "TERM_1", termLabel: "Term 1", subjects: makeSubjects(MOCK2_T1), hasData: true },
    { termKey: "TERM_2", termLabel: "Term 2", subjects: makeSubjects(MOCK2_T2), hasData: true },
    { termKey: "TERM_3", termLabel: "Term 3", subjects: makeSubjects(MOCK2_T3), hasData: true },
  ],
  chartData: [
    makeChartEntry("TERM_1", "Term 1", MOCK2_T1),
    makeChartEntry("TERM_2", "Term 2", MOCK2_T2),
    makeChartEntry("TERM_3", "Term 3", MOCK2_T3),
  ],
  highlights: {
    bestSubject: { name: "Buddhism", average: 67, color: "#06b6d4" },
    worstSubject: { name: "English", average: 57, color: "#f59e0b", wCount: 0 },
  },
  wSummary: { hasWGrades: false, wEntries: [], totalWCount: 0 },
  overallStats: {
    totalMarks: 534,
    overallAverage: 59.3,
    descriptor: "Average",
    descriptorColor: "#f59e0b",
    totalSubjectsRecorded: 9,
  },
  focusTerm: "TERM_3",
  termRanks: [
    { termKey: "TERM_1", termLabel: "Term 1", classRank: 22, classTotal: 40 },
    { termKey: "TERM_2", termLabel: "Term 2", classRank: 18, classTotal: 40 },
    { termKey: "TERM_3", termLabel: "Term 3", classRank: 15, classTotal: 40 },
  ],
  annualStats: {
    overallAverage: 61.3,
    descriptor: "Average",
    descriptorColor: "#f59e0b",
    totalSubjectsRecorded: 9,
    subjectAverages: [
      { name: "Sinhala", average: 62, color: "#8b5cf6", wCount: 0 },
      { name: "Buddhism", average: 67, color: "#06b6d4", wCount: 0 },
      { name: "Maths", average: 60, color: "#3b82f6", wCount: 0 },
      { name: "Science", average: 64, color: "#10b981", wCount: 0 },
      { name: "English", average: 57, color: "#f59e0b", wCount: 0 },
      { name: "History", average: 65, color: "#f97316", wCount: 0 },
      { name: "Art", average: 61, color: "#ec4899", wCount: 0 },
      { name: "Music", average: 63, color: "#6366f1", wCount: 0 },
      { name: "ICT", average: 59, color: "#14b8a6", wCount: 0 },
    ],
  },
  ranking: {
    classRank: 15,
    classTotal: 40,
    classTop10: [],
    sectionRank: 62,
    sectionTotal: 160,
    sectionTop10: [],
  },
};

// ─── Mock Student 3 - Only class slide ───────────────────────────────────────
// 2 terms, classRank 3, sectionRank 16, W grades (no annual since only 2 terms)

const MOCK3_T1 = { sinhala: 88, buddhism: 90, maths: 95, science: 92, english: 72, history: 80, categoryI: 85, categoryII: 30, categoryIII: 87 };
const MOCK3_T2 = { sinhala: 90, buddhism: 92, maths: 96, science: 93, english: 74, history: 82, categoryI: 87, categoryII: 33, categoryIII: 89 };

export const mockStudent3: PreviewData = {
  student: {
    id: "mock-3",
    name: "Rishard Ahamed",
    indexNumber: "2025003",
    grade: 10,
    section: "C",
    className: "10C",
    electives: ELECTIVES,
    scholarshipMarks: null,
  },
  schoolName: SCHOOL,
  academicYear: YEAR,
  electiveLabels: ELECTIVE_LABELS,
  enrichedTerms: [
    { termKey: "TERM_1", termLabel: "Term 1", subjects: makeSubjects(MOCK3_T1), hasData: true },
    { termKey: "TERM_2", termLabel: "Term 2", subjects: makeSubjects(MOCK3_T2), hasData: true },
    { termKey: "TERM_3", termLabel: "Term 3", subjects: makeSubjects({}), hasData: false },
  ],
  chartData: [
    makeChartEntry("TERM_1", "Term 1", MOCK3_T1),
    makeChartEntry("TERM_2", "Term 2", MOCK3_T2),
  ],
  highlights: {
    bestSubject: { name: "Maths", average: 95.5, color: "#3b82f6" },
    worstSubject: { name: "Music", average: 31.5, color: "#6366f1", wCount: 2 },
  },
  wSummary: {
    hasWGrades: true,
    wEntries: [
      { termLabel: "Term 1", subject: "Music", mark: 30 },
      { termLabel: "Term 2", subject: "Music", mark: 33 },
    ],
    totalWCount: 2,
  },
  overallStats: {
    totalMarks: 748,
    overallAverage: 83.1,
    descriptor: "Excellent",
    descriptorColor: "#16a34a",
    totalSubjectsRecorded: 9,
  },
  focusTerm: "TERM_2",
  termRanks: [
    { termKey: "TERM_1", termLabel: "Term 1", classRank: 5, classTotal: 35 },
    { termKey: "TERM_2", termLabel: "Term 2", classRank: 3, classTotal: 35 },
  ],
  annualStats: null,
  ranking: {
    classRank: 3,
    classTotal: 35,
    classTop10: [
      { name: "Amara Seneviratne", average: 92.0, isCurrent: false },
      { name: "Priya Liyanage", average: 89.5, isCurrent: false },
      { name: "Rishard Ahamed", average: 87.8, isCurrent: true },
      { name: "Dilani Jayasinghe", average: 86.2, isCurrent: false },
      { name: "Tharushi Silva", average: 84.9, isCurrent: false },
      { name: "Chamara Wickrama", average: 83.5, isCurrent: false },
      { name: "Sanduni Rathnayake", average: 82.0, isCurrent: false },
      { name: "Kavindya Pathirana", average: 80.5, isCurrent: false },
      { name: "Ravindu Gunawardena", average: 79.1, isCurrent: false },
      { name: "Malsha Kumari", average: 77.8, isCurrent: false },
    ],
    sectionRank: 16,
    sectionTotal: 140,
    sectionTop10: [],
  },
};

// ─── Mock Student 4 - Only section slide ─────────────────────────────────────
// 2 terms, classRank 18, sectionRank 2, no W (no annual since only 2 terms)

const MOCK4_T1 = { sinhala: 95, buddhism: 97, maths: 98, science: 96, english: 94, history: 93, categoryI: 95, categoryII: 96, categoryIII: 97 };
const MOCK4_T2 = { sinhala: 96, buddhism: 98, maths: 99, science: 97, english: 95, history: 94, categoryI: 96, categoryII: 97, categoryIII: 98 };

export const mockStudent4: PreviewData = {
  student: {
    id: "mock-4",
    name: "Nimasha Fernando",
    indexNumber: "2025004",
    grade: 10,
    section: "A",
    className: "10A",
    electives: ELECTIVES,
    scholarshipMarks: null,
  },
  schoolName: SCHOOL,
  academicYear: YEAR,
  electiveLabels: ELECTIVE_LABELS,
  enrichedTerms: [
    { termKey: "TERM_1", termLabel: "Term 1", subjects: makeSubjects(MOCK4_T1), hasData: true },
    { termKey: "TERM_2", termLabel: "Term 2", subjects: makeSubjects(MOCK4_T2), hasData: true },
    { termKey: "TERM_3", termLabel: "Term 3", subjects: makeSubjects({}), hasData: false },
  ],
  chartData: [
    makeChartEntry("TERM_1", "Term 1", MOCK4_T1),
    makeChartEntry("TERM_2", "Term 2", MOCK4_T2),
  ],
  highlights: {
    bestSubject: { name: "Maths", average: 98.5, color: "#3b82f6" },
    worstSubject: { name: "History", average: 93.5, color: "#f97316", wCount: 0 },
  },
  wSummary: { hasWGrades: false, wEntries: [], totalWCount: 0 },
  overallStats: {
    totalMarks: 862,
    overallAverage: 95.8,
    descriptor: "Outstanding",
    descriptorColor: "#7c3aed",
    totalSubjectsRecorded: 9,
  },
  focusTerm: "TERM_2",
  termRanks: [
    { termKey: "TERM_1", termLabel: "Term 1", classRank: 20, classTotal: 36 },
    { termKey: "TERM_2", termLabel: "Term 2", classRank: 18, classTotal: 36 },
  ],
  annualStats: null,
  ranking: {
    classRank: 18,
    classTotal: 36,
    classTop10: [],
    sectionRank: 2,
    sectionTotal: 144,
    sectionTop10: [
      { name: "Tharushi Silva", average: 97.3, isCurrent: false },
      { name: "Nimasha Fernando", average: 95.8, isCurrent: true },
      { name: "Chamara Wickrama", average: 94.6, isCurrent: false },
      { name: "Sanduni Rathnayake", average: 93.9, isCurrent: false },
      { name: "Kavindya Pathirana", average: 93.2, isCurrent: false },
      { name: "Ravindu Gunawardena", average: 92.5, isCurrent: false },
      { name: "Malsha Kumari", average: 91.8, isCurrent: false },
      { name: "Hasitha Bandara", average: 91.1, isCurrent: false },
      { name: "Anuki Dissanayake", average: 90.4, isCurrent: false },
      { name: "Dinusha Ekanayake", average: 89.7, isCurrent: false },
    ],
  },
};

// ─── Mock Student 5 - Minimal slides ─────────────────────────────────────────
// 1 term, no rankings, no W

const MOCK5_T1 = { sinhala: 55, buddhism: 60, maths: 50, science: 58, english: 52, history: 56, categoryI: 54, categoryII: 57, categoryIII: 53 };

export const mockStudent5: PreviewData = {
  student: {
    id: "mock-5",
    name: "Chathu Mahathanthila",
    indexNumber: "2025005",
    grade: 10,
    section: "B",
    className: "10B",
    electives: ELECTIVES,
    scholarshipMarks: null,
  },
  schoolName: SCHOOL,
  academicYear: YEAR,
  electiveLabels: ELECTIVE_LABELS,
  enrichedTerms: [
    { termKey: "TERM_1", termLabel: "Term 1", subjects: makeSubjects(MOCK5_T1), hasData: true },
    { termKey: "TERM_2", termLabel: "Term 2", subjects: makeSubjects({}), hasData: false },
    { termKey: "TERM_3", termLabel: "Term 3", subjects: makeSubjects({}), hasData: false },
  ],
  chartData: [makeChartEntry("TERM_1", "Term 1", MOCK5_T1)],
  highlights: {
    bestSubject: { name: "Buddhism", average: 60, color: "#06b6d4" },
    worstSubject: { name: "Maths", average: 50, color: "#3b82f6", wCount: 0 },
  },
  wSummary: { hasWGrades: false, wEntries: [], totalWCount: 0 },
  overallStats: {
    totalMarks: 495,
    overallAverage: 55.0,
    descriptor: "Pass",
    descriptorColor: "#f59e0b",
    totalSubjectsRecorded: 9,
  },
  focusTerm: "TERM_1",
  termRanks: [
    { termKey: "TERM_1", termLabel: "Term 1", classRank: null, classTotal: 40 },
  ],
  annualStats: null,
  ranking: null,
};

/** All 5 mock students in order */
export const MOCK_STUDENTS: PreviewData[] = [
  mockStudent1,
  mockStudent2,
  mockStudent3,
  mockStudent4,
  mockStudent5,
];
