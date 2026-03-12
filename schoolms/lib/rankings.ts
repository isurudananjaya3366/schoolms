import prisma from "@/lib/prisma";
import type { Term } from "@prisma/client";

// ─── Public Interfaces ───────────────────────────────────

export interface TermRanking {
  term: "TERM_1" | "TERM_2" | "TERM_3";
  termLabel: string; // "Term 1", "Term 2", "Term 3"
  classRank: number;
  classTotal: number; // total students ranked in class for this term
  sectionRank: number;
  sectionTotal: number; // total students ranked in grade for this term
  totalMarks: number; // student's total marks this term
}

export interface YearRanking {
  classRank: number;
  classTotal: number;
  sectionRank: number;
  sectionTotal: number;
  averageMarks: number; // student's average total across all terms
}

export interface StudentRankings {
  year: number;
  className: string; // e.g., "11B"
  grade: number;
  termRankings: TermRanking[];
  yearRanking: YearRanking;
}

// ─── Helpers ─────────────────────────────────────────────

const TERM_LABELS: Record<Term, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

const TERMS: Term[] = ["TERM_1", "TERM_2", "TERM_3"];

/** Sum all 9 subject marks for a Marks object, treating null as 0. */
function sumMarks(marks: {
  sinhala?: number | null;
  buddhism?: number | null;
  maths?: number | null;
  science?: number | null;
  english?: number | null;
  history?: number | null;
  categoryI?: number | null;
  categoryII?: number | null;
  categoryIII?: number | null;
}): number {
  return (
    (marks.sinhala ?? 0) +
    (marks.buddhism ?? 0) +
    (marks.maths ?? 0) +
    (marks.science ?? 0) +
    (marks.english ?? 0) +
    (marks.history ?? 0) +
    (marks.categoryI ?? 0) +
    (marks.categoryII ?? 0) +
    (marks.categoryIII ?? 0)
  );
}

/**
 * Standard competition ranking (1, 1, 3, 4…).
 * `totals` is a descending-sorted array of totals.
 * Returns the 1-based rank for `value`.
 */
function competitionRank(totals: number[], value: number): number {
  return totals.findIndex((t) => t === value) + 1;
}

// ─── Main Function ───────────────────────────────────────

export async function getStudentRankings(
  studentId: string,
  year: number
): Promise<StudentRankings | null> {
  // 1. Fetch the target student (non-deleted) with their class.
  const student = await prisma.student.findFirst({
    where: { id: studentId, isDeleted: false },
    include: { class: true },
  });
  if (!student) return null;

  const classId = student.classId;
  const grade = student.class.grade;
  const section = student.class.section;
  const className = `${grade}${section}`;

  // 2. Fetch ALL mark records for the year for:
  //    a) classmates (same classId, non-deleted)
  //    b) grademates (same grade, non-deleted)
  //    We fetch grademates which is a superset that includes classmates.

  // Get all class IDs for this grade
  const gradeClasses = await prisma.classGroup.findMany({
    where: { grade },
    select: { id: true },
  });
  const gradeClassIds = gradeClasses.map((c) => c.id);

  // Fetch all non-deleted students in the grade with their mark records for the year
  const gradeStudents = await prisma.student.findMany({
    where: {
      classId: { in: gradeClassIds },
      isDeleted: false,
    },
    include: {
      markRecords: {
        where: { year },
      },
    },
  });

  // 3. Build per-term totals for class and grade.
  //    Map: studentId → { term → totalMarks }
  type TermTotalsMap = Map<string, Map<Term, number>>;

  const buildTermTotals = (): TermTotalsMap => {
    const map: TermTotalsMap = new Map();
    for (const s of gradeStudents) {
      const termMap = new Map<Term, number>();
      for (const mr of s.markRecords) {
        termMap.set(mr.term, sumMarks(mr.marks));
      }
      if (termMap.size > 0) {
        map.set(s.id, termMap);
      }
    }
    return map;
  };

  const allTermTotals = buildTermTotals();

  // Class-only subset
  const classStudentIds = new Set(
    gradeStudents.filter((s) => s.classId === classId).map((s) => s.id)
  );

  // 4. Compute per-term rankings.
  const termRankings: TermRanking[] = [];

  for (const term of TERMS) {
    // Gather totals for students who have a record for this term.
    const classTotals: number[] = [];
    const gradeTotals: number[] = [];
    let studentTotal: number | null = null;

    for (const [sid, termMap] of allTermTotals) {
      const total = termMap.get(term);
      if (total === undefined) continue; // no record this term
      gradeTotals.push(total);
      if (classStudentIds.has(sid)) {
        classTotals.push(total);
      }
      if (sid === studentId) {
        studentTotal = total;
      }
    }

    // Skip if student has no marks for this term
    if (studentTotal === null) continue;

    // Sort descending for ranking
    classTotals.sort((a, b) => b - a);
    gradeTotals.sort((a, b) => b - a);

    termRankings.push({
      term: term as TermRanking["term"],
      termLabel: TERM_LABELS[term],
      classRank: competitionRank(classTotals, studentTotal),
      classTotal: classTotals.length,
      sectionRank: competitionRank(gradeTotals, studentTotal),
      sectionTotal: gradeTotals.length,
      totalMarks: studentTotal,
    });
  }

  // 5. Compute year-level rankings.
  //    For each student, average their total marks across all available terms in the year.
  const classYearAverages: number[] = [];
  const gradeYearAverages: number[] = [];
  let studentYearAverage: number | null = null;

  for (const [sid, termMap] of allTermTotals) {
    const totals = Array.from(termMap.values());
    if (totals.length === 0) continue;
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;

    gradeYearAverages.push(avg);
    if (classStudentIds.has(sid)) {
      classYearAverages.push(avg);
    }
    if (sid === studentId) {
      studentYearAverage = avg;
    }
  }

  // If the student has no marks at all for the year
  if (studentYearAverage === null) {
    return {
      year,
      className,
      grade,
      termRankings: [],
      yearRanking: {
        classRank: 0,
        classTotal: 0,
        sectionRank: 0,
        sectionTotal: 0,
        averageMarks: 0,
      },
    };
  }

  classYearAverages.sort((a, b) => b - a);
  gradeYearAverages.sort((a, b) => b - a);

  const yearRanking: YearRanking = {
    classRank: competitionRank(classYearAverages, studentYearAverage),
    classTotal: classYearAverages.length,
    sectionRank: competitionRank(gradeYearAverages, studentYearAverage),
    sectionTotal: gradeYearAverages.length,
    averageMarks: Math.round(studentYearAverage * 100) / 100,
  };

  return {
    year,
    className,
    grade,
    termRankings,
    yearRanking,
  };
}
