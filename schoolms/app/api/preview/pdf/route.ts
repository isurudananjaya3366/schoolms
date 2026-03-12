import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
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

export const maxDuration = 60;

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  titlePage: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  schoolName: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  reportTitle: { fontSize: 18, marginBottom: 10, color: "#374151" },
  filterScope: { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  generatedDate: { fontSize: 10, color: "#9ca3af" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
    marginBottom: 16,
  },
  headerText: { fontSize: 10, color: "#6b7280" },
  caption: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#111827",
  },
  chartImage: { width: "100%", marginBottom: 16 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

export async function POST(request: Request) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  let body: {
    images: string[];
    chartCaptions: string[];
    schoolName: string;
    reportTitle: string;
    generatedDate: string;
    filterScope: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { images, chartCaptions, schoolName, reportTitle, generatedDate, filterScope } = body;

  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json(
      { error: "At least one chart image is required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(chartCaptions) || chartCaptions.length !== images.length) {
    return NextResponse.json(
      { error: "Chart captions must match the number of images" },
      { status: 400 },
    );
  }

  try {
    const dateStr = new Date(generatedDate).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Title page
    const titlePage = createElement(
      Page,
      { size: "A4", style: styles.titlePage },
      createElement(Text, { style: styles.schoolName }, schoolName),
      createElement(Text, { style: styles.reportTitle }, reportTitle),
      createElement(Text, { style: styles.filterScope }, filterScope),
      createElement(
        Text,
        { style: styles.generatedDate },
        `Generated on ${dateStr}`,
      ),
    );

    // Chart pages
    const chartPages = images.map((img: string, i: number) =>
      createElement(
        Page,
        { key: `chart-${i}`, size: "A4", style: styles.page },
        createElement(
          View,
          { style: styles.header },
          createElement(Text, { style: styles.headerText }, schoolName),
          createElement(Text, { style: styles.headerText }, filterScope),
        ),
        createElement(Text, { style: styles.caption }, chartCaptions[i]),
        createElement(Image, { style: styles.chartImage, src: img }),
        createElement(
          View,
          { style: styles.footer, fixed: true },
          createElement(
            Text,
            null,
            `${schoolName} — Analytics Report — Page ${i + 2}`,
          ),
        ),
      ),
    );

    const doc = createElement(Document, null, titlePage, ...chartPages);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(doc as any);

    const filename = `${schoolName.replace(/\s+/g, "-")}-analytics-${new Date().toISOString().split("T")[0]}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 },
    );
  }
}
