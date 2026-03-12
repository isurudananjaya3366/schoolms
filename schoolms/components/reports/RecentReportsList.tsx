"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clock, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditEntry {
  id: string;
  timestamp: string;
  userDisplayName: string;
  details: string;
}

interface ParsedDetails {
  studentName?: string;
  indexNumber?: string;
  year?: number;
}

interface SelectedStudent {
  id: string;
  name: string;
  indexNumber: string;
}

interface RecentReportsListProps {
  role: string;
  onStudentSelect: (student: SelectedStudent) => void;
  onYearChange: (year: number) => void;
}

export default function RecentReportsList({
  role,
  onStudentSelect,
  onYearChange,
}: RecentReportsListProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdminOrAbove = role === "ADMIN" || role === "SUPERADMIN";

  useEffect(() => {
    if (!isAdminOrAbove) return;

    async function fetchRecent() {
      try {
        const res = await fetch("/api/audit-log?action=REPORT_VIEWED&limit=10");
        if (res.ok) {
          const data = await res.json();
          setEntries(data.items || []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, [isAdminOrAbove]);

  if (!isAdminOrAbove) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recent report activity
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => {
        let parsed: ParsedDetails = {};
        try {
          parsed = JSON.parse(entry.details);
        } catch {
          // details is not JSON — skip parsing
        }

        const handleClick = () => {
          if (parsed.indexNumber && parsed.studentName) {
            // We don't have the student ID from the audit log targetId
            // We'll use targetId from the audit entry if available
            const auditEntry = entry as AuditEntry & { targetId?: string };
            if (auditEntry.targetId) {
              onStudentSelect({
                id: auditEntry.targetId,
                name: parsed.studentName,
                indexNumber: parsed.indexNumber,
              });
            }
          }
          if (parsed.year) {
            onYearChange(parsed.year);
          }
        };

        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={handleClick}
              className="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {parsed.indexNumber || "Unknown"}{" "}
                  {parsed.studentName ? `— ${parsed.studentName}` : ""}
                </span>
                {parsed.year && (
                  <span className="text-xs text-muted-foreground">
                    {parsed.year}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {entry.userDisplayName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(entry.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
