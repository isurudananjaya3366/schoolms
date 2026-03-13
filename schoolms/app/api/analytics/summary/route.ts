import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { CORE_SUBJECT_NAMES } from "@/lib/chartPalette";
import { W_THRESHOLD } from "@/lib/w-rule";

// ─── Validation ──────────────────────────────────────────

const querySchema = z.object({
  grade: z
    .enum(["10", "11"])
    .optional(),
  term: z
    .enum(["TERM_1", "TERM_2", "TERM_3"])
    .optional(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  section: z
    .string()
    .regex(/^[A-F]$/)
    .optional(),
});

// ─── Helpers ─────────────────────────────────────────────

const CORE_KEYS = ["sinhala", "buddhism", "maths", "science", "english", "history"] as const;
const CATEGORY_KEYS = ["categoryI", "categoryII", "categoryIII"] as const;

type MarkRecord = {
  id: string;
  studentId: string;
  term: string;
  year: number;
  marks: Record<string, number | null>;
  student: {
    id: string;
    name: string;
    indexNumber: string;
    isDeleted: boolean;
    electives: { categoryI: string; categoryII: string; categoryIII: string };
    class: { id: string; grade: number; section: string };
  };
};

function sectionLabel(grade: number, section: string) {
  return `${grade}${section}`;
}

/**
 * Build an ordered list of subject display names and a helper that
 * maps (record) → [ { displayName, mark } ] for every non-null mark.
 *
 * Core subjects use CORE_SUBJECT_NAMES, elective categories are expanded
 * by each student's actual elective name (e.g. "Art", "Commerce").
 */
function buildSubjectEntries(records: MarkRecord[]) {
  // Collect all unique elective display names for ordering
  const electiveNames = new Set<string>();
  for (const r of records) {
    for (const catKey of CATEGORY_KEYS) {
      const v = r.marks[catKey];
      if (v !== null && v !== undefined) {
        const name = r.student.electives[catKey];
        if (name) electiveNames.add(name);
      }
    }
  }

  // Ordered subject list: core display names first, then sorted electives
  const orderedSubjects = [
    ...CORE_KEYS.map((k) => CORE_SUBJECT_NAMES[k]),
    ...[...electiveNames].sort(),
  ];

  return { orderedSubjects, electiveNames };
}

/** Yield (displayName, markValue) pairs for a single record */
function* iterMarks(r: MarkRecord): Generator<[string, number]> {
  for (const key of CORE_KEYS) {
    const v = r.marks[key];
    if (v !== null && v !== undefined) yield [CORE_SUBJECT_NAMES[key], v];
  }
  for (const catKey of CATEGORY_KEYS) {
    const v = r.marks[catKey];
    if (v !== null && v !== undefined) {
      const name = r.student.electives[catKey];
      if (name) yield [name, v];
    }
  }
}

// ─── GET handler ─────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { grade, term, year, section } = parsed.data;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();

    // Build where clause
    const whereClause: Record<string, unknown> = { year: yearNum };
    if (term) whereClause.term = term;
    if (grade && section) {
      whereClause.student = {
        class: { grade: parseInt(grade), section },
        isDeleted: false,
      };
    } else if (grade) {
      whereClause.student = {
        class: { grade: parseInt(grade) },
        isDeleted: false,
      };
    } else {
      whereClause.student = { isDeleted: false };
    }

    const records = (await prisma.markRecord.findMany({
      where: whereClause,
      include: {
        student: {
          include: { class: true },
        },
      },
    })) as unknown as MarkRecord[];

    const { orderedSubjects } = buildSubjectEntries(records);

    // ── 1. Subject Averages ────────────────────────────────
    // Bucket marks by display name
    const avgBuckets = new Map<string, number[]>();
    for (const subj of orderedSubjects) avgBuckets.set(subj, []);

    for (const r of records) {
      for (const [name, value] of iterMarks(r)) {
        if (!avgBuckets.has(name)) avgBuckets.set(name, []);
        avgBuckets.get(name)!.push(value);
      }
    }

    const subjectAverages = orderedSubjects.map((subj) => {
      const values = avgBuckets.get(subj) || [];
      return {
        subject: subj,
        average: values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
          : null,
        count: values.length,
      };
    });

    // ── 2. W-Rates ─────────────────────────────────────────
    const wBuckets = new Map<string, { total: number; wCount: number }>();
    for (const subj of orderedSubjects) wBuckets.set(subj, { total: 0, wCount: 0 });

    for (const r of records) {
      for (const [name, value] of iterMarks(r)) {
        if (!wBuckets.has(name)) wBuckets.set(name, { total: 0, wCount: 0 });
        const b = wBuckets.get(name)!;
        b.total++;
        if (value < W_THRESHOLD) b.wCount++;
      }
    }

    const wRates = orderedSubjects.map((subj) => {
      const b = wBuckets.get(subj) || { total: 0, wCount: 0 };
      return {
        subject: subj,
        wRate: b.total > 0 ? Math.round((b.wCount / b.total) * 10000) / 100 : 0,
        wCount: b.wCount,
        total: b.total,
      };
    });

    // ── 3. Class Comparisons ───────────────────────────────
    const classBuckets = new Map<
      string,
      Map<string, number[]>
    >();

    for (const r of records) {
      const sec = sectionLabel(r.student.class.grade, r.student.class.section);
      if (!classBuckets.has(sec)) {
        classBuckets.set(sec, new Map());
      }
      const subjectMap = classBuckets.get(sec)!;
      for (const [name, value] of iterMarks(r)) {
        if (!subjectMap.has(name)) subjectMap.set(name, []);
        subjectMap.get(name)!.push(value);
      }
    }

    const classComparisons = Array.from(classBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, subjectMap]) => ({
        section,
        subjectAverages: orderedSubjects.map((subj) => {
          const vals = subjectMap.get(subj) || [];
          return {
            subject: subj,
            average:
              vals.length > 0
                ? Math.round(
                    (vals.reduce((a, b) => a + b, 0) / vals.length) * 100
                  ) / 100
                : 0,
          };
        }),
      }));

    // ── 4 & 5. Top / Bottom Performers ─────────────────────
    // Aggregate per student across all matching records
    const studentAgg = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        indexNumber: string;
        section: string;
        totalMarks: number;
        wCount: number;
        nonNullCount: number;
      }
    >();

    for (const r of records) {
      const sid = r.student.id;
      if (!studentAgg.has(sid)) {
        studentAgg.set(sid, {
          studentId: sid,
          studentName: r.student.name,
          indexNumber: r.student.indexNumber,
          section: sectionLabel(r.student.class.grade, r.student.class.section),
          totalMarks: 0,
          wCount: 0,
          nonNullCount: 0,
        });
      }
      const agg = studentAgg.get(sid)!;
      for (const [, value] of iterMarks(r)) {
        agg.totalMarks += value;
        agg.nonNullCount++;
        if (value < W_THRESHOLD) agg.wCount++;
      }
    }

    const allStudents = Array.from(studentAgg.values());

    const topPerformers = [...allStudents]
      .sort((a, b) => b.totalMarks - a.totalMarks)
      .slice(0, 5)
      .map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        indexNumber: s.indexNumber,
        section: s.section,
        totalMarks: s.totalMarks,
        wCount: s.wCount,
        profileUrl: `/dashboard/students/${s.studentId}`,
      }));

    const bottomPerformers = [...allStudents]
      .filter((s) => s.nonNullCount >= 3)
      .sort((a, b) => a.totalMarks - b.totalMarks)
      .slice(0, 5)
      .map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        indexNumber: s.indexNumber,
        section: s.section,
        totalMarks: s.totalMarks,
        wCount: s.wCount,
        profileUrl: `/dashboard/students/${s.studentId}`,
      }));

    // ── 6. Heatmap Data ────────────────────────────────────
    const BANDS: { label: string; range: [number, number] }[] = [
      { label: "0–34", range: [0, 34] },
      { label: "35–49", range: [35, 49] },
      { label: "50–64", range: [50, 64] },
      { label: "65–79", range: [65, 79] },
      { label: "80–100", range: [80, 100] },
    ];

    // Bucket heatmap counts by display name
    const heatBuckets = new Map<string, { counts: number[]; total: number }>();
    for (const subj of orderedSubjects) {
      heatBuckets.set(subj, { counts: BANDS.map(() => 0), total: 0 });
    }

    for (const r of records) {
      for (const [name, value] of iterMarks(r)) {
        if (!heatBuckets.has(name)) {
          heatBuckets.set(name, { counts: BANDS.map(() => 0), total: 0 });
        }
        const b = heatBuckets.get(name)!;
        b.total++;
        for (let i = 0; i < BANDS.length; i++) {
          if (value >= BANDS[i].range[0] && value <= BANDS[i].range[1]) {
            b.counts[i]++;
            break;
          }
        }
      }
    }

    const heatmapData = orderedSubjects.map((subj) => {
      const b = heatBuckets.get(subj) || { counts: BANDS.map(() => 0), total: 0 };
      return {
        subject: subj,
        bands: BANDS.map((band, i) => ({
          label: band.label,
          range: band.range,
          count: b.counts[i],
          percentage: b.total > 0 ? Math.round((b.counts[i] / b.total) * 10000) / 100 : 0,
        })),
      };
    });

    // ── 7. Scatter Data ────────────────────────────────────
    const scatterData = allStudents.map((s) => ({
      studentId: s.studentId,
      name: s.studentName,
      indexNumber: s.indexNumber,
      section: s.section,
      totalMarks: s.totalMarks,
      wCount: s.wCount,
      profileUrl: `/dashboard/students/${s.studentId}`,
    }));

    return NextResponse.json({
      subjectAverages,
      wRates,
      classComparisons,
      topPerformers,
      bottomPerformers,
      heatmapData,
      scatterData,
    });
  } catch (error) {
    console.error("[analytics/summary] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
