"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Presentation, Search, Loader2, ExternalLink, GraduationCap } from "lucide-react";

interface StudentResult {
  id: string;
  name: string;
  indexNumber: string | null;
  class: { grade: number; section: string };
}

export default function PresentationPreviewPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [searched, setSearched] = useState(false);

  /** Pre-load STU0001 on mount */
  useEffect(() => {
    async function preload() {
      try {
        const res = await fetch("/api/student/lookup?q=STU0001");
        if (res.ok) {
          const data = await res.json();
          const student: StudentResult | undefined = data.students?.[0];
          if (student) setSelectedStudent(student);
        }
      } catch {
        /* ignore */
      }
    }
    preload();
  }, []);

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const q = query.trim();
      if (q.length < 2) return;

      setLoading(true);
      setSearched(false);
      try {
        const res = await fetch(`/api/student/lookup?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (res.ok) {
          setResults(data.students ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
        setSearched(true);
      }
    },
    [query],
  );

  function openPreviewer() {
    if (!selectedStudent) return;
    window.open(`/preview/${selectedStudent.id}`, "_blank");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presentation Preview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a student and open the full-screen presentation viewer.
        </p>
      </div>

      {/* Student search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="size-4" />
            Select Student
          </CardTitle>
          <CardDescription>Search by name or index number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Sahan Silva  or  STU0001"
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={loading || query.trim().length < 2}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>

          {/* Search results */}
          {searched && !loading && (
            <div className="space-y-1.5">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students found.</p>
              ) : (
                results.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                      selectedStudent?.id === s.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setSelectedStudent(s)}
                  >
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      {s.indexNumber && (
                        <p className="text-xs text-muted-foreground">
                          Index: {s.indexNumber}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">
                      Grade {s.class.grade}
                      {s.class.section}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected student + Open Previewer button */}
      {selectedStudent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Presentation className="size-4" />
              Ready to Present
            </CardTitle>
            <CardDescription>
              Opens the full-screen slide presenter in a new tab
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border px-4 py-3 bg-muted/30">
              <GraduationCap className="size-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{selectedStudent.name}</p>
                <p className="text-xs text-muted-foreground">
                  Grade {selectedStudent.class.grade}
                  {selectedStudent.class.section}
                  {selectedStudent.indexNumber && ` · ${selectedStudent.indexNumber}`}
                </p>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={openPreviewer}
            >
              <ExternalLink className="size-4" />
              Open the Previewer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
