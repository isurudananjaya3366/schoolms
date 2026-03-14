"use client";

import { useState } from "react";
import { X, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Meeting {
  id: string;
  title: string;
  classGroup: string;
  date: string;
  startTime: string;
  endTime: string | null;
  description: string | null;
  createdBy: string;
}

interface ClassGroup {
  id: string;
  grade: number;
  section: string;
}

interface ConflictInfo {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
}

interface MeetingFormModalProps {
  classGroups: ClassGroup[];
  initialDate: string;
  meeting: Meeting | null; // null = create, non-null = edit
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

export default function MeetingFormModal({
  classGroups,
  initialDate,
  meeting,
  onSaved,
  onDeleted,
  onClose,
}: MeetingFormModalProps) {
  const isEdit = meeting !== null;

  const [title, setTitle] = useState(meeting?.title ?? "");
  const [classGroup, setClassGroup] = useState(meeting?.classGroup ?? "");
  const [date, setDate] = useState(meeting?.date ?? initialDate);
  const [startTime, setStartTime] = useState(meeting?.startTime ?? "");
  const [endTime, setEndTime] = useState(meeting?.endTime ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Build sorted class group options
  const classOptions = classGroups
    .slice()
    .sort((a, b) => a.grade !== b.grade ? a.grade - b.grade : a.section.localeCompare(b.section))
    .map((cg) => `${cg.grade}${cg.section}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflicts([]);

    if (!title.trim()) { setError("Title is required."); return; }
    if (!classGroup) { setError("Class is required."); return; }
    if (!date) { setError("Date is required."); return; }
    if (!startTime) { setError("Start time is required."); return; }
    if (endTime && endTime <= startTime) {
      setError("End time must be after start time."); return;
    }

    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        classGroup,
        date,
        startTime,
        endTime: endTime || null,
        description: description.trim() || null,
      };

      const url = isEdit ? `/api/meetings/${meeting.id}` : "/api/meetings";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const data: { error: string; conflicts: ConflictInfo[] } = await res.json();
        setConflicts(data.conflicts);
      } else if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? "Failed to save meeting.");
      } else {
        onSaved();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted();
      } else {
        setError("Failed to delete meeting.");
        setShowDeleteConfirm(false);
      }
    } catch {
      setError("Network error.");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit Meeting" : "Schedule Meeting"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Parent-Teacher Meeting"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Class */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Class <span className="text-destructive">*</span>
            </label>
            <select
              value={classGroup}
              onChange={(e) => setClassGroup(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a class…</option>
              <option value="ALL">All Classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Date <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Start Time <span className="text-destructive">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                End Time <span className="text-xs">(optional)</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Description <span className="text-xs">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Additional details…"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium">
                <AlertTriangle className="size-4 shrink-0" />
                Time conflict with {conflicts.length} existing meeting{conflicts.length > 1 ? "s" : ""}:
              </div>
              {conflicts.map((c) => (
                <p key={c.id} className="text-xs text-amber-700 dark:text-amber-300 pl-6">
                  &ldquo;{c.title}&rdquo; at {c.startTime}{c.endTime ? `–${c.endTime}` : ""}
                </p>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Footer actions */}
          <div className="flex justify-between items-center pt-1">
            <div>
              {isEdit && (
                <>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Confirm delete?</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="gap-1"
                      >
                        {deleting ? <Loader2 className="size-3 animate-spin" /> : null}
                        Yes, Delete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {isEdit ? "Save Changes" : "Schedule"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
