"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassOption {
  id: string;
  grade: number;
  section: string;
}

interface Electives {
  categoryI: string;
  categoryII: string;
  categoryIII: string;
}

export interface RowData {
  studentId: string;
  studentName: string;
  indexNumber: string | null;
  electives: Electives;
  initialMarks: Record<string, number | null>; // all 9 subject keys
}

interface SettingsData {
  academic_year: string;
  elective_label_I: string;
  elective_label_II: string;
  elective_label_III: string;
}

/** All 9 subject keys that appear in a marks record. */
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

// Compound key helper: `${studentId}:${subject}`
function compoundKey(studentId: string, subject: string): string {
  return `${studentId}:${subject}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMarkEntryState(opts?: { assignedClassId?: string | null }) {
  const lockedClassId = opts?.assignedClassId ?? null;

  // ---- Settings ----------------------------------------------------------
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // ---- Filters -----------------------------------------------------------
  const [grade, setGrade] = useState<number | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [classLabel, setClassLabel] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);

  // ---- Search ------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");

  // ---- Class options -----------------------------------------------------
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classLoading, setClassLoading] = useState(false);

  // ---- Grid data ---------------------------------------------------------
  const [rows, setRows] = useState<RowData[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);

  // ---- Dirty state: Map<compoundKey, currentValue> -----------------------
  const [dirtyMap, setDirtyMap] = useState<Map<string, number | null>>(
    new Map()
  );

  // ---- Per-cell edited values (raw string user typed) --------------------
  const [editedValues, setEditedValues] = useState<Map<string, string>>(
    new Map()
  );

  // ---- Validation errors (compound keys) ---------------------------------
  const [invalidRows, setInvalidRows] = useState<Set<string>>(new Set());

  // ---- Saving ------------------------------------------------------------
  const [saving, setSaving] = useState(false);

  // ---- Fetch version counter (for retry) ---------------------------------
  const [fetchVersion, setFetchVersion] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  // ========================================================================
  // Fetch settings on mount - also auto-default year + term
  // ========================================================================
  useEffect(() => {
    let cancelled = false;
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to fetch settings");
        const data: SettingsData = await res.json();
        if (!cancelled) {
          setSettings(data);
          setYear((prev) => prev ?? parseInt(data.academic_year, 10));
          // Default term to TERM_1 so grid loads as soon as grade+class are chosen
          setTerm((prev) => prev ?? "TERM_1");
          setSettingsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSettingsError("Failed to load settings. Please try again.");
          setSettingsLoading(false);
        }
      }
    }
    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  // ========================================================================
  // For TEACHER: auto-fetch and lock to assigned class
  // ========================================================================
  useEffect(() => {
    if (!lockedClassId) return;
    let cancelled = false;
    async function initTeacherClass() {
      try {
        const res = await fetch(`/api/class-groups`);
        if (!res.ok) return;
        const data: { id: string; grade: number; section: string }[] = await res.json();
        const cls = data.find((c) => c.id === lockedClassId);
        if (!cancelled && cls) {
          setGrade(cls.grade);
          setClassId(cls.id);
          setClassLabel(`Grade ${cls.grade} - ${cls.section}`);
          setClassOptions([cls]);
        }
      } catch { /* ignore */ }
    }
    initTeacherClass();
    return () => { cancelled = true; };
  }, [lockedClassId]);

  // ========================================================================
  // Fetch class options when grade changes
  // ========================================================================
  useEffect(() => {
    if (lockedClassId) return; // teacher's class is locked, skip grade-based fetch
    if (!grade) {
      setClassOptions([]);
      return;
    }
    let cancelled = false;
    setClassLoading(true);
    async function fetchClasses() {
      try {
        const res = await fetch(`/api/class-groups?grade=${grade}`);
        if (!res.ok) throw new Error("Failed to fetch classes");
        const data = await res.json();
        if (!cancelled) {
          setClassOptions(
            data.map((c: { id: string; grade: number; section: string }) => ({
              id: c.id,
              grade: c.grade,
              section: c.section,
            }))
          );
          setClassLoading(false);
        }
      } catch {
        if (!cancelled) {
          setClassOptions([]);
          setClassLoading(false);
        }
      }
    }
    fetchClasses();
    return () => {
      cancelled = true;
    };
  }, [grade, lockedClassId]);

  // ========================================================================
  // Fetch grid data when classId + term + year are all set
  // ========================================================================
  useEffect(() => {
    if (!classId || !term || !year || !settings) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGridLoading(true);
    setGridError(null);

    async function fetchGrid() {
      try {
        const [studentsRes, marksRes] = await Promise.all([
          fetch(`/api/students?classId=${classId}&limit=100`, {
            signal: controller.signal,
          }),
          fetch(
            `/api/marks?classId=${classId}&term=${term}&year=${year}`,
            { signal: controller.signal }
          ),
        ]);

        if (!studentsRes.ok) throw new Error("Failed to fetch students");

        const studentsData = await studentsRes.json();
        const students = (studentsData.data || studentsData) as Array<{
          id: string;
          name: string;
          indexNumber: string | null;
          classId?: string;
          electives?: Electives;
          isDeleted?: boolean;
        }>;

        let markRecords: Array<{
          studentId: string;
          term: string;
          year: number;
          marks: Record<string, number | null>;
        }> = [];
        if (marksRes.ok) {
          markRecords = await marksRes.json();
        }

        // Sort students by indexNumber (null-safe, nulls last)
        students.sort((a, b) => {
          const aIdx = a.indexNumber ?? "\uffff";
          const bIdx = b.indexNumber ?? "\uffff";
          return aIdx.localeCompare(bIdx);
        });

        // Build marks lookup
        const marksMap = new Map(
          markRecords.map((r) => [r.studentId, r.marks])
        );

        const defaultElectives: Electives = {
          categoryI: "",
          categoryII: "",
          categoryIII: "",
        };

        const mergedRows: RowData[] = students
          .filter((s) => !s.isDeleted)
          .map((s) => {
            const studentMarks = marksMap.get(s.id);
            const initialMarks: Record<string, number | null> = {};
            for (const key of SUBJECT_KEYS) {
              initialMarks[key] = studentMarks?.[key] ?? null;
            }
            return {
              studentId: s.id,
              studentName: s.name,
              indexNumber: s.indexNumber,
              electives: s.electives ?? defaultElectives,
              initialMarks,
            };
          });

        if (!controller.signal.aborted) {
          setRows(mergedRows);
          setGridLoading(false);

          // Restore any unsaved changes from localStorage
          const lsKey = `marks_draft_${classId}_${term}_${year}`;
          try {
            const stored = localStorage.getItem(lsKey);
            if (stored) {
              const cached: Record<string, string> = JSON.parse(stored);
              const restoredEdited = new Map<string, string>(Object.entries(cached));
              const restoredDirty = new Map<string, number | null>();
              const restoredInvalid = new Set<string>();

              for (const [key, rawVal] of restoredEdited) {
                const sepIdx = key.indexOf(":");
                const studentId = key.slice(0, sepIdx);
                const subject = key.slice(sepIdx + 1);
                const matchingRow = mergedRows.find((r) => r.studentId === studentId);
                if (!matchingRow) continue;
                const initialMark = matchingRow.initialMarks[subject] ?? null;

                if (rawVal === "") {
                  if (initialMark !== null) restoredDirty.set(key, null);
                } else {
                  const num = Number(rawVal);
                  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > 100) {
                    restoredInvalid.add(key);
                  } else if (num !== initialMark) {
                    restoredDirty.set(key, num);
                  }
                }
              }

              setEditedValues(restoredEdited);
              setDirtyMap(restoredDirty);
              setInvalidRows(restoredInvalid);
            } else {
              setDirtyMap(new Map());
              setEditedValues(new Map());
              setInvalidRows(new Set());
            }
          } catch {
            setDirtyMap(new Map());
            setEditedValues(new Map());
            setInvalidRows(new Set());
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setGridError("Failed to load data. Please try again.");
          setGridLoading(false);
        }
      }
    }
    fetchGrid();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, term, year, settings, fetchVersion]);

  // ========================================================================
  // beforeunload guard
  // ========================================================================
  useEffect(() => {
    if (dirtyMap.size === 0) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyMap.size]);

  // ========================================================================
  // Year options - fetched from DB + current academic year
  // ========================================================================
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yearOptionsLoading, setYearOptionsLoading] = useState(true);

  useEffect(() => {
    if (!settings) return;
    const base = parseInt(settings.academic_year, 10);
    async function fetchYears() {
      setYearOptionsLoading(true);
      try {
        const res = await fetch("/api/marks/years");
        if (res.ok) {
          const data: number[] = await res.json();
          const merged = Array.from(
            new Set([...data, ...(Number.isNaN(base) ? [] : [base])])
          ).sort((a, b) => b - a);
          setYearOptions(merged.length > 0 ? merged : Number.isNaN(base) ? [] : [base]);
        } else {
          setYearOptions(Number.isNaN(base) ? [] : [base - 1, base, base + 1]);
        }
      } catch {
        setYearOptions(Number.isNaN(base) ? [] : [base - 1, base, base + 1]);
      } finally {
        setYearOptionsLoading(false);
      }
    }
    void fetchYears();
  }, [settings]);

  // ========================================================================
  // Derived values (needed before search effects)
  // ========================================================================
  const filtersReady = !!classId && !!term && !!year && !!settings;

  // ========================================================================
  // Filtered rows - search by studentName or indexNumber
  // ========================================================================
  const filteredRows = useMemo<RowData[]>(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        (r.indexNumber && r.indexNumber.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  // ========================================================================
  // Derived values
  // ========================================================================
  const hasInvalidRows = invalidRows.size > 0;
  const dirtyCount = dirtyMap.size;

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleGradeChange = useCallback((newGrade: number) => {
    setGrade(newGrade);
    setClassId(null);
    setClassLabel(null);
    setRows([]);
    setDirtyMap(new Map());
    setEditedValues(new Map());
    setInvalidRows(new Set());
  }, []);

  const handleClassChange = useCallback(
    (newClassId: string, label: string) => {
      setClassId(newClassId);
      setClassLabel(label);
      setRows([]);
      setDirtyMap(new Map());
      setEditedValues(new Map());
      setInvalidRows(new Set());
    },
    []
  );

  const handleTermChange = useCallback((newTerm: string) => {
    setTerm(newTerm);
  }, []);

  const handleYearChange = useCallback((newYear: number) => {
    setYear(newYear);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Handle mark input change for a specific cell identified by studentId + subject.
   */
  const handleMarkChange = useCallback(
    (
      studentId: string,
      subject: string,
      rawValue: string,
      initialMark: number | null
    ) => {
      const key = compoundKey(studentId, subject);

      // Store raw value
      setEditedValues((prev) => {
        const next = new Map(prev);
        next.set(key, rawValue);
        // Persist all edited values to localStorage immediately
        if (classId && term && year) {
          const lsKey = `marks_draft_${classId}_${term}_${year}`;
          try {
            const obj: Record<string, string> = {};
            for (const [k, v] of next) obj[k] = v;
            localStorage.setItem(lsKey, JSON.stringify(obj));
          } catch { /* ignore quota errors */ }
        }
        return next;
      });

      // Empty → null is valid
      if (rawValue === "") {
        setInvalidRows((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        const newValue: number | null = null;
        setDirtyMap((prev) => {
          const next = new Map(prev);
          if (newValue === initialMark) {
            next.delete(key);
          } else {
            next.set(key, newValue);
          }
          return next;
        });
        return;
      }

      const num = Number(rawValue);
      if (!Number.isInteger(num) || num < 0 || num > 100) {
        setInvalidRows((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        return;
      }

      // Valid number
      setInvalidRows((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setDirtyMap((prev) => {
        const next = new Map(prev);
        if (num === initialMark) {
          next.delete(key);
        } else {
          next.set(key, num);
        }
        return next;
      });
    },
    [classId, term, year]
  );

  // ========================================================================
  // Core save logic - shared by saveDraft and publish
  // ========================================================================
  const saveToDB = useCallback(async () => {
    if (dirtyMap.size === 0 || !classId || !term || !year || !settings) return null;

    setSaving(true);
    try {
      // Group dirty entries by subject
      const bySubject = new Map<
        string,
        Array<{ studentId: string; markValue: number | null }>
      >();
      for (const [key, markValue] of dirtyMap) {
        const sepIdx = key.indexOf(":");
        const studentId = key.slice(0, sepIdx);
        const subjectKey = key.slice(sepIdx + 1);
        if (!bySubject.has(subjectKey)) {
          bySubject.set(subjectKey, []);
        }
        bySubject.get(subjectKey)!.push({ studentId, markValue });
      }

      // Fire one PATCH per subject SEQUENTIALLY to avoid race conditions
      // (parallel saves can overwrite each other because the API reads-then-writes
      // the entire marks object on each upsert)
      const subjectEntries = Array.from(bySubject.entries());
      const results: PromiseSettledResult<{
        subjectKey: string;
        entries: Array<{ studentId: string; markValue: number | null }>;
        res: Response;
      }>[] = [];

      for (const [subjectKey, entries] of subjectEntries) {
        try {
          const res = await fetch("/api/marks/batch", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId,
              term,
              year,
              subject: subjectKey,
              entries,
            }),
          });
          results.push({
            status: "fulfilled",
            value: { subjectKey, entries, res },
          });
        } catch (err) {
          results.push({
            status: "rejected",
            reason: err,
          });
        }
      }

      // Aggregate results
      const succeededKeys = new Set<string>();
      const failedKeys: string[] = [];
      let totalSaved = 0;

      for (const result of results) {
        if (result.status === "rejected") {
          // All entries for this subject failed
          const reason = result.reason as Error;
          void reason; // consumed implicitly
          continue;
        }

        const { subjectKey, entries, res } = result.value;

        if (res.status === 200) {
          // All entries for this subject succeeded
          for (const entry of entries) {
            succeededKeys.add(compoundKey(entry.studentId, subjectKey));
          }
          totalSaved += entries.length;
        } else if (res.status === 207) {
          const data = await res.json();
          const succeededStudents = new Set(data.succeeded as string[]);
          for (const entry of entries) {
            if (succeededStudents.has(entry.studentId)) {
              succeededKeys.add(compoundKey(entry.studentId, subjectKey));
              totalSaved++;
            } else {
              failedKeys.push(compoundKey(entry.studentId, subjectKey));
            }
          }
        } else {
          // Entire subject batch failed
          for (const entry of entries) {
            failedKeys.push(compoundKey(entry.studentId, subjectKey));
          }
        }
      }

      // Update initialMarks for succeeded entries
      if (succeededKeys.size > 0) {
        const savedDirtyMap = new Map(dirtyMap);
        setRows((prev) =>
          prev.map((row) => {
            let changed = false;
            const updatedInitialMarks = { ...row.initialMarks };
            for (const sKey of SUBJECT_KEYS) {
              const ck = compoundKey(row.studentId, sKey);
              if (succeededKeys.has(ck) && savedDirtyMap.has(ck)) {
                updatedInitialMarks[sKey] = savedDirtyMap.get(ck)!;
                changed = true;
              }
            }
            return changed
              ? { ...row, initialMarks: updatedInitialMarks }
              : row;
          })
        );

        // Remove succeeded from dirty map & edited values
        setDirtyMap((prev) => {
          const next = new Map(prev);
          for (const key of succeededKeys) next.delete(key);
          return next;
        });
        setEditedValues((prev) => {
          const next = new Map(prev);
          for (const key of succeededKeys) next.delete(key);
          return next;
        });
      }

      if (failedKeys.length === 0) {
        return { success: true as const, count: totalSaved };
      }
      return {
        success: false as const,
        partial: succeededKeys.size > 0,
        failedKeys,
        count: totalSaved,
      };
    } catch {
      return {
        success: false as const,
        error: "Network error. Please try again.",
      };
    } finally {
      setSaving(false);
    }
  }, [dirtyMap, classId, term, year, settings]);

  // Clear localStorage after a successful save
  const clearLocalStorage = useCallback(() => {
    if (classId && term && year) {
      try {
        localStorage.removeItem(`marks_draft_${classId}_${term}_${year}`);
      } catch { /* ignore */ }
    }
  }, [classId, term, year]);

  /** Save marks as DRAFT (default status if no release record exists). */
  const handleSaveDraft = useCallback(async () => {
    const result = await saveToDB();
    if (!result) return null;
    if (!result.success && "error" in result) return result;

    // Ensure MarksRelease record exists as DRAFT
    try {
      await fetch("/api/marks/release", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, term, year, status: "DRAFT" }),
      });
    } catch { /* non-fatal */ }

    clearLocalStorage();
    return result;
  }, [saveToDB, clearLocalStorage, classId, term, year]);

  /** Save marks AND set the class marks release to PUBLISHED. */
  const handlePublish = useCallback(async () => {
    const result = await saveToDB();
    if (!result) return null;
    if (!result.success && "error" in result) return result;

    try {
      const releaseRes = await fetch("/api/marks/release", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, term, year, status: "PUBLISHED" }),
      });
      if (!releaseRes.ok) {
        return { ...result, releaseError: "Marks saved but failed to publish. Try again from the Marks page." };
      }
    } catch {
      return { ...result, releaseError: "Marks saved but failed to publish. Try again from the Marks page." };
    }

    clearLocalStorage();
    return result;
  }, [saveToDB, clearLocalStorage, classId, term, year]);

  // ========================================================================
  // Retry grid fetch
  // ========================================================================
  const retryGridFetch = useCallback(() => {
    setFetchVersion((v) => v + 1);
  }, []);

  // ========================================================================
  // Return
  // ========================================================================
  return {
    // Settings
    settings,
    settingsLoading,
    settingsError,
    // Filters
    grade,
    classId,
    classLabel,
    term,
    year,
    classOptions,
    classLoading,
    // Grid
    rows,
    filteredRows,
    gridLoading,
    gridError,
    // Dirty / validation
    dirtyMap,
    editedValues,
    invalidRows,
    // Saving
    saving,
    // Search
    searchQuery,
    // Handlers
    handleGradeChange,
    handleClassChange,
    handleTermChange,
    handleYearChange,
    handleMarkChange,
    handleSaveDraft,
    handlePublish,
    handleSearchChange,
    retryGridFetch,
    // Derived
    hasInvalidRows,
    dirtyCount,
    filtersReady,
    yearOptions,
    yearOptionsLoading,
    studentCount: rows.length,
    isClassLocked: !!lockedClassId,
  };
}
