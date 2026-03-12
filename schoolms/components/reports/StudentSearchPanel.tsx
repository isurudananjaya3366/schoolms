"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";

interface Student {
  id: string;
  name: string;
  indexNumber: string;
  class?: { grade: number; section: string };
}

interface SelectedStudent {
  id: string;
  name: string;
  indexNumber: string;
  className?: string;
}

interface StudentSearchPanelProps {
  onStudentSelect: (student: SelectedStudent) => void;
  onYearChange: (year: number) => void;
  selectedStudent: SelectedStudent | null;
  selectedYear: number | null;
}

export default function StudentSearchPanel({
  onStudentSelect,
  onYearChange,
  selectedStudent,
  selectedYear,
}: StudentSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [settingsYear, setSettingsYear] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available years on mount
  useEffect(() => {
    async function fetchYears() {
      try {
        const [yearsRes, settingsRes] = await Promise.all([
          fetch("/api/marks/years"),
          fetch("/api/settings"),
        ]);
        if (yearsRes.ok) {
          const yearsData: number[] = await yearsRes.json();
          setYears(yearsData);
        }
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.academic_year) {
            const sy = parseInt(settings.academic_year, 10);
            if (!isNaN(sy)) setSettingsYear(sy);
          }
        }
      } catch {
        // Silently fail — years will be empty
      }
    }
    fetchYears();
  }, []);

  // Auto-select year from settings if not already selected
  useEffect(() => {
    if (!selectedYear && settingsYear) {
      onYearChange(settingsYear);
    }
  }, [settingsYear, selectedYear, onYearChange]);

  // Debounced student search
  const searchStudents = useCallback(async (searchTerm: string) => {
    if (searchTerm.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/students?search=${encodeURIComponent(searchTerm)}&limit=10`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.data || []);
        setShowDropdown(true);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchStudents(value);
    }, 300);
  };

  const handleSelect = (student: Student) => {
    onStudentSelect({
      id: student.id,
      name: student.name,
      indexNumber: student.indexNumber,
      className: student.class
        ? `${student.class.grade}${student.class.section}`
        : undefined,
    });
    setQuery(`${student.indexNumber} — ${student.name}`);
    setShowDropdown(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Build year options: merge settings year + DB years, deduplicate, sort desc
  const yearOptions = Array.from(
    new Set([...(settingsYear ? [settingsYear] : []), ...years])
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      {/* Student search */}
      <div className="relative" ref={dropdownRef}>
        <Label htmlFor="student-search" className="mb-1.5 block">
          Student
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="student-search"
            placeholder="Search by name or index number..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
            className="pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(student)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {student.indexNumber}
                    </span>
                    <span>{student.name}</span>
                    {student.class && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {student.class.grade}
                        {student.class.section}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showDropdown && results.length === 0 && !searching && query.trim().length >= 2 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">
            No students found
          </div>
        )}
      </div>

      {/* Selected student display */}
      {selectedStudent && (
        <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{selectedStudent.name}</span>
          <span className="ml-2 text-muted-foreground">
            ({selectedStudent.indexNumber})
          </span>
        </div>
      )}

      {/* Year selector */}
      <div>
        <Label htmlFor="year-select" className="mb-1.5 block">
          Academic Year
        </Label>
        <Select
          value={selectedYear ? String(selectedYear) : ""}
          onValueChange={(val) => onYearChange(parseInt(val, 10))}
        >
          <SelectTrigger id="year-select">
            <SelectValue placeholder="Select year" />
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
    </div>
  );
}
