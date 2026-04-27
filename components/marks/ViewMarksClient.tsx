"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import ViewMarksFilters from "./ViewMarksFilters";
import ClassMarksTable from "./ClassMarksTable";
import StudentMarksTable from "./StudentMarksTable";
import ExportCSVButton from "./ExportCSVButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface StudentDoc {
  id: string;
  name: string;
  indexNumber: string;
  classId: string;
  electives?: { categoryI: string; categoryII: string; categoryIII: string };
}

interface MarkRecordDoc {
  id: string;
  studentId: string;
  term: string;
  year: number;
  marks: Record<string, number | null>;
}

interface Props {
  role: string;
  userId: string;
  initialParams: {
    grade?: string;
    classId?: string;
    term?: string;
    year?: string;
    studentId?: string;
  };
}

interface SettingsData {
  academic_year: string;
  elective_label_I: string;
  elective_label_II: string;
  elective_label_III: string;
}

export default function ViewMarksClient({ role, initialParams }: Props) {
  const router = useRouter();

  // Settings
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Filters
  const [grade, setGrade] = useState<number | null>(
    initialParams.grade ? parseInt(initialParams.grade) : null
  );
  const [classId, setClassId] = useState<string | null>(
    initialParams.classId || null
  );
  const [term, setTerm] = useState<string | null>(initialParams.term || null);
  const [year, setYear] = useState<string | null>(initialParams.year || null);
  const [selectedStudent, setSelectedStudent] = useState<StudentDoc | null>(
    null
  );

  // View mode
  const viewMode = selectedStudent ? "student" : "class";

  // Class options, available years
  const [classOptions, setClassOptions] = useState<
    { id: string; grade: number; section: string }[]
  >([]);
  const [classLoading, setClassLoading] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearOptionsLoading, setYearOptionsLoading] = useState(true);

  // Class view data
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [classMarks, setClassMarks] = useState<MarkRecordDoc[]>([]);
  const [classDataLoading, setClassDataLoading] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

  // Student view data
  const [studentMarks, setStudentMarks] = useState<MarkRecordDoc[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Fetch settings + available years on mount
  useEffect(() => {
    async function init() {
      try {
        const [settingsRes, yearsRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/marks/years"),
        ]);
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings(s);
          if (!year) setYear(s.academic_year);
        }
        if (yearsRes.ok) {
          const y = await yearsRes.json();
          setAvailableYears(y);
        }
      } catch {
        /* ignore */
      }
      setSettingsLoading(false);
      setYearOptionsLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch class options when grade changes
  useEffect(() => {
    if (!grade) {
      setClassOptions([]);
      return;
    }
    let cancelled = false;
    setClassLoading(true);
    fetch(`/api/class-groups?grade=${grade}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setClassOptions(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setClassLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [grade]);

  // Fetch class view data
  useEffect(() => {
    if (viewMode !== "class" || !classId || !term || !year) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setClassDataLoading(true);
    setClassError(null);

    Promise.all([
      fetch(`/api/students?classId=${classId}&limit=100`, {
        signal: controller.signal,
      }),
      fetch(`/api/marks?classId=${classId}&term=${term}&year=${year}`, {
        signal: controller.signal,
      }),
    ])
      .then(async ([studentsRes, marksRes]) => {
        if (!studentsRes.ok) throw new Error("Failed to fetch students");
        const sData = await studentsRes.json();
        const studentsList = (sData.data || sData) as StudentDoc[];
        const marksList = marksRes.ok
          ? ((await marksRes.json()) as MarkRecordDoc[])
          : [];

        if (!controller.signal.aborted) {
          setStudents(
            studentsList
              .filter(
                (s) => !(s as unknown as { isDeleted: boolean }).isDeleted
              )
              .sort((a, b) => a.indexNumber.localeCompare(b.indexNumber))
          );
          setClassMarks(marksList);
          setClassDataLoading(false);
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setClassError(
            "An error occurred while loading marks. Please try again."
          );
          setClassDataLoading(false);
        }
      });

    return () => controller.abort();
  }, [viewMode, classId, term, year]);

  // Fetch student view data
  useEffect(() => {
    if (viewMode !== "student" || !selectedStudent || !year) return;
    setStudentLoading(true);
    fetch(`/api/marks?studentId=${selectedStudent.id}&year=${year}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setStudentMarks(data))
      .catch(() => setStudentMarks([]))
      .finally(() => setStudentLoading(false));
  }, [viewMode, selectedStudent, year]);

  // URL sync
  const syncUrl = useCallback(
    (params: Record<string, string | null>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
      }
      router.push(`/dashboard/marks/view?${sp.toString()}`, { scroll: false });
    },
    [router]
  );

  // Handlers
  const handleGradeChange = (g: number) => {
    setGrade(g);
    setClassId(null);
    setStudents([]);
    setClassMarks([]);
    setSelectedStudent(null);
    syncUrl({ grade: String(g), year });
  };

  const handleClassChange = (id: string) => {
    setClassId(id);
    setSelectedStudent(null);
    syncUrl({ grade: grade ? String(grade) : null, classId: id, term, year });
  };

  const handleTermChange = (t: string) => {
    setTerm(t);
    syncUrl({
      grade: grade ? String(grade) : null,
      classId,
      term: t,
      year,
    });
  };

  const handleYearChange = (y: string) => {
    setYear(y);
    syncUrl({
      grade: grade ? String(grade) : null,
      classId,
      term,
      year: y,
      studentId: selectedStudent?.id || null,
    });
  };

  const handleStudentSelect = (student: StudentDoc) => {
    setSelectedStudent(student);
    syncUrl({
      grade: grade ? String(grade) : null,
      classId,
      year,
      studentId: student.id,
    });
  };

  const handleBackToClass = () => {
    setSelectedStudent(null);
    syncUrl({ grade: grade ? String(grade) : null, classId, term, year });
  };

  if (settingsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Parse elective labels: settings may store a JSON array of subject names
  const formatElectiveLabel = (
    raw: string | undefined,
    fallback: string
  ): string => {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.join(", ");
      }
    } catch {
      // Not JSON – use raw string as-is
    }
    return raw || fallback;
  };

  const electiveLabels = {
    labelI: formatElectiveLabel(settings?.elective_label_I, "Category I"),
    labelII: formatElectiveLabel(settings?.elective_label_II, "Category II"),
    labelIII: formatElectiveLabel(settings?.elective_label_III, "Category III"),
  };

  // Current year with academic year included in available years
  const currentYear = settings?.academic_year
    ? parseInt(settings.academic_year)
    : new Date().getFullYear();
  const yearOptions = [...new Set([currentYear, ...availableYears])].sort(
    (a, b) => b - a
  );

  // Get class label for CSV filename
  const selectedClassOption = classOptions.find((c) => c.id === classId);
  const classLabel = selectedClassOption
    ? `${selectedClassOption.grade}${selectedClassOption.section}`
    : "";

  const isStaff = role === "STAFF" || role === "ADMIN" || role === "SUPERADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-2xl font-bold">View Marks</h1>
        {viewMode === "student" && selectedStudent && (
          <p className="text-sm text-muted-foreground">
            Viewing marks for {selectedStudent.name}
          </p>
        )}
      </div>

      {/* Filters */}
      <ViewMarksFilters
        grade={grade}
        classId={classId}
        term={term}
        year={year || String(currentYear)}
        yearOptions={yearOptions}
        yearOptionsLoading={yearOptionsLoading}
        classOptions={classOptions}
        classLoading={classLoading}
        viewMode={viewMode}
        selectedStudentName={selectedStudent?.name || null}
        onGradeChange={handleGradeChange}
        onClassChange={handleClassChange}
        onTermChange={handleTermChange}
        onYearChange={handleYearChange}
        onStudentSelect={handleStudentSelect}
        onBackToClass={handleBackToClass}
      />

      {/* Class View */}
      {viewMode === "class" && (
        <>
          {/* CSV export button */}
          {isStaff &&
            classId &&
            !classDataLoading &&
            students.length > 0 && (
              <div className="flex justify-end">
                <ExportCSVButton
                  students={students}
                  marks={classMarks}
                  electiveLabels={electiveLabels}
                  className={classLabel}
                  term={term || ""}
                  year={year || String(currentYear)}
                  disabled={classDataLoading || students.length === 0}
                />
              </div>
            )}

          {/* Loading */}
          {classDataLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}

          {/* Error */}
          {classError && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center gap-4">
                {classError}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClassError(null);
                    setTerm((t) => t);
                  }}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Empty / Initial */}
          {!classDataLoading &&
            !classError &&
            (!classId || !term || !year) && (
              <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
                <p className="text-sm text-muted-foreground">
                  Select a grade and class to view marks, or search for a
                  student.
                </p>
              </div>
            )}

          {/* No marks */}
          {!classDataLoading &&
            !classError &&
            classId &&
            term &&
            year &&
            students.length > 0 &&
            classMarks.length === 0 && (
              <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No marks have been entered for this selection yet.
                </p>
              </div>
            )}

          {/* Empty class */}
          {!classDataLoading &&
            !classError &&
            classId &&
            term &&
            year &&
            students.length === 0 && (
              <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No students found in this class group.
                </p>
              </div>
            )}

          {/* Table */}
          {!classDataLoading &&
            !classError &&
            students.length > 0 &&
            classMarks.length > 0 && (
              <ClassMarksTable
                students={students}
                marks={classMarks}
                term={term || "TERM_1"}
                electiveLabels={electiveLabels}
              />
            )}
        </>
      )}

      {/* Student View */}
      {viewMode === "student" && selectedStudent && (
        <>
          {studentLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}

          {!studentLoading && (
            <StudentMarksTable
              student={selectedStudent}
              marks={studentMarks}
              electiveLabels={electiveLabels}
            />
          )}
        </>
      )}
    </div>
  );
}
