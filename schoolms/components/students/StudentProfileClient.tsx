"use client";

import { useState, useMemo } from "react";
import { Role } from "@prisma/client";
import ProfileHeader from "@/components/students/ProfileHeader";
import MarksTable from "@/components/students/MarksTable";
import WNoteBlock from "@/components/students/WNoteBlock";
import { StudentPerformanceBar } from "@/components/charts";
import { SUBJECT_KEYS } from "@/lib/chartPalette";
import type { TermMarkData, ElectiveLabels } from "@/types/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { BarChart3, FileText, Presentation } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Marks {
  sinhala: number | null;
  buddhism: number | null;
  maths: number | null;
  science: number | null;
  english: number | null;
  history: number | null;
  categoryI: number | null;
  categoryII: number | null;
  categoryIII: number | null;
}

interface MarkRecordData {
  id: string;
  term: "TERM_1" | "TERM_2" | "TERM_3";
  year: number;
  marks: Marks;
}

interface Electives {
  categoryI: string;
  categoryII: string;
  categoryIII: string;
}

interface StudentData {
  id: string;
  name: string;
  indexNumber: string | null;
  electives: Electives;
  class: { grade: number; section: string };
  scholarshipMarks?: number | null;
}

export interface StudentProfileClientProps {
  student: StudentData;
  markRecords: MarkRecordData[];
  role: Role;
  availableYears: number[];
  defaultYear: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildChartDataForYear(
  markRecords: MarkRecordData[],
  year: number,
): TermMarkData[] {
  const termOrder = ["TERM_1", "TERM_2", "TERM_3"] as const;
  const termLabels: Record<string, string> = {
    TERM_1: "Term 1",
    TERM_2: "Term 2",
    TERM_3: "Term 3",
  };

  const yearRecords = markRecords.filter((r) => r.year === year);

  return termOrder.map((termKey) => {
    const record = yearRecords.find((r) => r.term === termKey);
    const entry: TermMarkData = { term: termLabels[termKey], termKey };
    SUBJECT_KEYS.forEach((key) => {
      entry[key] = record?.marks?.[key as keyof Marks] ?? null;
    });
    return entry;
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StudentProfileClient({
  student,
  markRecords,
  role,
  availableYears,
  defaultYear,
}: StudentProfileClientProps) {
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [showFullRecords, setShowFullRecords] = useState(false);
  const [chartYear, setChartYear] = useState<number>(defaultYear);

  // ---- Derived data ----

  /** Use the student's own elected subjects for chart labels instead of system-wide labels */
  const studentElectiveLabels: ElectiveLabels = {
    labelI: student.electives.categoryI,
    labelII: student.electives.categoryII,
    labelIII: student.electives.categoryIII,
  };

  /** Mark records filtered to the selected year (or all if toggle is on) */
  const filteredMarkRecords = useMemo(() => {
    if (showFullRecords) return markRecords;
    return markRecords.filter((r) => r.year === selectedYear);
  }, [markRecords, selectedYear, showFullRecords]);

  /** Chart data uses its own year selector */
  const chartData = useMemo(
    () => buildChartDataForYear(markRecords, chartYear),
    [markRecords, chartYear],
  );

  /** Records grouped by year (newest first) for full-records mode */
  const recordsByYear = useMemo(() => {
    if (!showFullRecords) return null;
    const yearMap = new Map<number, MarkRecordData[]>();
    for (const rec of markRecords) {
      if (!yearMap.has(rec.year)) yearMap.set(rec.year, []);
      yearMap.get(rec.year)!.push(rec);
    }
    return Array.from(yearMap.entries()).sort((a, b) => b[0] - a[0]);
  }, [markRecords, showFullRecords]);

  // ---- Render ----

  return (
    <div className="space-y-6">
      <ProfileHeader student={student} role={role} />

      <Separator />

      {/* Year Selector & Full Records Toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="year-select"
            className="text-sm font-medium whitespace-nowrap"
          >
            Academic Year
          </Label>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger id="year-select" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="full-records"
            checked={showFullRecords}
            onCheckedChange={setShowFullRecords}
          />
          <Label htmlFor="full-records" className="text-sm cursor-pointer">
            Full Academic Records
          </Label>
        </div>
      </div>

      {/* Academic Records Table(s) + W-Note Block(s) */}
      {showFullRecords && recordsByYear ? (
        recordsByYear.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground italic text-center">
                No academic records found.
              </p>
            </CardContent>
          </Card>
        ) : (
          recordsByYear.map(([year, records]) => (
            <div key={year} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Academic Records — {year}</CardTitle>
                  <CardDescription>
                    Mark records for all terms in {year}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MarksTable
                    markRecords={records}
                    electives={student.electives}
                  />
                </CardContent>
              </Card>
              <WNoteBlock
                markRecords={records}
                electives={student.electives}
              />
            </div>
          ))
        )
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Academic Records — {selectedYear}</CardTitle>
              <CardDescription>
                Mark records across all terms for {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MarksTable
                markRecords={filteredMarkRecords}
                electives={student.electives}
              />
            </CardContent>
          </Card>
          <WNoteBlock
            markRecords={filteredMarkRecords}
            electives={student.electives}
          />
        </>
      )}

      {/* Performance Chart & Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5" />
                  Performance Chart — {chartYear}
                </CardTitle>
                <CardDescription className="mt-1">
                  Visual representation of marks across terms
                </CardDescription>
              </div>
              <Select
                value={String(chartYear)}
                onValueChange={(v) => setChartYear(Number(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <StudentPerformanceBar
              data={chartData}
              electiveLabels={studentElectiveLabels}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Reports and presentations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href={`/dashboard/reports?studentId=${student.id}&studentName=${encodeURIComponent(student.name)}&indexNumber=${encodeURIComponent(student.indexNumber ?? "")}&className=${encodeURIComponent(`${student.class.grade}${student.class.section}`)}`}
              className="block mb-2"
            >
              <Button variant="outline" className="w-full justify-start">
                <FileText className="size-4 mr-2" />
                View Progress Report
              </Button>
            </Link>

            <Link href={`/preview/${student.id}`} target="_blank">
              <Button variant="outline" className="w-full justify-start">
                <Presentation className="size-4 mr-2" />
                Preview Mode
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
