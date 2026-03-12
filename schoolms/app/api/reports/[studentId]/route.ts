export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role, Term } from "@prisma/client";
import prisma from "@/lib/prisma";
import { applyWRule, getWSubjects } from "@/lib/w-rule";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import ProgressReportDocument from "@/components/reports/ProgressReportDocument";
import { REPORT_VIEWED } from "@/lib/audit-actions";

const SUBJECT_KEYS = [
  "sinhala",
  "buddhism",
  "maths",
  "science",
  "english",
  "history",
  "categoryI",
  "categoryII",
  "categoryIII",
] as const;

const TERM_ORDER: Term[] = [Term.TERM_1, Term.TERM_2, Term.TERM_3];

const TERM_DISPLAY: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

type ProcessedMarks = Record<string, Record<string, string>>;
type WNoteEntry = { subject: string; terms: string[] };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const authResult = await requireAuth(Role.STAFF);
    if (authResult instanceof NextResponse) return authResult;

    const { studentId } = await params;
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");

    // Fetch settings, student, and resolve year in parallel
    const [configs, student] = await Promise.all([
      prisma.systemConfig.findMany({
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
      }),
      prisma.student.findUnique({
        where: { id: studentId },
        include: { class: true },
      }),
    ]);

    if (!student || student.isDeleted) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const configMap = new Map(configs.map((c) => [c.key, c.value]));
    const schoolName = configMap.get("school_name") || "School";
    const currentYear =
      configMap.get("academic_year") || String(new Date().getFullYear());
    const labelI = configMap.get("elective_label_I") || "Category I";
    const labelII = configMap.get("elective_label_II") || "Category II";
    const labelIII = configMap.get("elective_label_III") || "Category III";

    const yearNum = yearParam ? parseInt(yearParam, 10) : parseInt(currentYear, 10);

    if (isNaN(yearNum)) {
      return NextResponse.json(
        { error: "Invalid year parameter" },
        { status: 400 }
      );
    }

    // Fetch mark records for the resolved year
    const markRecords = await prisma.markRecord.findMany({
      where: { studentId, year: yearNum },
      orderBy: { term: "asc" },
    });

    if (markRecords.length === 0) {
      return NextResponse.json(
        { error: "No marks entered for this student in the selected year" },
        { status: 422 }
      );
    }

    // Build processed marks: { TERM_1: { sinhala: "85", ... }, ... }
    const processedMarks: ProcessedMarks = {};
    for (const term of TERM_ORDER) {
      const record = markRecords.find((r) => r.term === term);
      const termMarks: Record<string, string> = {};
      for (const key of SUBJECT_KEYS) {
        const markValue = record
          ? (record.marks as Record<string, number | null | undefined>)[key]
          : undefined;
        termMarks[key] = applyWRule(markValue ?? null);
      }
      processedMarks[term] = termMarks;
    }

    // Build W-note data
    const wNoteMap = new Map<string, string[]>();
    const electivesForWRule = {
      categoryI: labelI,
      categoryII: labelII,
      categoryIII: labelIII,
    };

    for (const term of TERM_ORDER) {
      const record = markRecords.find((r) => r.term === term);
      if (!record) continue;

      const marksObj = record.marks as Record<string, number | null | undefined>;
      const wSubjects = getWSubjects(marksObj, electivesForWRule);
      for (const subj of wSubjects) {
        const existing = wNoteMap.get(subj) || [];
        existing.push(TERM_DISPLAY[term]);
        wNoteMap.set(subj, existing);
      }
    }

    const wNoteData: WNoteEntry[] = Array.from(wNoteMap.entries()).map(
      ([subject, terms]) => ({ subject, terms })
    );

    // Audit log - fire and forget
    prisma.auditLog
      .create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name || "Unknown",
          action: REPORT_VIEWED,
          targetId: studentId,
          targetType: "Student",
          details: JSON.stringify({
            studentName: student.name,
            indexNumber: student.indexNumber,
            year: yearNum,
          }),
        },
      })
      .catch((err: unknown) => {
        console.error("Failed to create audit log for REPORT_VIEWED:", err);
      });

    // Render PDF
    const pdfElement = createElement(ProgressReportDocument, {
      schoolName,
      academicYear: yearNum,
      studentName: student.name,
      indexNumber: student.indexNumber ?? "N/A",
      grade: student.class.grade,
      className: `${student.class.grade}${student.class.section}`,
      processedMarks,
      wNoteData,
      electiveLabels: { labelI, labelII, labelIII },
      generatedAt: new Date().toISOString(),
    }) as unknown as ReactElement<DocumentProps>;

    const pdfBuffer = await renderToBuffer(pdfElement);

    const filename = `Progress_Report_${student.indexNumber}_${yearNum}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/reports/[studentId] error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
