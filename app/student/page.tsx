"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, GraduationCap, Loader2 } from "lucide-react";

interface StudentResult {
  id: string;
  name: string;
  indexNumber: string | null;
  class: { grade: number; section: string };
}

export default function StudentSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;

    setLoading(true);
    setError("");
    setSearched(false);

    try {
      const res = await fetch(`/api/student/lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
        setResults([]);
      } else {
        setResults(data.students ?? []);
      }
    } catch {
      setError("Network error. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function viewProfile(s: StudentResult) {
    if (s.indexNumber) {
      router.push(`/student/view/${encodeURIComponent(s.indexNumber)}`);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-20 px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Student Portal</h1>
          <p className="text-sm text-muted-foreground">
            Enter your name or index number to view your profile and marks.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Sahan Silva  or  STU0001"
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={loading || query.trim().length < 2}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {/* Results */}
        {searched && !loading && (
          <div className="space-y-2">
            {results.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">
                No students found for &quot;{query}&quot;.
              </p>
            ) : (
              results.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => viewProfile(s)}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium">{s.name}</CardTitle>
                      <Badge variant="outline">
                        Grade {s.class.grade}{s.class.section}
                      </Badge>
                    </div>
                  </CardHeader>
                  {s.indexNumber && (
                    <CardContent className="py-0 px-4 pb-3">
                      <p className="text-xs text-muted-foreground">
                        Index: {s.indexNumber}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
