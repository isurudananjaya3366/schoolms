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
import { Presentation, ExternalLink, Users, Loader2 } from "lucide-react";

const GRADES = [10, 11];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

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

  // Fetch class groups whenever grade changes
  useEffect(() => {
    setLoadingClasses(true);
    setSelectedClassId("");
    setClassGroups([]);

    fetch(`/api/class-groups?grade=${grade}`)
      .then((r) => r.json())
      .then((data: ClassGroup[]) => {
        setClassGroups(data);
        if (data.length > 0) setSelectedClassId(data[0].id);
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoadingClasses(false));
  }, [grade]);

  const selectedClass = classGroups.find((c) => c.id === selectedClassId);

  function launchPresenter() {
    if (!selectedClassId) return;
    window.open(
      `/preview/session?classId=${encodeURIComponent(selectedClassId)}&year=${year}`,
      "_blank",
    );
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
          <CardDescription>Choose the year, grade and section to begin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Academic Year */}
          <div className="flex items-center gap-4">
            <Label className="w-24 shrink-0 text-sm">Academic Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {/* Preview of selection */}
          {selectedClass && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-3">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Grade {selectedClass.grade}{selectedClass.section} — {year}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedClass._count.students} students in queue
                </p>
              </div>
              <Badge variant="secondary">{year}</Badge>
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={!selectedClassId || loadingClasses}
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
