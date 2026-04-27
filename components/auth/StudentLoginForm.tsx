"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Loader2 } from "lucide-react";

interface StudentResult {
  id: string;
  name: string;
  indexNumber: string | null;
  class: { grade: number; section: string };
}

export function StudentLoginForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<StudentResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    setError("");
    setIsLoading(true);
    setSearched(false);
    setMatches([]);

    try {
      const res = await fetch(`/api/student/lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Search failed. Please try again.");
        return;
      }

      const students: StudentResult[] = data.students ?? [];
      if (students.length === 0) {
        setError("No student found. Check your name or index number.");
        return;
      }

      if (students.length === 1 && students[0].indexNumber) {
        // Unique match - go straight to profile
        router.push(`/student/view/${encodeURIComponent(students[0].indexNumber)}`);
        return;
      }

      // Multiple matches - show picker
      setMatches(students);
      setSearched(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function selectStudent(s: StudentResult) {
    if (s.indexNumber) {
      router.push(`/student/view/${encodeURIComponent(s.indexNumber)}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <GraduationCap className="h-4 w-4 shrink-0" />
        <span>Enter your name or index number to view your profile.</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="student-query">Name or Index Number</Label>
          <Input
            id="student-query"
            type="text"
            placeholder="e.g. Sahan Silva  or  STU0001"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatches([]);
              setSearched(false);
              setError("");
            }}
            disabled={isLoading}
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || query.trim().length < 2}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching…
            </>
          ) : (
            "Find My Profile"
          )}
        </Button>
      </form>

      {/* Multiple-match picker */}
      {searched && matches.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Multiple students found. Please select yours:
          </p>
          {matches.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => selectStudent(s)}
            >
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.indexNumber && (
                    <p className="text-xs text-muted-foreground">
                      Index: {s.indexNumber}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  Grade {s.class.grade}{s.class.section}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
