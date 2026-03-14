"use client";

import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, X, ArrowLeft } from "lucide-react";

interface StudentDoc {
  id: string;
  name: string;
  indexNumber: string;
  classId: string;
}

interface Props {
  grade: number | null;
  classId: string | null;
  term: string | null;
  year: string;
  yearOptions: number[];
  yearOptionsLoading?: boolean;
  classOptions: { id: string; grade: number; section: string }[];
  classLoading: boolean;
  viewMode: "class" | "student";
  selectedStudentName: string | null;
  onGradeChange: (grade: number) => void;
  onClassChange: (classId: string) => void;
  onTermChange: (term: string) => void;
  onYearChange: (year: string) => void;
  onStudentSelect: (student: StudentDoc) => void;
  onBackToClass: () => void;
}

const GRADES = [10, 11];

export default function ViewMarksFilters({
  grade,
  classId,
  term,
  year,
  yearOptions,
  yearOptionsLoading,
  classOptions,
  classLoading,
  viewMode,
  selectedStudentName,
  onGradeChange,
  onClassChange,
  onTermChange,
  onYearChange,
  onStudentSelect,
  onBackToClass,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentDoc[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced student search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/students?search=${encodeURIComponent(searchQuery.trim())}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const students = (data.data || data) as StudentDoc[];
          if (!controller.signal.aborted) {
            setSearchResults(
              students
                .filter(
                  (s) => !(s as unknown as { isDeleted: boolean }).isDeleted
                )
                .slice(0, 20)
            );
            setSearchOpen(true);
          }
        }
      } catch {
        /* ignore AbortError */
      }
      if (!controller.signal.aborted) setSearchLoading(false);
    }, 300);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-4">
      {viewMode === "student" && (
        <Button variant="ghost" size="sm" onClick={onBackToClass}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to class view
        </Button>
      )}

      <div className="flex items-end justify-between gap-3 flex-wrap">
        {/* Left group: Year + class-view filters */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Year */}
          <div className="w-32">
            <label className="mb-1 block text-sm font-medium">Year</label>
            <Select value={year} onValueChange={onYearChange} disabled={yearOptionsLoading}>
              <SelectTrigger>
                {yearOptionsLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {viewMode === "class" && (
            <>
              {/* Grade */}
              <div className="w-36">
                <label className="mb-1 block text-sm font-medium">Grade</label>
                <Select
                  value={grade?.toString() ?? ""}
                  onValueChange={(v) => onGradeChange(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
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

              {/* Class */}
              <div className="w-36">
                <label className="mb-1 block text-sm font-medium">Class</label>
                <Select
                  value={classId ?? ""}
                  onValueChange={onClassChange}
                  disabled={!grade || classLoading}
                >
                  <SelectTrigger>
                    {classLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                      </div>
                    ) : (
                      <SelectValue placeholder="Select class" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.grade}
                        {c.section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Term */}
              <div className="w-36">
                <label className="mb-1 block text-sm font-medium">Term</label>
                <Select value={term ?? ""} onValueChange={onTermChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TERM_1">Term 1</SelectItem>
                    <SelectItem value="TERM_2">Term 2</SelectItem>
                    <SelectItem value="TERM_3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {viewMode === "student" && selectedStudentName && (
            <div className="flex items-end">
              <p className="text-sm font-medium text-muted-foreground">
                Student: {selectedStudentName}
              </p>
            </div>
          )}
        </div>

        {/* Right group: Student Search (class view only) */}
        {viewMode === "class" && (
          <div className="relative flex-1 min-w-[220px]" ref={searchRef}>
            <label className="mb-1 block text-sm font-medium">
              Student Search
            </label>
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or index…"
                role="combobox"
                aria-expanded={searchOpen}
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {searchLoading && (
                <Loader2 className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
              >
                {searchResults.map((s) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={false}
                    className="cursor-pointer rounded-sm px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => {
                      onStudentSelect(s);
                      setSearchQuery(s.name);
                      setSearchOpen(false);
                    }}
                  >
                    <span className="font-medium">{s.indexNumber}</span> -{" "}
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
