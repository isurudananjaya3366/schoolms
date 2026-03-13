"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PresenterToolbar from "./PresenterToolbar";
import SlideOverview from "./slides/SlideOverview";
import SlideTermMarks from "./slides/SlideTermMarks";
import SlidePerformanceChart from "./slides/SlidePerformanceChart";
import SlideSubjectHighlights from "./slides/SlideSubjectHighlights";
import SlideWSummary from "./slides/SlideWSummary";
import SlideOverallSummary from "./slides/SlideOverallSummary";
import type { PreviewData } from "@/types/preview";

const TOTAL_SLIDES = 8;

interface SlideRendererProps {
  data: PreviewData;
  /** Called when the user advances past the final slide (e.g. to auto-load next student). */
  onLastSlide?: () => void;
}

export default function SlideRenderer({ data, onLastSlide }: SlideRendererProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "A4">("16:9");
  const [fontSize, setFontSize] = useState(1.0);
  const [isPDFExporting, setIsPDFExporting] = useState(false);
  const chartSlideRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    if (slideIndex >= TOTAL_SLIDES - 1) {
      onLastSlide?.();
      return;
    }
    setSlideIndex((i) => Math.min(i + 1, TOTAL_SLIDES - 1));
  }, [slideIndex, onLastSlide]);

  const goPrev = useCallback(() => {
    setSlideIndex((i) => Math.max(i - 1, 0));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const toggleAspectRatio = useCallback(() => {
    setAspectRatio((a) => (a === "16:9" ? "A4" : "16:9"));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    setIsPDFExporting(true);
    try {
      // 1. Capture slide 5 (chart) via html2canvas
      const previousIndex = slideIndex;
      setSlideIndex(4);
      // Wait for render + animation
      await new Promise((r) => setTimeout(r, 600));

      let chartImageBase64: string | null = null;
      if (chartSlideRef.current) {
        const { toPng } = await import("html-to-image");
        chartImageBase64 = await toPng(chartSlideRef.current, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });
      }

      // Restore previous slide
      setSlideIndex(previousIndex);

      // 2. Build PDF using react-pdf/renderer
      const { Document, Page, View, Text, Image, StyleSheet } = await import(
        "@react-pdf/renderer"
      );
      const { renderToBuffer } = await import("@react-pdf/renderer");

      const isLandscape = aspectRatio === "16:9";
      const pageOrientation = isLandscape ? "landscape" : "portrait";

      const styles = StyleSheet.create({
        page: { padding: 40, fontFamily: "Helvetica" },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
          paddingBottom: 8,
          marginBottom: 20,
        },
        headerText: { fontSize: 9, color: "#6b7280" },
        slideTitle: {
          fontSize: 20,
          fontWeight: "bold",
          marginBottom: 16,
          color: "#111827",
        },
        heading: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
        text: { fontSize: 11, marginBottom: 4, color: "#374151" },
        boldText: { fontSize: 11, fontWeight: "bold", color: "#111827" },
        wText: { fontSize: 11, fontWeight: "bold", color: "#dc2626" },
        row: {
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
          paddingVertical: 4,
        },
        cellSubject: { width: "50%", fontSize: 10 },
        cellMark: { width: "50%", fontSize: 10, textAlign: "right" },
        badge: {
          backgroundColor: "#dbeafe",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
          fontSize: 10,
          color: "#1d4ed8",
          alignSelf: "flex-start" as const,
        },
        chartImage: { width: "100%", objectFit: "contain" as const },
        centeredText: { textAlign: "center" },
        spacer: { marginBottom: 20 },
      });

      const makeHeader = () =>
        createElement(
          View,
          { style: styles.header },
          createElement(Text, { style: styles.headerText }, data.schoolName),
          createElement(
            Text,
            { style: styles.headerText },
            data.student.name
          )
        );

      // Page 1: Overview
      const pg1 = createElement(
        Page,
        {
          key: "p1",
          size: "A4" as const,
          orientation: pageOrientation,
          style: styles.page,
        },
        makeHeader(),
        createElement(
          Text,
          {
            style: {
              ...styles.slideTitle,
              textAlign: "center",
              marginTop: 60,
            },
          },
          data.schoolName
        ),
        createElement(
          Text,
          {
            style: {
              ...styles.heading,
              textAlign: "center",
              marginTop: 20,
            },
          },
          data.student.name
        ),
        createElement(
          Text,
          { style: { ...styles.text, textAlign: "center" } },
          `Index: ${data.student.indexNumber}`
        ),
        createElement(
          View,
          { style: { ...styles.badge, alignSelf: "center" as const, marginTop: 12 } },
          createElement(
            Text,
            null,
            `Grade ${data.student.grade} — ${data.student.className}`
          )
        ),
        createElement(
          Text,
          {
            style: {
              ...styles.text,
              textAlign: "center",
              marginTop: 12,
            },
          },
          `Academic Year: ${data.academicYear}`
        )
      );

      // Pages 2-4: Term marks
      const termPages = data.enrichedTerms.map((et, i) => {
        const rows = et.subjects.map((subj, j) =>
          createElement(
            View,
            { key: `r-${i}-${j}`, style: styles.row },
            createElement(Text, { style: styles.cellSubject }, subj.displayName),
            createElement(
              Text,
              {
                style: {
                  ...styles.cellMark,
                  ...(subj.isW
                    ? { color: "#dc2626", fontWeight: "bold" as const }
                    : {}),
                },
              },
              subj.display
            )
          )
        );
        return createElement(
          Page,
          {
            key: `term-${i}`,
            size: "A4" as const,
            orientation: pageOrientation,
            style: styles.page,
          },
          makeHeader(),
          createElement(Text, { style: styles.slideTitle }, `${et.termLabel} Marks`),
          !et.hasData
            ? createElement(
                Text,
                { style: styles.text },
                "No marks recorded for this term."
              )
            : createElement(View, null, ...rows)
        );
      });

      // Page 5: Chart (image)
      const pg5 = createElement(
        Page,
        {
          key: "chart",
          size: "A4" as const,
          orientation: pageOrientation,
          style: styles.page,
        },
        makeHeader(),
        createElement(
          Text,
          { style: styles.slideTitle },
          "Performance Chart"
        ),
        chartImageBase64
          ? createElement(Image, {
              style: styles.chartImage,
              src: chartImageBase64,
            })
          : createElement(
              Text,
              { style: styles.text },
              "Chart capture unavailable."
            )
      );

      // Page 6: Subject Highlights
      const pg6 = createElement(
        Page,
        {
          key: "highlights",
          size: "A4" as const,
          orientation: pageOrientation,
          style: styles.page,
        },
        makeHeader(),
        createElement(
          Text,
          { style: styles.slideTitle },
          "Subject Highlights"
        ),
        data.highlights.bestSubject
          ? createElement(
              View,
              { style: styles.spacer },
              createElement(
                Text,
                { style: styles.heading },
                "Strongest Subject"
              ),
              createElement(
                Text,
                { style: styles.boldText },
                `${data.highlights.bestSubject.name}: ${data.highlights.bestSubject.average.toFixed(1)}%`
              )
            )
          : createElement(
              Text,
              { style: styles.text },
              "No data available."
            ),
        data.highlights.worstSubject
          ? createElement(
              View,
              null,
              createElement(
                Text,
                { style: styles.heading },
                "Weakest Subject"
              ),
              createElement(
                Text,
                { style: styles.boldText },
                `${data.highlights.worstSubject.name}: ${data.highlights.worstSubject.average.toFixed(1)}%`
              ),
              data.highlights.worstSubject.wCount > 0
                ? createElement(
                    Text,
                    { style: styles.wText },
                    `W grades: ${data.highlights.worstSubject.wCount}`
                  )
                : null
            )
          : null
      );

      // Page 7: W Summary
      const pg7Content = data.wSummary.hasWGrades
        ? [
            createElement(
              Text,
              { key: "wt", style: styles.slideTitle },
              "W-Grade Summary"
            ),
            ...data.wSummary.wEntries.map((entry, i) =>
              createElement(
                View,
                { key: `w-${i}`, style: styles.row },
                createElement(
                  Text,
                  { style: styles.cellSubject },
                  `${entry.termLabel} — ${entry.subject}`
                ),
                createElement(
                  Text,
                  {
                    style: {
                      ...styles.cellMark,
                      color: "#dc2626",
                      fontWeight: "bold" as const,
                    },
                  },
                  String(entry.mark)
                )
              )
            ),
            createElement(
              Text,
              {
                key: "wnote",
                style: {
                  ...styles.text,
                  marginTop: 16,
                  fontStyle: "italic" as const,
                },
              },
              "Recommendation: Focus on subjects marked with W to improve overall performance."
            ),
          ]
        : [
            createElement(
              Text,
              { key: "wt", style: styles.slideTitle },
              "W-Grade Summary"
            ),
            createElement(
              Text,
              { key: "congrats", style: { ...styles.heading, color: "#16a34a" } },
              "Congratulations!"
            ),
            createElement(
              Text,
              { key: "wm", style: styles.text },
              "No W grades across any term. Keep up the excellent work!"
            ),
          ];
      const pg7 = createElement(
        Page,
        {
          key: "wsummary",
          size: "A4" as const,
          orientation: pageOrientation,
          style: styles.page,
        },
        makeHeader(),
        ...pg7Content
      );

      // Page 8: Overall Summary
      const pg8 = createElement(
        Page,
        {
          key: "overall",
          size: "A4" as const,
          orientation: pageOrientation,
          style: styles.page,
        },
        makeHeader(),
        createElement(
          Text,
          { style: styles.slideTitle },
          "Overall Summary"
        ),
        createElement(
          Text,
          {
            style: {
              fontSize: 28,
              fontWeight: "bold" as const,
              color: data.overallStats.descriptorColor,
              textAlign: "center",
              marginVertical: 20,
            },
          },
          data.overallStats.descriptor
        ),
        createElement(
          Text,
          { style: { ...styles.text, textAlign: "center" } },
          `Total Marks: ${data.overallStats.totalMarks}`
        ),
        createElement(
          Text,
          { style: { ...styles.text, textAlign: "center" } },
          `Overall Average: ${data.overallStats.overallAverage.toFixed(1)}%`
        ),
        createElement(
          Text,
          { style: { ...styles.text, textAlign: "center" } },
          `Subjects Recorded: ${data.overallStats.totalSubjectsRecorded}`
        )
      );

      const doc = createElement(Document, null, pg1, ...termPages, pg5, pg6, pg7, pg8);
      const pdfBuffer = await renderToBuffer(doc);

      // Download
      const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.student.name.replace(/\s+/g, "-")}-preview-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
    setIsPDFExporting(false);
  }, [data, slideIndex, aspectRatio]);

  const aspectClass =
    aspectRatio === "16:9"
      ? "aspect-video max-w-5xl"
      : "aspect-[210/297] max-w-3xl";

  const themeClass = theme === "dark" ? "dark bg-gray-900 text-white" : "bg-white text-gray-900";

  function renderSlide() {
    switch (slideIndex) {
      case 0:
        return (
          <SlideOverview
            student={data.student}
            schoolName={data.schoolName}
            academicYear={data.academicYear}
          />
        );
      case 1:
        return <SlideTermMarks enrichedTerm={data.enrichedTerms[0]} />;
      case 2:
        return <SlideTermMarks enrichedTerm={data.enrichedTerms[1]} />;
      case 3:
        return <SlideTermMarks enrichedTerm={data.enrichedTerms[2]} />;
      case 4:
        return (
          <div ref={chartSlideRef}>
            <SlidePerformanceChart
              chartData={data.chartData}
              electiveLabels={data.electiveLabels}
            />
          </div>
        );
      case 5:
        return <SlideSubjectHighlights highlights={data.highlights} />;
      case 6:
        return <SlideWSummary wSummary={data.wSummary} />;
      case 7:
        return <SlideOverallSummary overallStats={data.overallStats} />;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-20">
      {/* Slide canvas */}
      <div
        style={{ fontSize: `${fontSize}em` }}
        className={`w-full ${aspectClass} ${themeClass} rounded-xl shadow-2xl border overflow-hidden relative`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIndex}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
          >
            {renderSlide()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toolbar */}
      <PresenterToolbar
        slideIndex={slideIndex}
        totalSlides={TOTAL_SLIDES}
        onPrev={goPrev}
        onNext={goNext}
        onSetSlide={setSlideIndex}
        theme={theme}
        onThemeToggle={toggleTheme}
        aspectRatio={aspectRatio}
        onAspectRatioToggle={toggleAspectRatio}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        onPrint={handlePrint}
        onDownloadPDF={handleDownloadPDF}
        isPDFExporting={isPDFExporting}
      />
    </div>
  );
}
