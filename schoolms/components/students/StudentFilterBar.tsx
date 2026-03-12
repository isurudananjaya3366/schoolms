"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";

const GRADES = [6, 7, 8, 9, 10, 11];
const SECTIONS = ["A", "B", "C", "D", "E", "F"];

export default function StudentFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentGrade = searchParams.get("grade") ?? "";
  const currentSection = searchParams.get("classSection") ?? "";
  const currentSearch = searchParams.get("search") ?? "";

  const [searchValue, setSearchValue] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const hasFilters = currentGrade || currentSection || currentSearch;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset page on filter change
      params.set("page", "1");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`/dashboard/students?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Sync search input with URL param
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ search: value || null });
    }, 400);
  };

  const clearFilters = () => {
    setSearchValue("");
    router.push("/dashboard/students");
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={currentGrade}
        onValueChange={(value) =>
          updateParams({ grade: value === "all" ? null : value })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Grades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Grades</SelectItem>
          {GRADES.map((g) => (
            <SelectItem key={g} value={String(g)}>
              Grade {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentSection}
        onValueChange={(value) =>
          updateParams({ classSection: value === "all" ? null : value })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Sections" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sections</SelectItem>
          {SECTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              Section {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search name or index…"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="size-4 mr-1" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
