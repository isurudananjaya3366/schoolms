"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Presentation, ExternalLink, Users, Loader2, CalendarX, Settings2, MonitorSmartphone } from "lucide-react";

const GRADES = [10, 11];
const CURRENT_YEAR = new Date().getFullYear();

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

interface ClassGroup {
  id: string;
  grade: number;
  section: string;
  _count: { students: number };
}

export default function PresentationPreviewPage() {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [grade, setGrade] = useState<number>(11);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [medium, setMedium] = useState<"english" | "sinhala">("english");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch class groups whenever grade changes
  useEffect(() => {
    setLoadingClasses(true);
    setSelectedClassId("");
    setClassGroups([]);
    setAvailableYears([]);
    setAvailableTerms([]);
    setSelectedTerm("");

    fetch(`/api/class-groups?grade=${grade}`)
      .then((r) => r.json())
      .then((data: ClassGroup[]) => {
        setClassGroups(data);
        if (data.length > 0) setSelectedClassId(data[0].id);
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoadingClasses(false));
  }, [grade]);

  // Fetch available years whenever the selected class changes
  useEffect(() => {
    if (!selectedClassId) {
      setAvailableYears([]);
      setAvailableTerms([]);
      setSelectedTerm("");
      return;
    }

    setLoadingYears(true);
    setAvailableYears([]);
    setAvailableTerms([]);
    setSelectedTerm("");

    fetch(`/api/preview/available-years?classId=${encodeURIComponent(selectedClassId)}`)
      .then((r) => r.json())
      .then((data: { years: number[] }) => {
        const years = data.years ?? [];
        setAvailableYears(years);
        if (years.length > 0) {
          setYear(years[0]); // default to most recent year with data
        }
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoadingYears(false));
  }, [selectedClassId]);

  // Fetch available terms whenever class + year combination changes
  useEffect(() => {
    if (!selectedClassId || !availableYears.length) {
      setAvailableTerms([]);
      setSelectedTerm("");
      return;
    }

    setLoadingTerms(true);
    setAvailableTerms([]);
    setSelectedTerm("");

    fetch(
      `/api/preview/available-terms?classId=${encodeURIComponent(selectedClassId)}&year=${year}`,
    )
      .then((r) => r.json())
      .then((data: { terms: string[] }) => {
        const terms = data.terms ?? [];
        setAvailableTerms(terms);
        // Default to latest available term
        if (terms.length > 0) setSelectedTerm(terms[terms.length - 1]);
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoadingTerms(false));
  }, [selectedClassId, year, availableYears.length]);

  const selectedClass = classGroups.find((c) => c.id === selectedClassId);
  const hasYearData = availableYears.length > 0;

  function launchPresenter() {
    if (!selectedClassId || !hasYearData) return;
    const termParam = selectedTerm
      ? `&focusTerm=${encodeURIComponent(selectedTerm)}`
      : "";
    const mediumParam = medium === "sinhala" ? "&medium=sinhala" : "";
    window.open(
      `/preview/session?classId=${encodeURIComponent(selectedClassId)}&year=${year}${termParam}${mediumParam}`,
      "_blank",
    );
  }

  function openConfigureSlides() {
    window.open("/preview/configure", "_blank");
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presentation Preview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select the class and academic year, then launch the full-screen class presenter
          for parent meetings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Presentation className="size-4" />
            Configure Presenter
          </CardTitle>
          <CardDescription>Choose the grade, section and year to begin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Grade */}
          <div className="flex items-center gap-4">
            <Label className="w-24 shrink-0 text-sm">Grade</Label>
            <Select value={String(grade)} onValueChange={(v) => setGrade(Number(v))}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Grade {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class / Section */}
          <div className="flex items-center gap-4">
            <Label className="w-24 shrink-0 text-sm">Class</Label>
            {loadingClasses ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading classes…
              </div>
            ) : (
              <Select
                value={selectedClassId}
                onValueChange={setSelectedClassId}
                disabled={classGroups.length === 0}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classGroups.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Grade {c.grade}{c.section}
                      <span className="ml-2 text-muted-foreground">
                        ({c._count.students} students)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Academic Year - only years with data */}
          <div className="flex items-center gap-4">
            <Label className="w-24 shrink-0 text-sm">Academic Year</Label>
            {loadingYears ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading years…
              </div>
            ) : !selectedClassId ? (
              <p className="text-sm text-muted-foreground">Select a class first</p>
            ) : !hasYearData ? (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <CalendarX className="size-4 shrink-0" />
                No mark data for this class
              </div>
            ) : (
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="flex-1">
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
            )}
          </div>

          {/* Focus Term */}
          <div className="flex items-center gap-4">
            <Label className="w-24 shrink-0 text-sm">Focus Term</Label>
            {loadingTerms ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading terms…
              </div>
            ) : !selectedClassId || !hasYearData ? (
              <p className="text-sm text-muted-foreground">Select a class and year first</p>
            ) : availableTerms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No terms available</p>
            ) : (
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTerms.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TERM_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Medium */}
          <div className="flex items-center gap-4">
            <Label className="w-24 shrink-0 text-sm">Medium</Label>
            <div className="flex items-center gap-1 rounded-md border p-0.5 bg-muted/30">
              <button
                onClick={() => setMedium("english")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  medium === "english"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setMedium("sinhala")}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  medium === "sinhala"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sinhala
              </button>
            </div>
            {medium === "sinhala" && (
              <button
                onClick={openConfigureSlides}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Settings2 className="size-3.5" />
                Configure Slides
              </button>
            )}
          </div>

          {/* Preview of selection */}
          {selectedClass && hasYearData && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-3">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Grade {selectedClass.grade}{selectedClass.section} - {year}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedClass._count.students} students in queue
                </p>
              </div>
              <Badge variant="secondary">
                {year}{selectedTerm ? ` · ${TERM_LABELS[selectedTerm] ?? selectedTerm}` : ""}
              </Badge>
            </div>
          )}

          {isMobile && (
            <div className="flex items-center gap-2 rounded-md border border-orange-400 bg-orange-100 px-4 py-3 text-sm font-medium text-orange-900 dark:border-orange-500/60 dark:bg-orange-950/40 dark:text-orange-200">
              <MonitorSmartphone className="size-4 shrink-0" />
              The presenter requires a desktop or laptop screen. Please open this page on a larger device to launch the presentation.
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={isMobile || !selectedClassId || loadingClasses || loadingYears || !hasYearData}
            onClick={launchPresenter}
          >
            <ExternalLink className="size-4" />
            Launch Presenter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
