"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Save, Loader2, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SlideRenderer from "@/components/preview/SlideRenderer";
import { MOCK_STUDENTS } from "@/lib/preview-mock-data";
import type { SlideLabels, SlideLabelKey } from "@/types/preview";

const MOCK_DESCRIPTIONS = [
  "Mock 1 — All slides (3 terms, top class & section, W grades)",
  "Mock 2 — No ranking slides (3 terms, low rank, no W)",
  "Mock 3 — Class rank only (2 terms, W grades)",
  "Mock 4 — Section rank only (2 terms, top section)",
  "Mock 5 — Minimal (1 term, no rankings)",
];

export default function ConfigurePresenter() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [draftLabels, setDraftLabels] = useState<SlideLabels>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing Sinhala config on mount
  useEffect(() => {
    fetch("/api/preview/config?key=sinhala")
      .then((r) => r.json())
      .then((data: { labels: SlideLabels }) => {
        if (data.labels) setDraftLabels(data.labels);
      })
      .catch(() => {/* start with empty labels (defaults will show) */})
      .finally(() => setLoading(false));
  }, []);

  const handleLabelChange = useCallback((key: SlideLabelKey, value: string) => {
    setDraftLabels((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

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

  const currentData = MOCK_STUDENTS[currentIdx];

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
          Hover over any title and click the pencil icon to edit it. Use the arrows above to
          switch mock students and verify all slide types look correct.
        </span>
      </div>

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
