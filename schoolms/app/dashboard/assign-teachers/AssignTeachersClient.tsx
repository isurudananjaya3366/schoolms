"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { UserCheck, Loader2, Plus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type TeacherUser = { id: string; name: string | null; email: string };
type ClassGroup = { id: string; grade: number; section: string };
type ElectiveOptions = { catI: string[]; catII: string[]; catIII: string[] };

type AssignmentType = "MAIN" | "ADDITIONAL" | "SUBJECT";

interface TeacherAssignmentRecord {
  id: string;
  teacherId: string;
  type: AssignmentType;
  subject: string | null;
  electiveName: string | null;
}

// Working state for editor
interface AssignmentState {
  mainTeacherId: string | null;
  additionalTeacherIds: string[];
  // subject key → teacherId | null
  subjectAssignments: Record<string, string | null>;
}

const CORE_SUBJECTS = [
  { key: "sinhala", label: "Sinhala" },
  { key: "buddhism", label: "Buddhism" },
  { key: "maths", label: "Maths" },
  { key: "science", label: "Science" },
  { key: "english", label: "English" },
  { key: "history", label: "History" },
] as const;

// Build a unique key for (subject, electiveName) pairs
function electiveKey(cat: string, name: string) {
  return `${cat}::${name}`;
}

interface Props {
  classes: ClassGroup[];
  teachers: TeacherUser[];
  electiveOptions: ElectiveOptions;
}

function teacherLabel(t: TeacherUser) {
  return t.name ? `${t.name} (${t.email})` : t.email;
}

const NONE = "__none__";

export default function AssignTeachersClient({ classes, teachers, electiveOptions }: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [state, setState] = useState<AssignmentState>({
    mainTeacherId: null,
    additionalTeacherIds: [],
    subjectAssignments: {},
  });
  const [addAdditionalId, setAddAdditionalId] = useState<string>(NONE);
  const [isPending, startTransition] = useTransition();

  // All possible elective subject keys (for the working state object)
  const allElectiveSubjectKeys = [
    ...electiveOptions.catI.map((n) => electiveKey("categoryI", n)),
    ...electiveOptions.catII.map((n) => electiveKey("categoryII", n)),
    ...electiveOptions.catIII.map((n) => electiveKey("categoryIII", n)),
  ];
  const allSubjectKeys = [
    ...CORE_SUBJECTS.map((s) => s.key),
    ...allElectiveSubjectKeys,
  ];

  // Build initial empty assignment state
  function emptyState(): AssignmentState {
    const subjectAssignments: Record<string, string | null> = {};
    for (const k of allSubjectKeys) subjectAssignments[k] = null;
    return { mainTeacherId: null, additionalTeacherIds: [], subjectAssignments };
  }

  // Build assignment state from API records
  const buildStateFromRecords = useCallback(
    (records: TeacherAssignmentRecord[]): AssignmentState => {
      const base = emptyState();
      for (const r of records) {
        if (r.type === "MAIN") {
          base.mainTeacherId = r.teacherId;
        } else if (r.type === "ADDITIONAL") {
          base.additionalTeacherIds.push(r.teacherId);
        } else if (r.type === "SUBJECT" && r.subject) {
          const k = r.electiveName
            ? electiveKey(r.subject, r.electiveName)
            : r.subject;
          base.subjectAssignments[k] = r.teacherId;
        }
      }
      return base;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Fetch assignments when class changes
  useEffect(() => {
    if (!selectedClassId) return;
    setLoadingAssignments(true);
    setState(emptyState());
    fetch(`/api/teachers/assign?classId=${selectedClassId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((records: TeacherAssignmentRecord[]) => {
        setState(buildStateFromRecords(records));
      })
      .catch(() => toast.error("Failed to load existing assignments."))
      .finally(() => setLoadingAssignments(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  // Track additional teacher IDs to prevent adding the same person twice
  const additionalSet = new Set<string>(state.additionalTeacherIds);

  // ─── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!selectedClassId) return;

    // Build the assignments array for PUT
    type Assignment = {
      teacherId: string;
      type: AssignmentType;
      subject?: string;
      electiveName?: string;
    };
    const assignments: Assignment[] = [];

    if (state.mainTeacherId) {
      assignments.push({ teacherId: state.mainTeacherId, type: "MAIN" });
    }
    for (const tid of state.additionalTeacherIds) {
      assignments.push({ teacherId: tid, type: "ADDITIONAL" });
    }
    for (const [key, tid] of Object.entries(state.subjectAssignments)) {
      if (!tid) continue;
      if (key.includes("::")) {
        const [subject, electiveName] = key.split("::");
        assignments.push({ teacherId: tid, type: "SUBJECT", subject, electiveName });
      } else {
        assignments.push({ teacherId: tid, type: "SUBJECT", subject: key });
      }
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/teachers/assign", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: selectedClassId, assignments }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Request failed" }));
          toast.error(error ?? "Failed to save assignments.");
          return;
        }
        const cls = classes.find((c) => c.id === selectedClassId);
        toast.success(
          `Assignments saved for Grade ${cls?.grade ?? ""}${cls?.section ?? ""}.`
        );
      } catch {
        toast.error("An unexpected error occurred.");
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function setSubject(key: string, teacherId: string | null) {
    setState((prev) => ({
      ...prev,
      subjectAssignments: { ...prev.subjectAssignments, [key]: teacherId },
    }));
  }

  function removeAdditional(tid: string) {
    setState((prev) => ({
      ...prev,
      additionalTeacherIds: prev.additionalTeacherIds.filter((id) => id !== tid),
    }));
  }

  function addAdditional() {
    if (addAdditionalId === NONE) return;
    if (state.additionalTeacherIds.includes(addAdditionalId)) return;
    setState((prev) => ({
      ...prev,
      additionalTeacherIds: [...prev.additionalTeacherIds, addAdditionalId],
    }));
    setAddAdditionalId(NONE);
  }

  // Build a teacher dropdown (used multiple times)
  function TeacherSelect({
    value,
    onChange,
    placeholder = "Select a teacher…",
    excludeIds = [],
  }: {
    value: string | null;
    onChange: (v: string | null) => void;
    placeholder?: string;
    excludeIds?: string[];
  }) {
    return (
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
      >
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">— None —</span>
          </SelectItem>
          {teachers.map((t) => {
            const excluded = excludeIds.includes(t.id);
            return (
              <SelectItem key={t.id} value={t.id} disabled={excluded && t.id !== value}>
                <span className="flex items-center gap-1.5">
                  {teacherLabel(t)}
                  {excluded && t.id !== value && (
                    <span className="text-xs text-amber-600">(already assigned)</span>
                  )}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assign Teachers</h1>
          <p className="text-sm text-muted-foreground">
            Assign teachers to classes by role and subject
          </p>
        </div>
      </div>

      {/* Class selector */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">Select class:</label>
        <Select value={selectedClassId ?? ""} onValueChange={(v) => setSelectedClassId(v || null)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Choose a class…" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                Grade {c.grade} — {c.section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* No class selected */}
      {!selectedClassId && (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">Select a class to manage its teacher assignments.</p>
        </div>
      )}

      {/* Loading */}
      {selectedClassId && loadingAssignments && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {/* Assignment form */}
      {selectedClassId && !loadingAssignments && (
        <div className="space-y-6">
          {/* Full Access Teachers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Full Access Teachers</CardTitle>
              <p className="text-xs text-muted-foreground">
                These teachers can enter marks for <em>any subject and any student</em> in this class.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main class teacher */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-44 text-sm font-medium">Main class teacher</span>
                <TeacherSelect
                  value={state.mainTeacherId}
                  onChange={(v) =>
                    setState((prev) => ({ ...prev, mainTeacherId: v }))
                  }
                />
              </div>

              {/* Additional teachers */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Additional teachers</span>
                {state.additionalTeacherIds.length === 0 && (
                  <p className="text-xs text-muted-foreground">No additional teachers assigned.</p>
                )}
                {state.additionalTeacherIds.map((tid) => {
                  const t = teachers.find((t) => t.id === tid);
                  return (
                    <div key={tid} className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1.5 py-1 px-2 text-xs">
                        {t ? teacherLabel(t) : tid}
                        <button
                          onClick={() => removeAdditional(tid)}
                          className="ml-1 rounded-sm opacity-70 hover:opacity-100 transition"
                          aria-label="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </div>
                  );
                })}

                {/* Add additional */}
                <div className="flex items-center gap-2 pt-1">
                  <Select value={addAdditionalId} onValueChange={setAddAdditionalId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Add additional teacher…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        <span className="text-muted-foreground">— Select to add —</span>
                      </SelectItem>
                      {teachers.map((t) => {
                        const alreadyAdditional = additionalSet.has(t.id);
                        return (
                          <SelectItem key={t.id} value={t.id} disabled={alreadyAdditional}>
                            <span className="flex items-center gap-1.5">
                              {teacherLabel(t)}
                              {alreadyAdditional && (
                                <span className="text-xs text-amber-600">(already added)</span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={addAdditional} disabled={addAdditionalId === NONE}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subject Teachers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Subject Teachers</CardTitle>
              <p className="text-xs text-muted-foreground">
                Subject teachers can enter marks <em>only for their assigned subject</em>. Elective teachers also see only students who selected that elective.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Core subjects */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core Subjects</p>
                <div className="space-y-2">
                  {CORE_SUBJECTS.map(({ key, label }) => (
                    <div key={key} className="flex flex-wrap items-center gap-3">
                      <span className="w-28 text-sm">{label}</span>
                      <TeacherSelect
                        value={state.subjectAssignments[key] ?? null}
                        onChange={(v) => setSubject(key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Category I electives */}
              {electiveOptions.catI.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category I Electives</p>
                  <div className="space-y-2">
                    {electiveOptions.catI.map((name) => {
                      const k = electiveKey("categoryI", name);
                      return (
                        <div key={k} className="flex flex-wrap items-center gap-3">
                          <span className="w-28 text-sm">{name}</span>
                          <TeacherSelect
                            value={state.subjectAssignments[k] ?? null}
                            onChange={(v) => setSubject(k, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category II electives */}
              {electiveOptions.catII.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category II Electives</p>
                  <div className="space-y-2">
                    {electiveOptions.catII.map((name) => {
                      const k = electiveKey("categoryII", name);
                      return (
                        <div key={k} className="flex flex-wrap items-center gap-3">
                          <span className="w-28 text-sm">{name}</span>
                          <TeacherSelect
                            value={state.subjectAssignments[k] ?? null}
                            onChange={(v) => setSubject(k, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category III electives */}
              {electiveOptions.catIII.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category III Electives</p>
                  <div className="space-y-2">
                    {electiveOptions.catIII.map((name) => {
                      const k = electiveKey("categoryIII", name);
                      return (
                        <div key={k} className="flex flex-wrap items-center gap-3">
                          <span className="w-28 text-sm">{name}</span>
                          <TeacherSelect
                            value={state.subjectAssignments[k] ?? null}
                            onChange={(v) => setSubject(k, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Assignments for Grade {selectedClass?.grade}
              {selectedClass?.section}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
