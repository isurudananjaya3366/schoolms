"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface StudentEntry {
  id: string;
  name: string;
  indexNumber: string | null;
  class?: { grade: number; section: string };
}

interface RecentStudentsDrawerProps {
  refreshKey: number;
}

export default function RecentStudentsDrawer({
  refreshKey,
}: RecentStudentsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/students?limit=100&sort=createdAt&order=desc");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.data ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when drawer opens or refreshKey changes while open
  useEffect(() => {
    if (open) {
      fetchStudents();
    }
  }, [open, refreshKey, fetchStudents]);

  const filtered = search.trim()
    ? students.filter((s) => {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.indexNumber && s.indexNumber.toLowerCase().includes(q))
        );
      })
    : students;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" title="View students">
          <Users className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[360px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Students ({students.length})</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 px-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or index…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.trim() ? "No matching students" : "No students yet"}
            </p>
          ) : (
            <ul className="max-h-[calc(100vh-200px)] space-y-1 overflow-y-auto">
              {filtered.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <div className="flex flex-col truncate">
                    <span className="font-medium truncate">{s.name}</span>
                    {s.class && (
                      <span className="text-xs text-muted-foreground">
                        Grade {s.class.grade}{s.class.section}
                      </span>
                    )}
                  </div>
                  <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                    {s.indexNumber ?? "-"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
