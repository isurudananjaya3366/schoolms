import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { SUBJECT_KEYS, getSubjectColor, getSubjectDisplayName } from "@/lib/chartPalette";
import { applyWRule, isWMark } from "@/lib/w-rule";
import type { TermMarkData, ElectiveLabels } from "@/types/charts";
import type { PreviewData, EnrichedTerm, EnrichedSubject } from "@/types/preview";
import SlideRenderer from "@/components/preview/SlideRenderer";

const TERM_ORDER = ["TERM_1", "TERM_2", "TERM_3"] as const;
const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

function buildChartData(markRecords: any[]): TermMarkData[] {
  return TERM_ORDER.map((termKey) => {
    const record = markRecords.find((r: any) => r.term === termKey);
    const entry: TermMarkData = { term: TERM_LABELS[termKey], termKey };
    SUBJECT_KEYS.forEach((key) => {
      entry[key] = record?.marks?.[key] ?? null;
    });
    return entry;
  });
}

function getPerformanceDescriptor(avg: number): { descriptor: string; descriptorColor: string } {
  if (avg >= 80) return { descriptor: "Excellent", descriptorColor: "#16a34a" };
  if (avg >= 60) return { descriptor: "Good", descriptorColor: "#d97706" };
  if (avg >= 45) return { descriptor: "Needs Improvement", descriptorColor: "#ea580c" };
  return { descriptor: "Critical", descriptorColor: "#dc2626" };
}

export default async function PreviewStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { studentId } = await params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: true,
      markRecords: true,
    },
  });

  if (!student || student.isDeleted) {
    notFound();
  }

  // Fetch settings
  const settingsRecords = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          "school_name",
          "academic_year",
          "elective_label_I",
          "elective_label_II",
          "elective_label_III",
        ],
      },
    },
  });
  const settingsMap: Record<string, string> = {};
  for (const s of settingsRecords) settingsMap[s.key] = s.value;

  const schoolName = settingsMap["school_name"] || "SchoolMS";
  const academicYear = settingsMap["academic_year"] || new Date().getFullYear().toString();
  const electiveLabels: ElectiveLabels = {
    labelI: settingsMap["elective_label_I"] || "Category I",
    labelII: settingsMap["elective_label_II"] || "Category II",
    labelIII: settingsMap["elective_label_III"] || "Category III",
  };

  // Build enriched terms
  const enrichedTerms: EnrichedTerm[] = TERM_ORDER.map((termKey) => {
    const record = student.markRecords.find((r) => r.term === termKey);
    const marks = record?.marks as Record<string, number | null | undefined> | undefined;

    const subjects: EnrichedSubject[] = SUBJECT_KEYS.map((key) => {
      const mark = marks?.[key] ?? null;
      return {
        key,
        displayName: getSubjectDisplayName(key, electiveLabels),
        mark: mark !== undefined ? mark : null,
        display: applyWRule(mark),
        isW: isWMark(mark),
      };
    });

    const hasData = subjects.some((s) => s.mark !== null);
    return { termKey, termLabel: TERM_LABELS[termKey], subjects, hasData };
  });

  // Compute subject averages and W counts for highlights
  const subjectStats: Record<string, { total: number; count: number; wCount: number }> = {};
  for (const key of SUBJECT_KEYS) {
    subjectStats[key] = { total: 0, count: 0, wCount: 0 };
  }

  let totalMarks = 0;
  let totalSubjectsRecorded = 0;

  for (const term of enrichedTerms) {
    for (const subj of term.subjects) {
      if (subj.mark !== null) {
        subjectStats[subj.key].total += subj.mark;
        subjectStats[subj.key].count += 1;
        if (subj.isW) subjectStats[subj.key].wCount += 1;
        totalMarks += subj.mark;
        totalSubjectsRecorded += 1;
      }
    }
  }

  const overallAverage = totalSubjectsRecorded > 0 ? totalMarks / totalSubjectsRecorded : 0;
  const { descriptor, descriptorColor } = getPerformanceDescriptor(overallAverage);

  // Best & worst subjects
  let bestSubject: PreviewData["highlights"]["bestSubject"] = null;
  let worstSubject: PreviewData["highlights"]["worstSubject"] = null;
  let bestAvg = -Infinity;
  let worstAvg = Infinity;

  for (const key of SUBJECT_KEYS) {
    const stat = subjectStats[key];
    if (stat.count === 0) continue;
    const avg = stat.total / stat.count;
    const displayName = getSubjectDisplayName(key, electiveLabels);
    const color = getSubjectColor(key);

    if (avg > bestAvg) {
      bestAvg = avg;
      bestSubject = { name: displayName, average: avg, color };
    }
    if (avg < worstAvg) {
      worstAvg = avg;
      worstSubject = { name: displayName, average: avg, color, wCount: stat.wCount };
    }
  }

  // W summary
  const wEntries: PreviewData["wSummary"]["wEntries"] = [];
  for (const term of enrichedTerms) {
    for (const subj of term.subjects) {
      if (subj.isW && subj.mark !== null) {
        wEntries.push({
          termLabel: term.termLabel,
          subject: subj.displayName,
          mark: subj.mark,
        });
      }
    }
  }

  // Chart data
  const chartData = buildChartData(JSON.parse(JSON.stringify(student.markRecords)));

  // Focus term: latest term that has data
  const focusTerm =
    [...enrichedTerms].reverse().find((t) => t.hasData)?.termKey ?? "TERM_1";

  // Annual stats: only when all 3 terms have data
  const termsWithData = enrichedTerms.filter((t) => t.hasData);
  const annualStats: PreviewData["annualStats"] =
    termsWithData.length === 3
      ? {
          overallAverage,
          descriptor,
          descriptorColor,
          totalSubjectsRecorded,
          subjectAverages: SUBJECT_KEYS.filter((key) => subjectStats[key].count > 0).map((key) => ({
            name: getSubjectDisplayName(key, electiveLabels),
            average: subjectStats[key].total / subjectStats[key].count,
            color: getSubjectColor(key),
            wCount: subjectStats[key].wCount,
          })),
        }
      : null;

  // Build preview data
  const previewData: PreviewData = {
    student: {
      id: student.id,
      name: student.name,
      indexNumber: student.indexNumber ?? null,
      grade: student.class.grade,
      section: student.class.section,
      className: `${student.class.grade}${student.class.section}`,
      electives: student.electives as { categoryI: string; categoryII: string; categoryIII: string },
      scholarshipMarks: (student as { scholarshipMarks?: number | null }).scholarshipMarks ?? null,
    },
    schoolName,
    academicYear,
    electiveLabels,
    enrichedTerms,
    chartData,
    highlights: { bestSubject, worstSubject },
    wSummary: {
      hasWGrades: wEntries.length > 0,
      wEntries,
      totalWCount: wEntries.length,
    },
    overallStats: {
      totalMarks,
      overallAverage,
      descriptor,
      descriptorColor,
      totalSubjectsRecorded,
    },
    focusTerm,
    annualStats,
    ranking: null,
    termRanks: [],
  };

  // Serialize to avoid ObjectId issues
  const serialized: PreviewData = JSON.parse(JSON.stringify(previewData));

  return <SlideRenderer data={serialized} />;
}
