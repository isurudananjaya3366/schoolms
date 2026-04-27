"use client";

import { useState, useCallback, useEffect, useRef, useMemo, CSSProperties } from "react";
import { createElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PresenterToolbar from "./PresenterToolbar";
import SlideOverview from "./slides/SlideOverview";
import SlideAllTermsMarks from "./slides/SlideAllTermsMarks";
import SlideAnnualSummary from "./slides/SlideAnnualSummary";
import SlidePerformanceChart from "./slides/SlidePerformanceChart";
import SlideSubjectHighlights from "./slides/SlideSubjectHighlights";
import SlideWSummary from "./slides/SlideWSummary";
import SlideOverallSummary from "./slides/SlideOverallSummary";
import SlideTopClassPerformers from "./slides/SlideTopClassPerformers";
import SlideTopSectionPerformers from "./slides/SlideTopSectionPerformers";
import { EditLabelsContext } from "./EditLabelsContext";
import type { PreviewData, EnrichedTerm, SlideLabels, SlideLabelKey } from "@/types/preview";
import type { TermMarkData } from "@/types/charts";

type SlideDesc =
  | { id: string; type: "overview" }
  | { id: string; type: "allTermsMarks"; terms: EnrichedTerm[] }
  | { id: string; type: "topClass" }
  | { id: string; type: "topSection" }
  | { id: string; type: "latestChart"; chartData: TermMarkData[] }
  | { id: string; type: "chart"; chartData: TermMarkData[] }
  | { id: string; type: "annualSummary" }
  | { id: string; type: "highlights" }
  | { id: string; type: "wSummary" }
  | { id: string; type: "overallSummary" };

interface SlideRendererProps {
  data: PreviewData;
  /** Called when the user advances past the final slide (e.g. to auto-load next student). */
  onLastSlide?: () => void;
  /** Called when the user goes back before the first slide (e.g. to load previous student). */
  onFirstSlide?: () => void;
  /** Label overrides (from PresentationConfig for a given medium). */
  labels?: SlideLabels;
  /** Whether slide titles are inline-editable (configure mode). */
  isEditable?: boolean;
  /** Called when a label is changed in configure mode. */
  onLabelChange?: (key: SlideLabelKey, value: string) => void;
}

export default function SlideRenderer({ data, onLastSlide, onFirstSlide, labels, isEditable, onLabelChange }: SlideRendererProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "A4">("16:9");
  const [fontSize, setFontSize] = useState(1.0);
  const [isPDFExporting, setIsPDFExporting] = useState(false);
  const chartSlideRef = useRef<HTMLDivElement>(null);
  const latestChartSlideRef = useRef<HTMLDivElement>(null);

  const slideDescriptors = useMemo((): SlideDesc[] => {
    const list: SlideDesc[] = [];
    list.push({ id: "overview", type: "overview" });
    const termsWithData = data.enrichedTerms.filter((t) => t.hasData);
    if (termsWithData.length > 0) {
      list.push({ id: "allTermsMarks", type: "allTermsMarks", terms: termsWithData });
    }
    // Conditional: class top-10 ranking slide
    if (
      data.ranking?.classRank !== null &&
      data.ranking?.classRank !== undefined &&
      data.ranking.classRank <= 10
    ) {
      list.push({ id: "topClass", type: "topClass" });
    }
    // Conditional: section (grade-level) top-10 ranking slide
    if (
      data.ranking?.sectionRank !== null &&
      data.ranking?.sectionRank !== undefined &&
      data.ranking.sectionRank <= 10
    ) {
      list.push({ id: "topSection", type: "topSection" });
    }
    const hasAnyTermData = data.enrichedTerms.some((t) => t.hasData);
    if (hasAnyTermData) {
      const filteredChartData = data.chartData.filter((d) =>
        data.enrichedTerms.find((t) => t.termKey === d.termKey)?.hasData,
      );
      // latestChart slide removed - focus term chart is now on the Term Marks slide
      list.push({ id: "chart", type: "chart", chartData: filteredChartData });
    }
    // Conditional: annual summary (only when all 3 terms have data)
    if (data.annualStats) list.push({ id: "annualSummary", type: "annualSummary" });
    list.push({ id: "highlights", type: "highlights" });
    if (data.wSummary.hasWGrades) list.push({ id: "wSummary", type: "wSummary" });
    list.push({ id: "overallSummary", type: "overallSummary" });
    return list;
  }, [data]);
  const totalSlides = slideDescriptors.length;

  const goNext = useCallback(() => {
    if (slideIndex >= totalSlides - 1) {
      onLastSlide?.();
      return;
    }
    setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
  }, [slideIndex, totalSlides, onLastSlide]);

  const goPrev = useCallback(() => {
    if (slideIndex <= 0) {
      onFirstSlide?.();
      return;
    }
    setSlideIndex((i) => Math.max(i - 1, 0));
  }, [slideIndex, onFirstSlide]);

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
      // 1. Capture chart slides via html-to-image
      const previousIndex = slideIndex;
      const { toPng } = await import("html-to-image");

      let latestChartImageBase64: string | null = null;
      const latestChartIdx = slideDescriptors.findIndex((s) => s.type === "latestChart");
      if (latestChartIdx >= 0) {
        setSlideIndex(latestChartIdx);
        await new Promise((r) => setTimeout(r, 600));
        if (latestChartSlideRef.current) {
          latestChartImageBase64 = await toPng(latestChartSlideRef.current, {
            pixelRatio: 2,
            backgroundColor: "#ffffff",
          });
        }
      }

      const chartIdx = slideDescriptors.findIndex((s) => s.type === "chart");
      if (chartIdx >= 0) setSlideIndex(chartIdx);
      await new Promise((r) => setTimeout(r, 600));
      let chartImageBase64: string | null = null;
      if (chartSlideRef.current) {
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
            `Grade ${data.student.grade} - ${data.student.className}`
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

      // Page 2: Combined term marks table (rows = terms, cols = subjects)
      const hasLatestChartPage = latestChartIdx >= 0;
      const allTermsWithData = data.enrichedTerms.filter((et) => et.hasData);
      const subjectCols = (allTermsWithData[0]?.subjects ?? []);
      const colWidth = subjectCols.length > 0 ? `${50 / subjectCols.length}%` : "10%";
      const termRows = allTermsWithData.map((et, ti) =>
        createElement(
          View,
          { key: `tr-${ti}`, style: styles.row },
          createElement(
            Text,
            {
              style: {
                ...styles.cellSubject,
                fontWeight: et.termKey === data.focusTerm ? "bold" as const : "normal" as const,
                color: et.termKey === data.focusTerm ? "#d97706" : "#374151",
              },
            },
            et.termLabel
          ),
          ...subjectCols.map((subj, si) => {
            const cell = et.subjects[si];
            return createElement(
              Text,
              {
                key: `tc-${si}`,
                style: {
                  width: colWidth,
                  fontSize: 9,
                  textAlign: "right" as const,
                  ...(cell?.isW ? { color: "#dc2626", fontWeight: "bold" as const } : {}),
                },
              },
              cell?.display ?? "-"
            );
          })
        )
      );
      const headerRow = createElement(
        View,
        { key: "mh", style: { ...styles.row, borderBottomWidth: 2 } },
        createElement(Text, { style: { ...styles.cellSubject, fontWeight: "bold" as const } }, "Term"),
        ...subjectCols.map((subj, si) =>
          createElement(Text, {
            key: `mhc-${si}`,
            style: {
              width: colWidth,
              fontSize: 9,
              fontWeight: "bold" as const,
              textAlign: "right" as const,
              color: "#374151",
            },
          }, subj.displayName)
        )
      );
      const termPages = allTermsWithData.length > 0
        ? [
            createElement(
              Page,
              {
                key: "term-marks",
                size: "A4" as const,
                orientation: pageOrientation,
                style: styles.page,
              },
              makeHeader(),
              createElement(Text, { style: styles.slideTitle }, "Term Marks"),
              createElement(View, null, headerRow, ...termRows)
            ),
          ]
        : [];

      // Latest term chart page (only if >= 2 terms)
      const pgLatestChart = hasLatestChartPage
        ? createElement(
            Page,
            {
              key: "latestChart",
              size: "A4" as const,
              orientation: pageOrientation,
              style: styles.page,
            },
            makeHeader(),
            createElement(
              Text,
              { style: styles.slideTitle },
              "Latest Term Performance"
            ),
            latestChartImageBase64
              ? createElement(Image, {
                  style: styles.chartImage,
                  src: latestChartImageBase64,
                })
              : createElement(
                  Text,
                  { style: styles.text },
                  "Chart capture unavailable."
                )
          )
        : null;

      // Full performance chart page
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
                  `${entry.termLabel} - ${entry.subject}`
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

      // Optional: Annual Summary page (only when all 3 terms have data)
      const pgAnnual = data.annualStats
        ? createElement(
            Page,
            {
              key: "annual",
              size: "A4" as const,
              orientation: pageOrientation,
              style: styles.page,
            },
            makeHeader(),
            createElement(Text, { style: styles.slideTitle }, `Annual Summary - ${data.academicYear}`),
            createElement(
              Text,
              {
                style: {
                  fontSize: 24,
                  fontWeight: "bold" as const,
                  color: data.annualStats.descriptorColor,
                  textAlign: "center",
                  marginVertical: 12,
                },
              },
              data.annualStats.descriptor
            ),
            createElement(
              Text,
              { style: { ...styles.text, textAlign: "center" } },
              `Year Average: ${data.annualStats.overallAverage.toFixed(1)}%`
            ),
            createElement(Text, { style: { ...styles.spacer } }, ""),
            ...data.annualStats.subjectAverages.map((s, idx) =>
              createElement(
                View,
                { key: `as-${idx}`, style: styles.row },
                createElement(Text, { style: styles.cellSubject }, s.name),
                createElement(
                  Text,
                  { style: { ...styles.cellMark, color: s.color } },
                  `${s.average.toFixed(1)}%`
                )
              )
            )
          )
        : null;

      const doc = createElement(
        Document,
        null,
        pg1,
        ...termPages,
        ...(pgLatestChart ? [pgLatestChart] : []),
        pg5,
        ...(pgAnnual ? [pgAnnual] : []),
        pg6,
        pg7,
        pg8
      );
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
  }, [data, slideIndex, aspectRatio, slideDescriptors]);

  // Design (logical) dimensions for the slide
  const DESIGN_W = aspectRatio === "16:9" ? 1280 : 794;
  const DESIGN_H = aspectRatio === "16:9" ? 720 : 1123;

  // Container ref for measuring available space
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const TOOLBAR_H = 72; // reserved space for toolbar
    const PADDING = 32; // total vertical padding
    const updateScale = () => {
      if (!containerRef.current) return;
      const avW = containerRef.current.clientWidth;
      const avH = window.innerHeight - TOOLBAR_H - PADDING;
      const s = Math.min(avW / DESIGN_W, avH / DESIGN_H);
      setScale(Math.max(0.2, Math.min(s, 2)));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatio]);

  const slideOuterStyle: CSSProperties = {
    width: DESIGN_W * scale,
    height: DESIGN_H * scale,
    flexShrink: 0,
  };
  const slideInnerStyle: CSSProperties = {
    width: DESIGN_W,
    height: DESIGN_H,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    fontSize: `${fontSize}em`,
  };

  const themeClass = theme === "dark" ? "dark bg-gray-900 text-white" : "bg-white text-gray-900";

  function renderSlide() {
    const desc = slideDescriptors[slideIndex];
    if (!desc) return null;
    switch (desc.type) {
      case "overview":
        return (
          <SlideOverview
            student={data.student}
            schoolName={data.schoolName}
            academicYear={data.academicYear}
          />
        );
      case "allTermsMarks": {
        const filteredForFocus = data.chartData.filter((d) =>
          data.enrichedTerms.find((t) => t.termKey === d.termKey)?.hasData,
        );
        const focusEntry = filteredForFocus.find((d) => d.termKey === data.focusTerm);
        const focusChartData = focusEntry
          ? [focusEntry]
          : filteredForFocus.length > 0
          ? [filteredForFocus[filteredForFocus.length - 1]]
          : [];
        return (
          <SlideAllTermsMarks
            terms={desc.terms}
            focusTerm={data.focusTerm}
            scholarshipMarks={data.student.scholarshipMarks}
            termRanks={data.termRanks}
            focusChartData={focusChartData}
            electiveLabels={data.electiveLabels}
          />
        );
      }
      case "topClass":
        return data.ranking ? (
          <SlideTopClassPerformers
            ranking={data.ranking}
            className={data.student.className}
          />
        ) : null;
      case "topSection":
        return data.ranking ? (
          <SlideTopSectionPerformers
            ranking={data.ranking}
            grade={data.student.grade}
          />
        ) : null;
      case "latestChart":
        return (
          <div ref={latestChartSlideRef} className="h-full">
            <SlidePerformanceChart
              chartData={desc.chartData}
              electiveLabels={data.electiveLabels}
              title={`${desc.chartData[0]?.term ?? "Latest Term"} Performance`}
              labelKey="focusChart"
            />
          </div>
        );
      case "chart":
        return (
          <div ref={chartSlideRef} className="h-full">
            <SlidePerformanceChart
              chartData={desc.chartData}
              electiveLabels={data.electiveLabels}
              title="Performance Overview"
              labelKey="chart"
            />
          </div>
        );
      case "annualSummary":
        return data.annualStats ? (
          <SlideAnnualSummary
            annualStats={data.annualStats}
            academicYear={data.academicYear}
          />
        ) : null;
      case "highlights":
        return (
          <SlideSubjectHighlights
            highlights={data.highlights}
            focusTermLabel={
              data.enrichedTerms.find((t) => t.termKey === data.focusTerm)?.termLabel
            }
          />
        );
      case "wSummary":
        return <SlideWSummary wSummary={data.wSummary} />;
      case "overallSummary":
        return (
          <SlideOverallSummary
            overallStats={data.overallStats}
            focusTermLabel={
              data.enrichedTerms.find((t) => t.termKey === data.focusTerm)?.termLabel
            }
          />
        );
      default:
        return null;
    }
  }

  return (
    <EditLabelsContext.Provider
      value={{
        isEditable: isEditable ?? false,
        labels: labels ?? {},
        onLabelChange: onLabelChange ?? (() => {}),
      }}
    >
    <div ref={containerRef} className="h-screen overflow-hidden flex flex-col items-center justify-center py-4 pb-20 px-4">
      {/* Slide canvas - scale-to-fit */}
      <div style={slideOuterStyle} className="shrink-0">
      <div
        style={slideInnerStyle}
        className={`${themeClass} rounded-xl shadow-2xl border overflow-hidden relative`}
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
      </div>

      {/* Toolbar */}
      <PresenterToolbar
        slideIndex={slideIndex}
        totalSlides={totalSlides}
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
        hasPrevStudent={!!onFirstSlide}
        hasNextStudent={!!onLastSlide}
      />
    </div>
    </EditLabelsContext.Provider>
  );
}
