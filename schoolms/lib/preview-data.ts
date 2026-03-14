import prisma from "@/lib/prisma";
import { SUBJECT_KEYS, getSubjectColor, getSubjectDisplayName } from "@/lib/chartPalette";
import { applyWRule, isWMark } from "@/lib/w-rule";
import type { TermMarkData, ElectiveLabels } from "@/types/charts";
import type { PreviewData, EnrichedTerm, EnrichedSubject, PreviewRanking, AnnualSubjectAverage } from "@/types/preview";

const TERM_ORDER = ["TERM_1", "TERM_2", "TERM_3"] as const;
const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

function buildChartData(
  markRecords: { term: string; marks: unknown }[],
  activeKeys: string[],
): TermMarkData[] {
  return TERM_ORDER.map((termKey) => {
    const record = markRecords.find((r) => r.term === termKey);
    const marks = record?.marks as Record<string, number | null> | undefined;
    const entry: TermMarkData = { term: TERM_LABELS[termKey], termKey };
    activeKeys.forEach((key) => {
      entry[key] = marks?.[key] ?? null;
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

/** Computes a simple average of all non-null numeric mark values across all term records. */
function computeStudentAvg(markRecords: { marks: unknown }[]): number {
  let total = 0;
  let count = 0;
  for (const rec of markRecords) {
    const marks = rec.marks as Record<string, number | null> | null;
    if (!marks) continue;
    for (const val of Object.values(marks)) {
      if (typeof val === "number" && val >= 0) {
        total += val;
        count += 1;
      }
    }
  }
  return count > 0 ? total / count : 0;
}

/**
 * Builds a full PreviewData object for a student.
 * @param year       - filter mark records to this year (optional, uses all if omitted)
 * @param focusTerm  - term key to focus highlights/overallStats on (defaults to latest available)
 */
export async function buildPreviewData(
  studentId: string,
  year?: number,
  focusTerm?: string,
): Promise<PreviewData | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      class: true,
      markRecords: year ? { where: { year } } : true,
    },
  });

  if (!student || student.isDeleted) return null;

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
  // If a specific year is selected for the presentation, show it - not the system "current year"
  const academicYear = year
    ? String(year)
    : settingsMap["academic_year"] || new Date().getFullYear().toString();
  const electiveLabels: ElectiveLabels = {
    labelI: settingsMap["elective_label_I"] || "Category I",
    labelII: settingsMap["elective_label_II"] || "Category II",
    labelIII: settingsMap["elective_label_III"] || "Category III",
  };

  // Resolve student's actual elected subject names for each elective category
  const rawElectives = student.electives as {
    categoryI?: string;
    categoryII?: string;
    categoryIII?: string;
  } | null;
  const electives = {
    categoryI: rawElectives?.categoryI?.trim() || "",
    categoryII: rawElectives?.categoryII?.trim() || "",
    categoryIII: rawElectives?.categoryIII?.trim() || "",
  };

  // Override category labels with student's actual elected subject names
  const effectiveElectiveLabels: ElectiveLabels = {
    labelI: electives.categoryI || electiveLabels.labelI,
    labelII: electives.categoryII || electiveLabels.labelII,
    labelIII: electives.categoryIII || electiveLabels.labelIII,
  };

  // Active subject keys: core subjects + only the elective categories the student elected
  const activeSubjectKeys = (SUBJECT_KEYS as readonly string[]).filter((key) => {
    if (key === "categoryI") return !!electives.categoryI;
    if (key === "categoryII") return !!electives.categoryII;
    if (key === "categoryIII") return !!electives.categoryIII;
    return true;
  });

  // Build enriched terms
  const enrichedTerms: EnrichedTerm[] = TERM_ORDER.map((termKey) => {
    const record = student.markRecords.find((r) => r.term === termKey);
    const marks = record?.marks as Record<string, number | null | undefined> | undefined;

    const subjects: EnrichedSubject[] = activeSubjectKeys.map((key) => {
      const mark = marks?.[key] ?? null;
      return {
        key,
        displayName: getSubjectDisplayName(key, effectiveElectiveLabels),
        mark: mark !== undefined ? mark : null,
        display: applyWRule(mark),
        isW: isWMark(mark),
      };
    });

    const hasData = subjects.some((s) => s.mark !== null);
    return { termKey, termLabel: TERM_LABELS[termKey], subjects, hasData };
  });

  // Compute per-subject stats across all terms (used for annual stats and rankings)
  const subjectStats: Record<string, { total: number; count: number; wCount: number }> = {};
  for (const key of activeSubjectKeys) {
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

  // Determine focus term: use provided focusTerm if it has data, else latest term with data
  const termsWithData = enrichedTerms.filter((t) => t.hasData);
  const focusTermData =
    (focusTerm ? enrichedTerms.find((t) => t.termKey === focusTerm && t.hasData) : null) ??
    termsWithData[termsWithData.length - 1] ??
    null;
  const activeFocusTermKey = focusTermData?.termKey ?? (termsWithData[0]?.termKey ?? "TERM_1");

  // Focus-term overallStats
  let focusMarks = 0;
  let focusSubjectsRecorded = 0;
  if (focusTermData) {
    for (const subj of focusTermData.subjects) {
      if (subj.mark !== null) {
        focusMarks += subj.mark;
        focusSubjectsRecorded += 1;
      }
    }
  }
  const focusAverage = focusSubjectsRecorded > 0 ? focusMarks / focusSubjectsRecorded : 0;
  const { descriptor, descriptorColor } = getPerformanceDescriptor(focusAverage);

  // Best & worst subjects (focus term only)
  let bestSubject: PreviewData["highlights"]["bestSubject"] = null;
  let worstSubject: PreviewData["highlights"]["worstSubject"] = null;
  let bestMark = -Infinity;
  let worstMark = Infinity;

  if (focusTermData) {
    for (const subj of focusTermData.subjects) {
      if (subj.mark === null) continue;
      const displayName = getSubjectDisplayName(subj.key, effectiveElectiveLabels);
      const color = getSubjectColor(subj.key);
      if (subj.mark > bestMark) {
        bestMark = subj.mark;
        bestSubject = { name: displayName, average: subj.mark, color };
      }
      if (subj.mark < worstMark) {
        worstMark = subj.mark;
        worstSubject = { name: displayName, average: subj.mark, color, wCount: subj.isW ? 1 : 0 };
      }
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

  const chartData = buildChartData(
    student.markRecords as { term: string; marks: unknown }[],
    activeSubjectKeys,
  );

  // Annual stats (only if every term has data - means a full academic year)
  const hasAllTerms = enrichedTerms.every((t) => t.hasData);
  const annualSubjectAverages: AnnualSubjectAverage[] = hasAllTerms
    ? (activeSubjectKeys
        .map((key) => {
          const stat = subjectStats[key];
          if (stat.count === 0) return null;
          return {
            name: getSubjectDisplayName(key, effectiveElectiveLabels),
            average: stat.total / stat.count,
            color: getSubjectColor(key),
            wCount: stat.wCount,
          };
        })
        .filter((s): s is AnnualSubjectAverage => s !== null))
    : [];
  const annualAverage = totalSubjectsRecorded > 0 ? totalMarks / totalSubjectsRecorded : 0;
  const annualDescriptors = getPerformanceDescriptor(annualAverage);
  const annualStats = hasAllTerms
    ? {
        overallAverage: annualAverage,
        descriptor: annualDescriptors.descriptor,
        descriptorColor: annualDescriptors.descriptorColor,
        totalSubjectsRecorded,
        subjectAverages: annualSubjectAverages,
      }
    : null;

  // Compute class and section rankings
  const [classStudents, sectionStudents] = await Promise.all([
    prisma.student.findMany({
      where: { classId: student.classId, isDeleted: false },
      select: {
        id: true,
        name: true,
        markRecords: year
          ? { where: { year }, select: { marks: true } }
          : { select: { marks: true } },
      },
    }),
    prisma.student.findMany({
      where: { class: { grade: student.class.grade }, isDeleted: false },
      select: {
        id: true,
        name: true,
        markRecords: year
          ? { where: { year }, select: { marks: true } }
          : { select: { marks: true } },
      },
    }),
  ]);

  const rankStudents = (
    students: { id: string; name: string; markRecords: { marks: unknown }[] }[],
  ) =>
    students
      .map((s) => ({ id: s.id, name: s.name, avg: computeStudentAvg(s.markRecords) }))
      .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

  const classSorted = rankStudents(classStudents);
  const sectionSorted = rankStudents(sectionStudents);
  const classRankIdx = classSorted.findIndex((s) => s.id === studentId);
  const sectionRankIdx = sectionSorted.findIndex((s) => s.id === studentId);

  const ranking: PreviewRanking = {
    classRank: classRankIdx >= 0 ? classRankIdx + 1 : null,
    classTotal: classSorted.length,
    classTop10: classSorted.slice(0, 10).map((s) => ({
      name: s.name,
      average: s.avg,
      isCurrent: s.id === studentId,
    })),
    sectionRank: sectionRankIdx >= 0 ? sectionRankIdx + 1 : null,
    sectionTotal: sectionSorted.length,
    sectionTop10: sectionSorted.slice(0, 10).map((s) => ({
      name: s.name,
      average: s.avg,
      isCurrent: s.id === studentId,
    })),
  };

  const previewData: PreviewData = {
    student: {
      id: student.id,
      name: student.name,
      indexNumber: student.indexNumber ?? null,
      grade: student.class.grade,
      section: student.class.section,
      className: `${student.class.grade}${student.class.section}`,
      electives: student.electives as {
        categoryI: string;
        categoryII: string;
        categoryIII: string;
      },
    },
    schoolName,
    academicYear,
    electiveLabels: effectiveElectiveLabels,
    enrichedTerms,
    chartData,
    highlights: { bestSubject, worstSubject },
    wSummary: {
      hasWGrades: wEntries.length > 0,
      wEntries,
      totalWCount: wEntries.length,
    },
    overallStats: {
      totalMarks: focusMarks,
      overallAverage: focusAverage,
      descriptor,
      descriptorColor,
      totalSubjectsRecorded: focusSubjectsRecorded,
    },
    focusTerm: activeFocusTermKey,
    annualStats,
    ranking,
  };

  // Serialize to remove Prisma internals / BigInt / ObjectId
  return JSON.parse(JSON.stringify(previewData));
}
