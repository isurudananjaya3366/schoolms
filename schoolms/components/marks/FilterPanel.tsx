"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

interface FilterPanelProps {
  grade: number | null;
  classId: string | null;
  term: string | null;
  year: number | null;
  yearOptions: number[];
  yearOptionsLoading?: boolean;
  classOptions: { id: string; grade: number; section: string }[];
  classLoading: boolean;
  searchQuery: string;
  onGradeChange: (grade: number) => void;
  onClassChange: (classId: string, label: string) => void;
  onTermChange: (term: string) => void;
  onYearChange: (year: number) => void;
  onSearchChange: (query: string) => void;
}

const GRADES = [10, 11];

export default function FilterPanel({
  grade,
  classId,
  term,
  year,
  yearOptions,
  yearOptionsLoading,
  classOptions,
  classLoading,
  searchQuery,
  onGradeChange,
  onClassChange,
  onTermChange,
  onYearChange,
  onSearchChange,
}: FilterPanelProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Year */}
      <div className="w-28">
        <label className="mb-1 block text-sm font-medium">Year</label>
        <Select
          value={year?.toString() ?? ""}
          onValueChange={(v) => onYearChange(parseInt(v))}
          disabled={yearOptionsLoading}
        >
          <SelectTrigger>
            {yearOptionsLoading ? (
              <div className="flex items-center gap-02">
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

      {/* Grade */}
      <div className="w-32">
        <label className="mb-1 block text-sm font-medium">Grade</label>
        <Select
          value={grade?.toString() ?? ""}
          onValueChange={(v) => onGradeChange(parseInt(v))}
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

      {/* Class */}
      <div className="w-28">
        <label className="mb-1 block text-sm font-medium">Class</label>
        <Select
          value={classId ?? ""}
          onValueChange={(v) => {
            const opt = classOptions.find((c) => c.id === v);
            if (opt) onClassChange(v, `${opt.grade}${opt.section}`);
          }}
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
                {c.grade}
                {c.section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Term */}
      <div className="w-28">
        <label className="mb-1 block text-sm font-medium">Term</label>
        <Select value={term ?? ""} onValueChange={onTermChange}>
          <SelectTrigger>
            <SelectValue placeholder="Term" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TERM_1">Term 1</SelectItem>
            <SelectItem value="TERM_2">Term 2</SelectItem>
            <SelectItem value="TERM_3">Term 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="flex-1 min-w-[220px]">
        <label className="mb-1 block text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or index..."
            className="pl-8"
          />
        </div>
      </div>
    </div>
  );
}
