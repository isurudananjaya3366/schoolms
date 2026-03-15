"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Lock, Globe, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface ClassOption {
  id: string;
  grade: number;
  section: string;
}

interface ReleaseRecord {
  id: string;
  classId: string;
  term: string;
  year: number;
  status: "DRAFT" | "PUBLISHED";
  changedAt: string | null;
}

interface MarksManagementClientProps {
  role: string;
  // For TEACHER role: their assigned class id (pre-filled, locked)
  assignedClassId?: string | null;
}

const TERMS = [
  { value: "TERM_1", label: "Term 1" },
  { value: "TERM_2", label: "Term 2" },
  { value: "TERM_3", label: "Term 3" },
];

const GRADES = [10, 11];

function termLabel(term: string) {
  return TERMS.find((t) => t.value === term)?.label ?? term;
}

export default function MarksManagementClient({
  role,
  assignedClassId,
}: MarksManagementClientProps) {
  const isTeacher = role === "TEACHER";
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

  // Filters
  const [grade, setGrade] = useState<number | null>(null);
  const [classId, setClassId] = useState<string | null>(
    isTeacher ? (assignedClassId ?? null) : null
  );
  const [year, setYear] = useState<number | null>(null);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yearOptionsLoading, setYearOptionsLoading] = useState(true);

  // Class options
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classLoading, setClassLoading] = useState(false);

  // Release states (one per term)
  const [releases, setReleases] = useState<Record<string, ReleaseRecord | null>>({
    TERM_1: null,
    TERM_2: null,
    TERM_3: null,
  });
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [releasesError, setReleasesError] = useState<string | null>(null);

  // Saving state per term
  const [savingTerm, setSavingTerm] = useState<string | null>(null);

  // ── Fetch current academic year from settings + available years ──
  useEffect(() => {
    async function fetchYearData() {
      try {
        const [settingsRes, yearsRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/marks/years"),
        ]);
        let base: number | null = null;
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          const y = parseInt(data.academic_year, 10);
          if (!Number.isNaN(y)) {
            base = y;
            setYear(y);
          }
        }
        const availableYears: number[] = yearsRes.ok ? await yearsRes.json() : [];
        const merged = Array.from(
          new Set([...availableYears, ...(base !== null ? [base] : [])])
        ).sort((a, b) => b - a);
        setYearOptions(merged.length > 0 ? merged : base !== null ? [base - 1, base, base + 1] : []);
      } catch {
        // ignore
      } finally {
        setYearOptionsLoading(false);
      }
    }
    void fetchYearData();
  }, []);

  // ── For TEACHER: auto-load their class info ──
  useEffect(() => {
    if (!isTeacher || !assignedClassId) return;
    async function loadAssignedClass() {
      try {
        const res = await fetch(`/api/class-groups?id=${assignedClassId}`);
        if (!res.ok) return;
        const data = await res.json();
        const cls = Array.isArray(data) ? data.find((c: { id: string }) => c.id === assignedClassId) ?? data[0] : data;
        if (cls) {
          setGrade(cls.grade);
          setClassOptions([cls]);
        }
      } catch {
        // ignore - teacher can still use filters manually
      }
    }
    loadAssignedClass();
  }, [isTeacher, assignedClassId]);

  // ── Fetch class options when grade changes (admin/staff) ──
  useEffect(() => {
    if (isTeacher) return; // teacher's class is locked
    if (!grade) {
      setClassOptions([]);
      setClassId(null);
      return;
    }
    let cancelled = false;
    setClassLoading(true);
    async function fetchClasses() {
      try {
        const res = await fetch(`/api/class-groups?grade=${grade}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) {
          setClassOptions(
            data.map((c: { id: string; grade: number; section: string }) => ({
              id: c.id,
              grade: c.grade,
              section: c.section,
            }))
          );
          setClassId(null);
          setClassLoading(false);
        }
      } catch {
        if (!cancelled) setClassLoading(false);
      }
    }
    fetchClasses();
    return () => {
      cancelled = true;
    };
  }, [grade, isTeacher]);

  // ── Load release statuses when class + year are both set ──
  const fetchReleases = useCallback(async () => {
    if (!classId || !year) return;
    setReleasesLoading(true);
    setReleasesError(null);
    try {
      const params = new URLSearchParams({ classId, year: String(year) });
      const res = await fetch(`/api/marks/release?${params}`);
      if (!res.ok) throw new Error("Failed to load release statuses");
      const data: ReleaseRecord[] = await res.json();

      const map: Record<string, ReleaseRecord | null> = {
        TERM_1: null,
        TERM_2: null,
        TERM_3: null,
      };
      for (const r of data) {
        map[r.term] = r;
      }
      setReleases(map);
    } catch {
      setReleasesError("Failed to load marks release status. Please try again.");
    } finally {
      setReleasesLoading(false);
    }
  }, [classId, year]);

  useEffect(() => {
    void fetchReleases();
  }, [fetchReleases]);

  // ── Toggle release status for a term ──
  const handleToggle = async (term: string, currentStatus: "DRAFT" | "PUBLISHED" | null) => {
    if (!classId || !year) return;
    const newStatus: "DRAFT" | "PUBLISHED" =
      currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

    setSavingTerm(term);
    try {
      const res = await fetch("/api/marks/release", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, term, year, status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "Failed to update release status.");
        return;
      }
      const updated: ReleaseRecord = await res.json();
      setReleases((prev) => ({ ...prev, [term]: updated }));
      toast.success(
        newStatus === "PUBLISHED"
          ? `${termLabel(term)} marks published - now visible to students.`
          : `${termLabel(term)} marks held as draft.`
      );
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingTerm(null);
    }
  };

  // ── Access guard ──
  if (role === "STUDENT" || role === "STAFF") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm text-muted-foreground">
          Only class teachers and admins can manage marks releases.
        </p>
      </div>
    );
  }

  const selectedClass =
    classOptions.find((c) => c.id === classId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marks Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Release or hold marks for a class. Published marks are visible to students.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        {/* Year */}
        <div className="w-28">
          <label className="mb-1 block text-sm font-medium">Year</label>
          <Select
            value={year?.toString() ?? ""}
            onValueChange={(v) => setYear(parseInt(v, 10))}
            disabled={yearOptionsLoading}
          >
            <SelectTrigger>
              {yearOptionsLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <SelectValue placeholder="Year" />
              )}
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grade - hidden for teacher (their class is fixed) */}
        {!isTeacher && (
          <div className="w-32">
            <label className="mb-1 block text-sm font-medium">Grade</label>
            <Select
              value={grade?.toString() ?? ""}
              onValueChange={(v) => setGrade(parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g.toString()}>
                    Grade {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Class */}
        <div className="w-32">
          <label className="mb-1 block text-sm font-medium">Class</label>
          {isTeacher ? (
            <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
              {selectedClass
                ? `${selectedClass.grade}${selectedClass.section}`
                : "Loading…"}
            </div>
          ) : (
            <Select
              value={classId ?? ""}
              onValueChange={(v) => setClassId(v)}
              disabled={!grade || classLoading}
            >
              <SelectTrigger>
                {classLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <SelectValue placeholder="Class" />
                )}
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.grade}{c.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Release status cards */}
      {!classId || !year ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">
            {isTeacher ? "Select a year to view release status." : "Select a grade, class, and year to view release status."}
          </p>
        </div>
      ) : releasesLoading ? (
        <div className="space-y-3">
          {TERMS.map((t) => (
            <Skeleton key={t.value} className="h-20 w-full" />
          ))}
        </div>
      ) : releasesError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-4">
            <span>{releasesError}</span>
            <Button variant="outline" size="sm" onClick={fetchReleases}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {TERMS.map(({ value: term, label }) => {
            const record = releases[term];
            const status = record?.status ?? null;
            const isPublished = status === "PUBLISHED";
            const isSaving = savingTerm === term;

            return (
              <div
                key={term}
                className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                  isPublished ? "border-green-200 bg-green-50" : "bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isPublished ? (
                    <Globe className="h-5 w-5 text-green-600" />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {record?.changedAt
                        ? `Last changed: ${new Date(record.changedAt).toLocaleDateString()}`
                        : "No release record yet"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant={isPublished ? "default" : "secondary"}
                    className={isPublished ? "bg-green-600 hover:bg-green-600" : ""}
                  >
                    {isPublished ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <Lock className="mr-1 h-3 w-3" />
                    )}
                    {isPublished ? "Published" : "Draft"}
                  </Badge>

                  {isAdmin || isTeacher ? (
                    <Button
                      size="sm"
                      variant={isPublished ? "outline" : "default"}
                      onClick={() => handleToggle(term, status)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      {isPublished ? "Hold as Draft" : "Publish"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
