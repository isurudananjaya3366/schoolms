"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClipboardEdit, UserPlus, FileText, Loader2, GraduationCap, Megaphone, Presentation } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function QuickActions() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; indexNumber: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      setSearchError(false);

      try {
        const res = await fetch(
          `/api/students?search=${encodeURIComponent(search.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.data || []);
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setSearchError(true);
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [search]);

  return (
    <div className="space-y-4">
      {/* Primary actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="default">
          <Link href="/dashboard/marks/entry">
            <ClipboardEdit className="mr-2 h-4 w-4" />
            Enter Marks
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard/students/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Student
          </Link>
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Student Report</DialogTitle>
              <DialogDescription>
                Search for a student by name or index number to view their profile and generate a report.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Search by name or index number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {isSearching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </div>
              )}
              {searchError && (
                <p className="text-sm text-destructive">
                  Search unavailable. Please try again.
                </p>
              )}
              {!isSearching && !searchError && search.trim() && results.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No students found matching your search.
                </p>
              )}
              {results.length > 0 && (
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {results.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setDialogOpen(false);
                          setSearch("");
                          router.push(`/dashboard/students/${student.id}`);
                        }}
                      >
                        <span className="font-medium">{student.name}</span>
                        <span className="ml-2 text-muted-foreground">
                          #{student.indexNumber}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Quick navigation links */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1">
          Quick Links
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8 text-sm">
            <Link href="/login" target="_blank" rel="noopener noreferrer">
              <GraduationCap className="mr-2 h-3.5 w-3.5" />
              Student Portal
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 text-sm">
            <Link href="/notices" target="_blank" rel="noopener noreferrer">
              <Megaphone className="mr-2 h-3.5 w-3.5" />
              Notice Board
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 text-sm">
            <Link href="/dashboard/preview">
              <Presentation className="mr-2 h-3.5 w-3.5" />
              Presentation
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

