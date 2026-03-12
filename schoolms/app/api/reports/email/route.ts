export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role, Term } from "@prisma/client";
import prisma from "@/lib/prisma";
import { applyWRule } from "@/lib/w-rule";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import ProgressReportDocument from "@/components/reports/ProgressReportDocument";
import { REPORT_EMAILED } from "@/lib/audit-actions";
import { sendEmail } from "@/lib/email";
import { getSecureSetting } from "@/lib/secure-settings";

/** Fetch a remote image and return as data URI for @react-pdf/renderer */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

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

type ProcessedMarks = Record<string, Record<string, string>>;
type RawMarks = Record<string, Record<string, number | null>>;

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(Role.STAFF);
    if (authResult instanceof NextResponse) return authResult;

    // Parse and validate request body
    const body = await request.json();
    const {
      studentId,
      year,
      recipientEmail,
      subject,
      body: emailBody,
      classTeacherField,
      classTeacherDigital,
      principalField,
      principalDigital,
      vicePrincipalField,
      vicePrincipalDigital,
    } = body as {
      studentId?: string;
      year?: number;
      recipientEmail?: string;
      subject?: string;
      body?: string;
      classTeacherField?: boolean;
      classTeacherDigital?: boolean;
      principalField?: boolean;
      principalDigital?: boolean;
      vicePrincipalField?: boolean;
      vicePrincipalDigital?: boolean;
    };

    if (
      !studentId ||
      !year ||
      !recipientEmail ||
      !subject ||
      !emailBody
    ) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, year, recipientEmail, subject, body" },
        { status: 400 }
      );
    }

    // Check that email is configured
    const resendApiKey = await getSecureSetting("RESEND_API_KEY");
    const smtpHost = await getSecureSetting("SMTP_HOST");
    if (!resendApiKey && !smtpHost) {
      return NextResponse.json(
        { error: "Email is not configured. Set RESEND_API_KEY or SMTP_HOST in secure settings." },
        { status: 400 }
      );
    }

    // Fetch settings and student in parallel
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
    const schoolName = configMap.get("school_name") || "SchoolMS";
    const labelI = configMap.get("elective_label_I") || "Category I";
    const labelII = configMap.get("elective_label_II") || "Category II";
    const labelIII = configMap.get("elective_label_III") || "Category III";
    const schoolLogoUrl = configMap.get("school_logo_url") || null;

    function parseElectiveLabel(raw: string): string {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed[0] || raw;
      } catch {
        /* plain string */
      }
      return raw;
    }

    // Fetch mark records for the year
    const markRecords = await prisma.markRecord.findMany({
      where: { studentId, year },
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

    // Fetch signature URLs if requested
    const className = `${student.class.grade}${student.class.section}`;
    let classTeacherSignUrl: string | null = null;
    let principalSignUrl: string | null = null;
    let vicePrincipalSignUrl: string | null = null;

    const sigKeys: string[] = [];
    if (classTeacherDigital) sigKeys.push(`signature_class_${className}`);
    if (principalDigital) sigKeys.push("signature_principal");
    if (vicePrincipalDigital) sigKeys.push("signature_vice_principal");

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
        } catch {
          /* ignore */
        }
      }
    }

    // Convert remote image URLs to base64 data URIs for PDF rendering
    const [logoBase64, ctSignBase64, pSignBase64, vpSignBase64] = await Promise.all([
      schoolLogoUrl ? fetchImageAsBase64(schoolLogoUrl) : Promise.resolve(null),
      classTeacherSignUrl ? fetchImageAsBase64(classTeacherSignUrl) : Promise.resolve(null),
      principalSignUrl ? fetchImageAsBase64(principalSignUrl) : Promise.resolve(null),
      vicePrincipalSignUrl ? fetchImageAsBase64(vicePrincipalSignUrl) : Promise.resolve(null),
    ]);

    // Render PDF
    const pdfElement = createElement(ProgressReportDocument, {
      schoolName,
      academicYear: year,
      studentName: student.name,
      indexNumber: student.indexNumber ?? "N/A",
      grade: student.class.grade,
      className,
      processedMarks,
      rawMarks,
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
      schoolLogoUrl: logoBase64,
      classTeacherSignUrl: ctSignBase64,
      principalSignUrl: pSignBase64,
      vicePrincipalSignUrl: vpSignBase64,
      classTeacherField: !!classTeacherField,
      principalField: !!principalField,
      vicePrincipalField: !!vicePrincipalField,
    }) as unknown as ReactElement<DocumentProps>;

    const pdfBuffer = await renderToBuffer(pdfElement);

    const filename = `Progress_Report_${student.indexNumber}_${year}.pdf`;

    // Send email with PDF attachment
    const htmlBody = `<!DOCTYPE html>
<html><body><p>${emailBody.replace(/\n/g, "<br>")}</p></body></html>`;

    await sendEmail({
      to: recipientEmail,
      subject,
      html: htmlBody,
      text: emailBody,
      attachments: [
        {
          filename,
          content: Buffer.from(pdfBuffer),
          contentType: "application/pdf",
        },
      ],
    });

    // Audit log - fire and forget
    prisma.auditLog
      .create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name || "Unknown",
          action: REPORT_EMAILED,
          targetId: studentId,
          targetType: "Student",
          details: JSON.stringify({
            studentName: student.name,
            indexNumber: student.indexNumber,
            year,
            recipientEmail,
          }),
        },
      })
      .catch((err: unknown) => {
        console.error("Failed to create audit log for REPORT_EMAILED:", err);
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/reports/email error:", error);
    return NextResponse.json(
      { error: "Failed to generate and email report" },
      { status: 500 }
    );
  }
}
