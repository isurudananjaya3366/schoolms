import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

// ─── Validation ──────────────────────────────────────────

const querySchema = z.object({
  grade: z.enum(["6", "7", "8", "9", "10", "11"]).optional(),
  term: z.enum(["TERM_1", "TERM_2", "TERM_3"]).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  section: z.string().regex(/^[A-F]$/).optional(),
});

// ─── Types ───────────────────────────────────────────────

type MarkRecord = {
  id: string;
  studentId: string;
  term: string;
  year: number;
  marks: Record<string, number | null>;
  student: {
    id: string;
    name: string;
    isDeleted: boolean;
    electives: { categoryI: string; categoryII: string; categoryIII: string };
    class: { id: string; grade: number; section: string };
  };
};

// ─── Helpers ─────────────────────────────────────────────

const CORE_KEYS = [
  "sinhala",
  "buddhism",
  "maths",
  "science",
  "english",
  "history",
] as const;
const CATEGORY_KEYS = ["categoryI", "categoryII", "categoryIII"] as const;

/** Yield each non-null numeric mark value from a record */
function* iterMarkValues(r: MarkRecord): Generator<number> {
  for (const key of CORE_KEYS) {
    const v = r.marks[key];
    if (v !== null && v !== undefined) yield v;
  }
  for (const catKey of CATEGORY_KEYS) {
    const v = r.marks[catKey];
    if (v !== null && v !== undefined) yield v;
  }
}

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

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
        { status: 400 },
      );
    }

    const { grade, term, year, section } = parsed.data;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();

    // Build where clause — always query at GRADE level only.
    // Section filter is applied IN MEMORY so we can build both
    // class-specific and grade-wide student rankings from a single query.
    const whereClause: Record<string, unknown> = { year: yearNum };
    if (grade) {
      whereClause.student = {
        class: { grade: parseInt(grade) },
        isDeleted: false,
      };
    } else {
      whereClause.student = { isDeleted: false };
    }

    const records = (await prisma.markRecord.findMany({
      where: whereClause,
      include: { student: { include: { class: true } } },
    })) as unknown as MarkRecord[];

    // Records used for grade-level ranking tables (respect optional term filter)
    const gradeRankingRecords = term
      ? records.filter((r) => r.term === term)
      : records;

    // Records filtered to the selected class (section applied in-memory)
    const classRankingRecords =
      section
        ? gradeRankingRecords.filter(
            (r) => r.student.class.section === section,
          )
        : [];

    // ── Aggregation buckets ───────────────────────────────

    type StudentAgg = { name: string; indexNumber: string; classLabel: string; totalSum: number; count: number };

    // Grade-wide student aggregation (for right/section ranking table)
    const gradeStudentAgg = new Map<string, StudentAgg>();

    // Class-specific student aggregation (for left/class ranking table)
    const classStudentAgg = new Map<string, StudentAgg>();

    // class label → { grade, section, totalSum, count }
    const classAgg = new Map<
      string,
      { grade: number; section: string; totalSum: number; count: number }
    >();

    // section letter → { totalSum, count }
    const sectionAgg = new Map<
      string,
      { totalSum: number; count: number }
    >();

    // term → class label → { totalSum, count }  (for trend chart, uses all records)
    const classByTerm = new Map<
      string,
      Map<string, { totalSum: number; count: number }>
    >();

    // term → section letter → { totalSum, count }
    const sectionByTerm = new Map<
      string,
      Map<string, { totalSum: number; count: number }>
    >();

    // Populate ranking aggregations (grade-level)
    for (const r of gradeRankingRecords) {
      const classLabel = `${r.student.class.grade}${r.student.class.section}`;
      const sec = r.student.class.section;
      const sid = r.student.id;

      if (!classAgg.has(classLabel)) {
        classAgg.set(classLabel, {
          grade: r.student.class.grade,
          section: sec,
          totalSum: 0,
          count: 0,
        });
      }
      if (!sectionAgg.has(sec)) {
        sectionAgg.set(sec, { totalSum: 0, count: 0 });
      }
      if (!gradeStudentAgg.has(sid)) {
        gradeStudentAgg.set(sid, {
          name: r.student.name,
          indexNumber: r.student.indexNumber ?? "",
          classLabel,
          totalSum: 0,
          count: 0,
        });
      }

      for (const value of iterMarkValues(r)) {
        classAgg.get(classLabel)!.totalSum += value;
        classAgg.get(classLabel)!.count++;
        sectionAgg.get(sec)!.totalSum += value;
        sectionAgg.get(sec)!.count++;
        gradeStudentAgg.get(sid)!.totalSum += value;
        gradeStudentAgg.get(sid)!.count++;
      }
    }

    // Populate class-specific student aggregation
    for (const r of classRankingRecords) {
      const sid = r.student.id;
      const classLabel = `${r.student.class.grade}${r.student.class.section}`;

      if (!classStudentAgg.has(sid)) {
        classStudentAgg.set(sid, {
          name: r.student.name,
          indexNumber: r.student.indexNumber ?? "",
          classLabel,
          totalSum: 0,
          count: 0,
        });
      }
      for (const value of iterMarkValues(r)) {
        classStudentAgg.get(sid)!.totalSum += value;
        classStudentAgg.get(sid)!.count++;
      }
    }

    // Populate trend aggregations (always all terms — no term filter here)
    for (const r of records) {
      const classLabel = `${r.student.class.grade}${r.student.class.section}`;
      const sec = r.student.class.section;
      const t = r.term;

      if (!classByTerm.has(t)) classByTerm.set(t, new Map());
      const ctMap = classByTerm.get(t)!;
      if (!ctMap.has(classLabel)) ctMap.set(classLabel, { totalSum: 0, count: 0 });

      if (!sectionByTerm.has(t)) sectionByTerm.set(t, new Map());
      const stMap = sectionByTerm.get(t)!;
      if (!stMap.has(sec)) stMap.set(sec, { totalSum: 0, count: 0 });

      for (const value of iterMarkValues(r)) {
        ctMap.get(classLabel)!.totalSum += value;
        ctMap.get(classLabel)!.count++;
        stMap.get(sec)!.totalSum += value;
        stMap.get(sec)!.count++;
      }
    }

    // ── Build ranked lists ────────────────────────────────

    const classRankings = Array.from(classAgg.entries())
      .map(([label, d]) => ({
        classLabel: label,
        grade: d.grade,
        section: d.section,
        avgMark:
          d.count > 0
            ? Math.round((d.totalSum / d.count) * 100) / 100
            : 0,
        count: d.count,
      }))
      .sort((a, b) => b.avgMark - a.avgMark)
      .slice(0, 10)
      .map((c, i) => ({ ...c, rank: i + 1 }));

    const sectionRankings = Array.from(sectionAgg.entries())
      .map(([sec, d]) => ({
        section: sec,
        avgMark:
          d.count > 0
            ? Math.round((d.totalSum / d.count) * 100) / 100
            : 0,
        count: d.count,
      }))
      .sort((a, b) => b.avgMark - a.avgMark)
      .slice(0, 10)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    /** Build sorted student ranking array from an aggregation map */
    function buildStudentRankings(agg: Map<string, StudentAgg>) {
      return Array.from(agg.entries())
        .map(([sid, d]) => ({
          studentId: sid,
          name: d.name,
          indexNumber: d.indexNumber,
          classLabel: d.classLabel,
          totalMarks: d.totalSum,
          avgMark:
            d.count > 0
              ? Math.round((d.totalSum / d.count) * 100) / 100
              : 0,
          count: d.count,
        }))
        .sort((a, b) => b.totalMarks - a.totalMarks)
        .slice(0, 10)
        .map((s, i) => ({ ...s, rank: i + 1 }));
    }

    const classStudentRankings = buildStudentRankings(classStudentAgg);
    const gradeStudentRankings = buildStudentRankings(gradeStudentAgg);

    // ── Build trend data for top 5 classes and sections ───

    const top5Classes = classRankings.slice(0, 5).map((c) => c.classLabel);
    const top5Sections = sectionRankings.slice(0, 5).map((s) => s.section);

    const classTrendData = ["TERM_1", "TERM_2", "TERM_3"].map((t) => {
      const entry: Record<string, string | number> = {
        term: TERM_LABELS[t],
      };
      const ctMap = classByTerm.get(t);
      for (const label of top5Classes) {
        const d = ctMap?.get(label);
        if (d && d.count > 0) {
          entry[label] = Math.round((d.totalSum / d.count) * 100) / 100;
        }
      }
      return entry;
    });

    const sectionTrendData = ["TERM_1", "TERM_2", "TERM_3"].map((t) => {
      const entry: Record<string, string | number> = {
        term: TERM_LABELS[t],
      };
      const stMap = sectionByTerm.get(t);
      for (const sec of top5Sections) {
        const d = stMap?.get(sec);
        if (d && d.count > 0) {
          entry[`Section ${sec}`] = Math.round((d.totalSum / d.count) * 100) / 100;
        }
      }
      return entry;
    });

    return NextResponse.json({
      classStudentRankings,
      gradeStudentRankings,
      classRankings,
      sectionRankings,
      classTrendData,
      sectionTrendData,
      top5Classes,
      top5Sections: top5Sections.map((s) => `Section ${s}`),
    });
  } catch (err) {
    console.error("/api/analytics/rankings error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
