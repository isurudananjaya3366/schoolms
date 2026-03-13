"use client";

import { useState, useMemo } from "react";
import { Role } from "@prisma/client";
import ProfileHeader from "@/components/students/ProfileHeader";
import MarksTable from "@/components/students/MarksTable";
import WNoteBlock from "@/components/students/WNoteBlock";
import RankingDisplay from "@/components/students/RankingDisplay";
import { StudentPerformanceBar, SubjectAverageBar } from "@/components/charts";
import { SUBJECT_KEYS, CORE_SUBJECT_NAMES } from "@/lib/chartPalette";
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
import { BarChart3, FileText, Presentation, TrendingUp, TrendingDown, Star, Hash } from "lucide-react";
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
  /** When true, hides admin-only sections (Rankings, Actions) for the public portal */
  publicMode?: boolean;
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
/*  Public-analytics helpers                                           */
/* ------------------------------------------------------------------ */

/** Compute per-subject averages across all mark records for a student */
function buildSubjectAverages(
  markRecords: MarkRecordData[],
  electives: { categoryI: string; categoryII: string; categoryIII: string },
) {
  const subjectLabels: Record<string, string> = {
    ...CORE_SUBJECT_NAMES,
    categoryI: electives.categoryI,
    categoryII: electives.categoryII,
    categoryIII: electives.categoryIII,
  };

  return SUBJECT_KEYS.map((key) => {
    const values = markRecords
      .map((r) => r.marks[key as keyof typeof r.marks])
      .filter((v): v is number => typeof v === "number");
    const average =
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { subject: subjectLabels[key] ?? key, average, count: values.length };
  });
}

/** Compute summary statistics from mark records */
function buildStudentStats(markRecords: MarkRecordData[]) {
  if (markRecords.length === 0) return null;
  const totals = markRecords.map((r) =>
    Object.values(r.marks).reduce<number>(
      (acc, v) => acc + (typeof v === "number" ? v : 0),
      0,
    ),
  );
  const bestTotal = Math.max(...totals);
  const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;

  // Best / weakest subject by average across all records
  const subjSums: Record<string, { sum: number; count: number }> = {};
  for (const r of markRecords) {
    for (const key of SUBJECT_KEYS) {
      const v = r.marks[key as keyof typeof r.marks];
      if (typeof v === "number") {
        if (!subjSums[key]) subjSums[key] = { sum: 0, count: 0 };
        subjSums[key].sum += v;
        subjSums[key].count++;
      }
    }
  }

  const subjAvgs = Object.entries(subjSums).map(([key, { sum, count }]) => ({
    key,
    avg: sum / count,
  }));

  const best = subjAvgs.reduce((a, b) => (b.avg > a.avg ? b : a), subjAvgs[0]);
  const worst = subjAvgs.reduce((a, b) => (b.avg < a.avg ? b : a), subjAvgs[0]);

  return { bestTotal, avgTotal, termCount: markRecords.length, best, worst };
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
  publicMode = false,
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

  /** Public-mode analytics — recompute whenever the filtered records change */
  const subjectAverages = useMemo(
    () => (publicMode ? buildSubjectAverages(filteredMarkRecords, student.electives) : []),
    [publicMode, filteredMarkRecords, student.electives],
  );
  const studentStats = useMemo(
    () => (publicMode ? buildStudentStats(filteredMarkRecords) : null),
    [publicMode, filteredMarkRecords],
  );

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
              {!publicMode && <RankingDisplay studentId={student.id} year={year} />}
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
          {!publicMode && <RankingDisplay studentId={student.id} year={selectedYear} />}
        </>
      )}

      {/* Performance Chart & Actions */}
      <div className={`grid gap-4 ${publicMode ? "" : "md:grid-cols-3"}`}>
        <Card className={publicMode ? "col-span-full" : "md:col-span-2"}>
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

        {!publicMode && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Reports and presentations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href={`/dashboard/student-reports?studentId=${student.id}&studentName=${encodeURIComponent(student.name)}&indexNumber=${encodeURIComponent(student.indexNumber ?? "")}&className=${encodeURIComponent(`${student.class.grade}${student.class.section}`)}`}
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
        )}
      </div>

      {/* ---- Public-only analytics ---- */}
      {publicMode && studentStats && (
        <>
          {/* Stats summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <TrendingUp className="size-3.5" />
                  Best Term Total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{studentStats.bestTotal}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Hash className="size-3.5" />
                  Avg Term Total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {studentStats.avgTotal.toFixed(1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Star className="size-3.5 text-amber-500" />
                  Best Subject
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold leading-tight">
                  {CORE_SUBJECT_NAMES[studentStats.best.key] ??
                    student.electives[
                      studentStats.best.key as keyof typeof student.electives
                    ] ??
                    studentStats.best.key}
                </p>
                <p className="text-xs text-muted-foreground">
                  avg {studentStats.best.avg.toFixed(1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <TrendingDown className="size-3.5 text-rose-500" />
                  Needs Attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold leading-tight">
                  {CORE_SUBJECT_NAMES[studentStats.worst.key] ??
                    student.electives[
                      studentStats.worst.key as keyof typeof student.electives
                    ] ??
                    studentStats.worst.key}
                </p>
                <p className="text-xs text-muted-foreground">
                  avg {studentStats.worst.avg.toFixed(1)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Subject Averages chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subject Averages</CardTitle>
              <CardDescription>
                {showFullRecords
                  ? "Average marks per subject across all recorded terms"
                  : `Average marks per subject for ${selectedYear}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubjectAverageBar
                subjectAverages={subjectAverages}
                isAnimationActive={false}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
