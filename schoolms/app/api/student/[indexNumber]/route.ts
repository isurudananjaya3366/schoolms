import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ indexNumber: string }> }
) {
  const { indexNumber } = await params;

  const student = await prisma.student.findFirst({
    where: {
      indexNumber: { equals: indexNumber, mode: "insensitive" },
      isDeleted: false,
    },
    include: {
      class: { select: { grade: true, section: true } },
      markRecords: {
        orderBy: [{ year: "desc" }, { term: "asc" }],
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  // ── Filter mark records to only expose PUBLISHED marks ──
  const publishedReleases = await prisma.marksRelease.findMany({
    where: { classId: student.classId, status: "PUBLISHED" },
    select: { term: true, year: true, subject: true, electiveName: true },
  });

  const releaseMap = new Map<string, { classLevel: boolean; subjects: Set<string> }>();
  for (const r of publishedReleases) {
    const k = `${r.term}::${r.year}`;
    if (!releaseMap.has(k)) releaseMap.set(k, { classLevel: false, subjects: new Set() });
    const entry = releaseMap.get(k)!;
    if (r.subject === null) {
      entry.classLevel = true;
    } else {
      entry.subjects.add(`${r.subject}::${r.electiveName ?? ""}`);
    }
  }

  const allSubjectKeys = ["sinhala", "buddhism", "maths", "science", "english", "history", "categoryI", "categoryII", "categoryIII"];
  const electives = student.electives as { categoryI?: string; categoryII?: string; categoryIII?: string } | null;

  const filteredMarkRecords = student.markRecords
    .map((record) => {
      const k = `${record.term}::${record.year}`;
      const rel = releaseMap.get(k);
      if (!rel) return null;

      if (rel.classLevel) return record;

      const maskedMarks: Record<string, number | null> = {};
      let hasAnyReleased = false;

      for (const key of allSubjectKeys) {
        const electiveName =
          key === "categoryI" ? (electives?.categoryI ?? "")
          : key === "categoryII" ? (electives?.categoryII ?? "")
          : key === "categoryIII" ? (electives?.categoryIII ?? "")
          : "";
        const subjectKey = `${key}::${electiveName}`;
        const rawValue = (record.marks as Record<string, unknown> | null)?.[key];
        if (rel.subjects.has(subjectKey)) {
          maskedMarks[key] = typeof rawValue === "number" ? rawValue : null;
          hasAnyReleased = true;
        } else {
          maskedMarks[key] = null;
        }
      }

      if (!hasAnyReleased) return null;
      return { ...record, marks: maskedMarks };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return NextResponse.json({ student: { ...student, markRecords: filteredMarkRecords } });
}

