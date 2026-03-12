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
type RawMarks = Record<string, Record<string, number | null>>;
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
    const includeClassTeacherSign = searchParams.get("classTeacherSign") === "true";
    const includePrincipalSign = searchParams.get("principalSign") === "true";
    const includeVicePrincipalSign = searchParams.get("vicePrincipalSign") === "true";

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
              "school_logo_url",
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
    const schoolLogoUrl = configMap.get("school_logo_url") || null;

    // Parse elective labels — may be JSON arrays, take first element as default
    function parseElectiveLabel(raw: string): string {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed[0] || raw;
      } catch { /* plain string */ }
      return raw;
    }

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

    // Build processed marks and raw marks
    const processedMarks: ProcessedMarks = {};
    const rawMarks: RawMarks = {};
    for (const term of TERM_ORDER) {
      const record = markRecords.find((r) => r.term === term);
      const termMarks: Record<string, string> = {};
      const termRawMarks: Record<string, number | null> = {};
      for (const key of SUBJECT_KEYS) {
        const markValue = record
          ? (record.marks as Record<string, number | null | undefined>)[key]
          : undefined;
        termMarks[key] = applyWRule(markValue ?? null);
        termRawMarks[key] = markValue !== undefined ? (markValue ?? null) : null;
      }
      processedMarks[term] = termMarks;
      rawMarks[term] = termRawMarks;
    }

    // Build W-note data
    const wNoteMap = new Map<string, string[]>();
    const electivesForWRule = {
      categoryI: student.electives.categoryI || parseElectiveLabel(labelI),
      categoryII: student.electives.categoryII || parseElectiveLabel(labelII),
      categoryIII: student.electives.categoryIII || parseElectiveLabel(labelIII),
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

    // Fetch signature URLs if requested
    const className = `${student.class.grade}${student.class.section}`;
    let classTeacherSignUrl: string | null = null;
    let principalSignUrl: string | null = null;
    let vicePrincipalSignUrl: string | null = null;

    const sigKeys: string[] = [];
    if (includeClassTeacherSign) sigKeys.push(`signature_class_${className}`);
    if (includePrincipalSign) sigKeys.push("signature_principal");
    if (includeVicePrincipalSign) sigKeys.push("signature_vice_principal");

    if (sigKeys.length > 0) {
      const sigConfigs = await prisma.systemConfig.findMany({
        where: { key: { in: sigKeys } },
      });
      for (const sc of sigConfigs) {
        try {
          const parsed = JSON.parse(sc.value);
          if (sc.key === `signature_class_${className}`) classTeacherSignUrl = parsed.url;
          if (sc.key === "signature_principal") principalSignUrl = parsed.url;
          if (sc.key === "signature_vice_principal") vicePrincipalSignUrl = parsed.url;
        } catch { /* ignore */ }
      }
    }

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
      className,
      processedMarks,
      rawMarks,
      wNoteData,
      electiveLabels: {
        labelI: parseElectiveLabel(labelI),
        labelII: parseElectiveLabel(labelII),
        labelIII: parseElectiveLabel(labelIII),
      },
      studentElectives: {
        categoryI: student.electives.categoryI,
        categoryII: student.electives.categoryII,
        categoryIII: student.electives.categoryIII,
      },
      generatedAt: new Date().toISOString(),
      schoolLogoUrl,
      classTeacherSignUrl,
      principalSignUrl,
      vicePrincipalSignUrl,
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
