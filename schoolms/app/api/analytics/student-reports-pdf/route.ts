import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role, Term } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import prisma from "@/lib/prisma";

export const maxDuration = 60;

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

const TERM_LABELS: Record<Term, string> = {
  TERM_1: "T1",
  TERM_2: "T2",
  TERM_3: "T3",
};

// ── Land­scape A4 styles ───────────────────────────────────
const s = StyleSheet.create({
  page: {
    size: [841.89, 595.28],
    padding: 30,
    fontFamily: "Helvetica",
  },
  // Header section
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
    gap: 10,
  },
  logo: { width: 40, height: 40, objectFit: "contain" },
  headerTextGroup: { flex: 1 },
  schoolName: { fontSize: 14, fontWeight: "bold", color: "#111827" },
  reportTitle: { fontSize: 10, color: "#374151", marginTop: 2 },
  filterScope: { fontSize: 8, color: "#6b7280", marginTop: 1 },
  // Table
  table: { flexDirection: "column", marginTop: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  // Cells
  cellBase: {
    fontSize: 7,
    padding: 3,
    borderRightWidth: 0.5,
    borderRightColor: "#e5e7eb",
  },
  cellHeader: {
    fontSize: 7,
    fontWeight: "bold",
    padding: 3,
    borderRightWidth: 0.5,
    borderRightColor: "#d1d5db",
    color: "#374151",
  },
  // Column widths (landscape 842 - 60 margins = 782)
  colNum: { width: 18, textAlign: "center" },
  colName: { width: 95 },
  colIndex: { width: 45 },
  colClass: { width: 28, textAlign: "center" },
  colTerm: { width: 28, textAlign: "center" },
  colSubject: { width: 35, textAlign: "center" },
  colElective: { width: 50, textAlign: "center" },
  colTotal: { width: 32, textAlign: "center", fontWeight: "bold" },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#9ca3af" },
  // W-mark style override
  wMark: { color: "#dc2626" },
  noEntry: { color: "#9ca3af" },
  // Signature page
  signaturePage: { padding: 60, fontFamily: "Helvetica" },
  signaturePageTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 40, textAlign: "center" as const },
  signatureSection: { flexDirection: "row" as const, justifyContent: "space-around" as const, marginTop: 40 },
  signatureBlock: { width: 150, alignItems: "center" as const },
  signatureImage: { width: 100, height: 50, marginBottom: 8, objectFit: "contain" as const },
  signatureLine: { width: 120, borderBottomWidth: 1, borderBottomColor: "#374151", marginTop: 40 },
  signatureLabel: { fontSize: 10, color: "#374151", marginTop: 6, textAlign: "center" as const },
});

function abbreviateSubject(name: string, maxLen = 12): string {
  if (!name) return "";
  if (name.length <= maxLen) return name;
  return name.substring(0, maxLen - 1) + ".";
}

function computeTermTotal(
  marks: Record<string, number | null | undefined>,
): { total: number; wCount: number } {
  let total = 0;
  let wCount = 0;
  for (const key of SUBJECT_KEYS) {
    const v = marks[key];
    if (v !== null && v !== undefined) {
      total += v;
      if (v < 35) wCount++;
    }
  }
  return { total, wCount };
}

function markDisplay(v: number | null | undefined): {
  text: string;
  isW: boolean;
  isEmpty: boolean;
} {
  if (v === null || v === undefined) return { text: "-", isW: false, isEmpty: true };
  if (v < 35) return { text: "W", isW: true, isEmpty: false };
  return { text: String(v), isW: false, isEmpty: false };
}

export async function POST(request: Request) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  let body: {
    year: string;
    grade?: string;
    section?: string;
    term?: string;
    principalField?: boolean;
    principalSignUrl?: string | null;
    vicePrincipalField?: boolean;
    vicePrincipalSignUrl?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { year, grade, section, term, principalField, principalSignUrl, vicePrincipalField, vicePrincipalSignUrl } = body;

  if (!year || isNaN(parseInt(year))) {
    return NextResponse.json(
      { error: "Year is required" },
      { status: 400 },
    );
  }

  const yearNum = parseInt(year);
  const gradeNum = grade ? parseInt(grade) : undefined;
  const termValue = term && Object.values(Term).includes(term as Term)
    ? (term as Term)
    : undefined;

  try {
    // ── Fetch settings (school name, logo, elective labels) ──
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            "school_name",
            "school_logo_url",
          ],
        },
      },
    });
    const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    const schoolName = configMap.school_name || "SchoolMS";
    const schoolLogoUrl = configMap.school_logo_url || "";

    // ── Fetch students with matching filters ──────────────
    const students = await prisma.student.findMany({
      where: {
        isDeleted: false,
        ...(gradeNum !== undefined ? { class: { grade: gradeNum } } : {}),
        ...(section ? { class: { section } } : {}),
      },
      include: {
        class: true,
        markRecords: {
          where: {
            year: yearNum,
            ...(termValue ? { term: termValue } : {}),
          },
          orderBy: { term: "asc" },
        },
      },
      orderBy: [
        { class: { grade: "asc" } },
        { class: { section: "asc" } },
        { name: "asc" },
      ],
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "No students found for the selected filters" },
        { status: 404 },
      );
    }

    // ── Filter out students with no mark records ──────────
    // Keep students that have at least one mark record matching filters
    const studentsWithData = students.filter((s) => s.markRecords.length > 0);

    if (studentsWithData.length === 0) {
      return NextResponse.json(
        { error: "No mark data found for the selected filters" },
        { status: 404 },
      );
    }

    const dateStr = new Date().toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const gradeStr = gradeNum ? `Grade ${gradeNum}` : "All Grades";
    const sectionStr = section ? ` ${section}` : "";
    const termStr = termValue
      ? ` - ${termValue.replace("TERM_", "Term ")}`
      : " - All Terms";
    const filterScopeStr = `${gradeStr}${sectionStr}${termStr} - ${year}`;
    const reportTitleStr = `Student Marks Report`;

    // ── Build PDF ─────────────────────────────────────────

    // Header
    const headerEl = createElement(
      View,
      { style: s.header },
      ...(schoolLogoUrl
        ? [createElement(Image, { style: s.logo, src: schoolLogoUrl })]
        : []),
      createElement(
        View,
        { style: s.headerTextGroup },
        createElement(Text, { style: s.schoolName }, schoolName),
        createElement(Text, { style: s.reportTitle }, reportTitleStr),
        createElement(Text, { style: s.filterScope }, filterScopeStr),
      ),
      createElement(
        Text,
        { style: [s.filterScope, { textAlign: "right" as const }] },
        `Generated: ${dateStr}`,
      ),
    );

    // Footer (fixed - appears on every page)
    const footerEl = createElement(
      View,
      { style: s.footer, fixed: true },
      createElement(
        Text,
        { style: s.footerText },
        `${schoolName} - ${reportTitleStr}`,
      ),
      createElement(
        Text,
        { style: s.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}` },
      ),
    );

    // ── Unified per-subject table (always, one row per student-term) ──
    const REGULAR_KEYS = ["sinhala", "buddhism", "maths", "science", "english", "history"] as const;
    const REGULAR_HEADERS = ["Sinhala", "Buddhism", "Maths", "Science", "English", "History"];
    const ELECTIVE_KEYS = ["categoryI", "categoryII", "categoryIII"] as const;
    const ELECTIVE_FIELDS = ["categoryI", "categoryII", "categoryIII"] as const;

    const tableHeaderRow = createElement(
      View,
      { style: s.tableHeaderRow },
      createElement(Text, { style: [s.cellHeader, s.colNum] }, "#"),
      createElement(Text, { style: [s.cellHeader, s.colName] }, "Student Name"),
      createElement(Text, { style: [s.cellHeader, s.colIndex] }, "Index No."),
      createElement(Text, { style: [s.cellHeader, s.colClass] }, "Class"),
      createElement(Text, { style: [s.cellHeader, s.colTerm] }, "Term"),
      ...REGULAR_HEADERS.map((label) =>
        createElement(Text, { key: label, style: [s.cellHeader, s.colSubject] }, label),
      ),
      createElement(Text, { style: [s.cellHeader, s.colElective] }, "E.I"),
      createElement(Text, { style: [s.cellHeader, s.colElective] }, "E.II"),
      createElement(Text, { style: [s.cellHeader, s.colElective] }, "E.III"),
      createElement(Text, { style: [s.cellHeader, s.colTotal] }, "Total"),
    );

    const dataRows: ReturnType<typeof createElement>[] = [];
    let rowIdx = 0;
    for (const student of studentsWithData) {
      for (const record of student.markRecords) {
        const marks = record.marks as Record<string, number | null | undefined>;
        const { total } = computeTermTotal(marks);
        const rowStyle = rowIdx % 2 === 0 ? s.tableRow : s.tableRowAlt;

        const regularCells = REGULAR_KEYS.map((key) => {
          const { text, isW, isEmpty } = markDisplay(marks[key]);
          const textStyle = isW ? s.wMark : isEmpty ? s.noEntry : undefined;
          return createElement(
            Text,
            { key, style: textStyle ? [s.cellBase, s.colSubject, textStyle] : [s.cellBase, s.colSubject] },
            text,
          );
        });

        const electiveCells = ELECTIVE_KEYS.map((key, i) => {
          const fieldName = ELECTIVE_FIELDS[i];
          const subjectName = (student.electives as Record<string, string>)[fieldName] || "";
          const { text, isW, isEmpty } = markDisplay(marks[key]);
          const abbrev = abbreviateSubject(subjectName);
          const cellText = isEmpty ? "-" : `${text}${abbrev ? `\n(${abbrev})` : ""}`;
          return createElement(
            Text,
            {
              key,
              style: [
                s.cellBase,
                s.colElective,
                { fontSize: 6 },
                isW ? s.wMark : isEmpty ? s.noEntry : {},
              ],
            },
            cellText,
          );
        });

        const termLabel = TERM_LABELS[record.term] ?? record.term;

        dataRows.push(
          createElement(
            View,
            { key: `${student.id}-${record.term}`, style: rowStyle },
            createElement(Text, { style: [s.cellBase, s.colNum] }, String(rowIdx + 1)),
            createElement(Text, { style: [s.cellBase, s.colName] }, student.name),
            createElement(Text, { style: [s.cellBase, s.colIndex] }, student.indexNumber || "-"),
            createElement(
              Text,
              { style: [s.cellBase, s.colClass] },
              `${student.class.grade}${student.class.section}`,
            ),
            createElement(Text, { style: [s.cellBase, s.colTerm] }, termLabel),
            ...regularCells,
            ...electiveCells,
            createElement(Text, { style: [s.cellBase, s.colTotal] }, String(total)),
          ),
        );
        rowIdx++;
      }
    }

    const tableEl = createElement(View, { style: s.table }, tableHeaderRow, ...dataRows);

    const page = createElement(
      Page,
      { size: [841.89, 595.28], style: s.page },
      headerEl,
      tableEl,
      footerEl,
    );

    // ── Signature page (optional) ─────────────────────────
    const needsSignaturePage = !!principalField || !!vicePrincipalField;
    const signaturePage = needsSignaturePage
      ? (() => {
          const blocks: ReturnType<typeof createElement>[] = [];
          if (principalField) {
            blocks.push(
              createElement(
                View,
                { style: s.signatureBlock },
                ...(principalSignUrl
                  ? [createElement(Image, { style: s.signatureImage, src: principalSignUrl })]
                  : []),
                createElement(View, { style: s.signatureLine }),
                createElement(Text, { style: s.signatureLabel }, "Principal"),
              ),
            );
          }
          if (vicePrincipalField) {
            blocks.push(
              createElement(
                View,
                { style: s.signatureBlock },
                ...(vicePrincipalSignUrl
                  ? [createElement(Image, { style: s.signatureImage, src: vicePrincipalSignUrl })]
                  : []),
                createElement(View, { style: s.signatureLine }),
                createElement(Text, { style: s.signatureLabel }, "Vice Principal"),
              ),
            );
          }
          return createElement(
            Page,
            { size: [841.89, 595.28], style: s.signaturePage },
            createElement(Text, { style: s.signaturePageTitle }, "Authorisation"),
            createElement(View, { style: s.signatureSection }, ...blocks),
          );
        })()
      : null;

    const doc = createElement(
      Document,
      null,
      page,
      ...(signaturePage ? [signaturePage] : []),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(doc as any);

    const safeSchool = schoolName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    const filename = `${safeSchool}-student-reports-${year}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Student reports PDF error:", err);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 },
    );
  }
}
