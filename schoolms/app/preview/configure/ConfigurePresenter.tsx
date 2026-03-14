"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Save, Loader2, CheckCircle2, Info, RotateCcw, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SlideRenderer from "@/components/preview/SlideRenderer";
import { MOCK_STUDENTS } from "@/lib/preview-mock-data";
import type { SlideLabels, SlideLabelKey, PreviewData } from "@/types/preview";

const MOCK_DESCRIPTIONS = [
  "Mock 1 - All slides (3 terms, top class & section, W grades)",
  "Mock 2 - No ranking slides (3 terms, low rank, no W)",
  "Mock 3 - Class rank only (2 terms, W grades)",
  "Mock 4 - Section rank only (2 terms, top section)",
  "Mock 5 - Minimal (1 term, no rankings)",
];

export default function ConfigurePresenter() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [draftLabels, setDraftLabels] = useState<SlideLabels>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [schoolName, setSchoolName] = useState<string>("SchoolMS");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetText, setResetText] = useState("");
  const resetInputRef = useRef<HTMLInputElement>(null);

  // ── Undo / Redo history ────────────────────────────────────────────────
  const historyRef = useRef<SlideLabels[]>([{}]);
  const historyIdxRef = useRef(0);
  const lastChangeKeyRef = useRef<SlideLabelKey | null>(null);
  const lastChangeTimeRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryState = () => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  // Load existing Sinhala config and school name on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/preview/config?key=sinhala")
        .then((r) => r.json())
        .then((data: { labels: SlideLabels }) => {
          if (data.labels) {
            setDraftLabels(data.labels);
            historyRef.current = [data.labels];
            historyIdxRef.current = 0;
          }
        })
        .catch(() => {}),
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data: Record<string, string>) => {
          if (data.school_name) setSchoolName(data.school_name);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleLabelChange = useCallback((key: SlideLabelKey, value: string) => {
    setDraftLabels((prev) => {
      const next = { ...prev, [key]: value };
      const now = Date.now();
      const isSameKey = lastChangeKeyRef.current === key;
      const isRecent = now - lastChangeTimeRef.current < 800;
      if (isSameKey && isRecent) {
        // Coalesce: replace current history entry
        historyRef.current[historyIdxRef.current] = next;
      } else {
        // New entry: truncate future
        historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
        historyRef.current.push(next);
        historyIdxRef.current = historyRef.current.length - 1;
      }
      lastChangeKeyRef.current = key;
      lastChangeTimeRef.current = now;
      syncHistoryState();
      return next;
    });
    setSaved(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current--;
      lastChangeKeyRef.current = null;
      const labels = historyRef.current[historyIdxRef.current];
      setDraftLabels(labels);
      setSaved(false);
      syncHistoryState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current++;
      lastChangeKeyRef.current = null;
      const labels = historyRef.current[historyIdxRef.current];
      setDraftLabels(labels);
      setSaved(false);
      syncHistoryState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  const openResetModal = () => {
    setResetText("");
    setShowResetModal(true);
    setTimeout(() => resetInputRef.current?.focus(), 50);
  };

  const handleReset = async () => {
    setShowResetModal(false);
    setDraftLabels({});
    setSaved(false);
    // Push reset to history
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push({});
    historyIdxRef.current = historyRef.current.length - 1;
    lastChangeKeyRef.current = null;
    syncHistoryState();
    try {
      await fetch("/api/preview/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sinhala", labels: {} }),
      });
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/preview/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sinhala", labels: draftLabels }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  // Inject actual school name into the current mock student
  const currentMock = MOCK_STUDENTS[currentIdx];
  const currentData: PreviewData | undefined = currentMock
    ? { ...currentMock, schoolName }
    : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>Loading configuration…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h1 className="text-sm font-semibold leading-none">
              Configure Sinhala Presentation
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any slide title to edit it
            </p>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {MOCK_DESCRIPTIONS[currentIdx]}
          </Badge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mock student navigator */}
          <div className="flex items-center gap-1 border rounded-md">
            <button
              className="p-1.5 hover:bg-accent rounded-l-md transition-colors disabled:opacity-40"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              aria-label="Previous mock student"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-xs font-medium text-muted-foreground">
              {currentIdx + 1} / {MOCK_STUDENTS.length}
            </span>
            <button
              className="p-1.5 hover:bg-accent rounded-r-md transition-colors disabled:opacity-40"
              onClick={() => setCurrentIdx((i) => Math.min(MOCK_STUDENTS.length - 1, i + 1))}
              disabled={currentIdx === MOCK_STUDENTS.length - 1}
              aria-label="Next mock student"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border rounded-md">
            <button
              className="p-1.5 hover:bg-accent rounded-l-md transition-colors disabled:opacity-40"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="size-4" />
            </button>
            <button
              className="p-1.5 hover:bg-accent rounded-r-md transition-colors disabled:opacity-40"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="size-4" />
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={openResetModal}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="size-3.5 text-green-500" />
            ) : (
              <Save className="size-3.5" />
            )}
            {saved ? "Saved" : "Save Labels"}
          </Button>
        </div>
      </div>

      {/* ── Info banner ────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
        <Info className="size-3.5 mt-0.5 shrink-0" />
        <span>
          These labels apply to the <strong>Sinhala medium</strong> presentation only.
          Hover over any title or description and click the pencil icon to edit it. Use the
          arrows above to switch mock students and verify all slide types look correct.
        </span>
      </div>

      {/* ── Reset confirmation modal ──────────────────────────────────────── */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowResetModal(false); }}
        >
          <div className="bg-background border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold mb-1">Reset to Defaults?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              All customised Sinhala labels will be cleared and reset to the
              English medium defaults. This cannot be undone.
            </p>
            <p className="text-sm font-medium mb-2">
              Type <span className="font-mono bg-muted px-1 rounded">confirm</span> to proceed:
            </p>
            <input
              ref={resetInputRef}
              type="text"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && resetText === "confirm") handleReset();
                if (e.key === "Escape") setShowResetModal(false);
              }}
              placeholder="confirm"
              className="w-full border rounded-md px-3 py-2 text-sm mb-4 bg-background outline-none focus:ring-2 focus:ring-destructive/50"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={resetText !== "confirm"}
                onClick={handleReset}
              >
                Reset Labels
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide renderer ─────────────────────────────────────────────────── */}
      <div className="flex-1">
        {currentData && (
          <SlideRenderer
            key={currentIdx}
            data={currentData}
            labels={draftLabels}
            isEditable
            onLabelChange={handleLabelChange}
          />
        )}
      </div>
    </div>
  );
}


