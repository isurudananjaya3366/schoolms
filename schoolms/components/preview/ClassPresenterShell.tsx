"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Users, X, CheckCircle2, Clock } from "lucide-react";
import SlideRenderer from "./SlideRenderer";
import type { PreviewData, SlideLabels } from "@/types/preview";

interface Student {
  id: string;
  name: string;
  indexNumber: string | null;
}

interface ClassGroup {
  grade: number;
  section: string;
}

interface ClassPresenterShellProps {
  students: Student[];
  year: number;
  classGroup: ClassGroup;
  focusTerm?: string;
  medium?: string;
}

export default function ClassPresenterShell({
  students,
  year,
  classGroup,
  focusTerm,
  medium,
}: ClassPresenterShellProps) {
  const [currentStudentIdx, setCurrentStudentIdx] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [buttonY, setButtonY] = useState(200);
  /** Set of student indices that have been explicitly marked as presented */
  const [presentedIndices, setPresentedIndices] = useState<Set<number>>(new Set());
  /** Label overrides loaded from PresentationConfig for the given medium */
  const [configLabels, setConfigLabels] = useState<SlideLabels>({});

  const isDragging = useRef(false);
  const dragStartY = useRef(0);

  // Fetch presentation config labels for the given medium
  useEffect(() => {
    if (!medium) return;
    fetch(`/api/preview/config?key=${encodeURIComponent(medium)}`)
      .then((r) => r.json())
      .then((data: { labels: SlideLabels }) => {
        if (data.labels) setConfigLabels(data.labels);
      })
      .catch(() => {/* silently ignore — falls back to defaults */});
  }, [medium]);

  // Fetch preview data whenever the current student changes
  useEffect(() => {
    const student = students[currentStudentIdx];
    if (!student) return;

    let cancelled = false;
    setLoading(true);
    setPreviewData(null);

    const termParam = focusTerm ? `&focusTerm=${encodeURIComponent(focusTerm)}` : "";
    fetch(
      `/api/preview/student-data?studentId=${encodeURIComponent(student.id)}&year=${year}${termParam}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data: PreviewData) => {
        if (!cancelled) setPreviewData(data);
      })
      .catch(() => {/* silently ignore — user sees empty state */})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentStudentIdx, students, year, focusTerm]);

  // Auto-advance to next student and mark current as presented
  const advanceToNext = useCallback(() => {
    setPresentedIndices((prev) => new Set([...prev, currentStudentIdx]));
    setCurrentStudentIdx((i) => Math.min(i + 1, students.length - 1));
  }, [currentStudentIdx, students.length]);

  // Go back to previous student
  const goToPrev = useCallback(() => {
    setCurrentStudentIdx((i) => Math.max(i - 1, 0));
  }, []);

  // Manually toggle presented state for a given student index
  const togglePresented = useCallback((idx: number) => {
    setPresentedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  // ── Draggable left-side toggle button ──────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    isDragging.current = false;
    const startClientY = e.clientY;
    dragStartY.current = e.clientY - buttonY;

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - startClientY) > 4) {
        isDragging.current = true;
      }
      if (!isDragging.current) return;
      const newY = ev.clientY - dragStartY.current;
      const maxY = window.innerHeight - 80;
      setButtonY(Math.max(40, Math.min(newY, maxY)));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleButtonClick = () => {
    if (isDragging.current) return;
    setDrawerOpen((v) => !v);
  };

  const currentStudent = students[currentStudentIdx];
  const presentedCount = presentedIndices.size;

  return (
    <div className="relative w-full min-h-screen">
      {/* ── Main content ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-50">
          <div className="size-14 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm font-medium">
            Loading {currentStudent?.name ?? "student"}…
          </p>
          <p className="text-xs text-muted-foreground">
            Student {currentStudentIdx + 1} of {students.length}
          </p>
        </div>
      ) : previewData ? (
        // key resets SlideRenderer (and its slideIndex) when student changes
        <SlideRenderer
          key={currentStudentIdx}
          data={previewData}
          onLastSlide={advanceToNext}
          onFirstSlide={goToPrev}
          labels={configLabels}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
          <p className="text-sm">No mark data available for this student in {year}.</p>
          <div className="flex gap-3">
            {currentStudentIdx > 0 && (
              <button
                className="text-xs underline hover:text-foreground transition-colors"
                onClick={goToPrev}
              >
                ← Previous student
              </button>
            )}
            {currentStudentIdx < students.length - 1 && (
              <button
                className="text-xs underline hover:text-foreground transition-colors"
                onClick={advanceToNext}
              >
                Skip to next →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Draggable left-side drawer toggle ──────────────────────────────── */}
      <button
        className="fixed left-0 z-50 flex items-center gap-1.5 rounded-r-lg bg-primary text-primary-foreground px-2 py-3 shadow-lg select-none hover:bg-primary/90 transition-colors touch-none"
        style={{ top: buttonY, cursor: isDragging.current ? "grabbing" : "grab" }}
        onPointerDown={handlePointerDown}
        onClick={handleButtonClick}
        aria-label="Toggle student list"
      >
        <Users className="size-4 shrink-0" />
        <span className="text-[11px] font-semibold leading-tight hidden sm:flex flex-col items-start">
          <span>Class</span>
          <span className="opacity-70">{currentStudentIdx + 1}/{students.length}</span>
        </span>
        <ChevronRight
          className={`size-3 shrink-0 transition-transform duration-200 ${drawerOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-background border-r shadow-2xl flex flex-col"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40 shrink-0">
                <div>
                  <p className="font-semibold text-sm">
                    Grade {classGroup.grade}{classGroup.section}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {presentedCount}/{students.length} presented · {year}
                  </p>
                </div>
                <button
                  className="p-1 rounded-md hover:bg-accent transition-colors"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close drawer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-muted shrink-0">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width: students.length > 0
                      ? `${(presentedCount / students.length) * 100}%`
                      : "0%",
                  }}
                />
              </div>

              {/* Student list */}
              <div className="flex-1 overflow-y-auto py-1.5">
                {students.map((student, idx) => {
                  const isCurrent = idx === currentStudentIdx;
                  const isPresented = presentedIndices.has(idx);

                  return (
                    <div
                      key={student.id}
                      className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                        isCurrent
                          ? "bg-primary/10 border-l-[3px] border-primary"
                          : "border-l-[3px] border-transparent hover:bg-accent/60"
                      } ${isPresented && !isCurrent ? "opacity-60" : ""}`}
                    >
                      {/* Position / status badge */}
                      <div
                        className={`size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : isPresented
                            ? "bg-green-100 text-green-700"
                            : "bg-muted/50 text-foreground/70"
                        }`}
                      >
                        {isPresented && !isCurrent ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          idx + 1
                        )}
                      </div>

                      {/* Name + index — clickable to switch to that student */}
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setCurrentStudentIdx(idx);
                          setDrawerOpen(false);
                        }}
                      >
                        <p
                          className={`text-sm font-medium truncate ${
                            isCurrent ? "text-primary" : ""
                          }`}
                        >
                          {student.name}
                        </p>
                        {student.indexNumber && (
                          <p className="text-xs text-muted-foreground truncate">
                            {student.indexNumber}
                          </p>
                        )}
                      </button>

                      {/* Status / manual mark button */}
                      {isCurrent ? (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                          NOW
                        </span>
                      ) : (
                        <button
                          className={`shrink-0 p-1 rounded transition-colors ${
                            isPresented
                              ? "text-green-600 hover:text-red-500 hover:bg-red-50"
                              : "text-muted-foreground hover:text-green-600 hover:bg-green-50"
                          }`}
                          title={isPresented ? "Unmark as presented" : "Mark as presented"}
                          onClick={() => togglePresented(idx)}
                        >
                          {isPresented ? (
                            <CheckCircle2 className="size-4" />
                          ) : (
                            <Clock className="size-4" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t px-4 py-3 shrink-0 bg-muted/20">
                <p className="text-xs text-muted-foreground text-center">
                  {presentedCount} of {students.length} presented
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
