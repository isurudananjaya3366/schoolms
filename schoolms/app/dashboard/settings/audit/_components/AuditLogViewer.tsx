"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Trash2 } from "lucide-react";
import FilterRow from "./FilterRow";
import AuditLogTable from "./AuditLogTable";
import RowDetailModal from "./RowDetailModal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userDisplayName: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  ipAddress: string | null;
  details: string;
}

interface ApiResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AuditLogViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters from URL
  const [fromDate, setFromDate] = useState(searchParams.get("fromDate") ?? "");
  const [toDate, setToDate] = useState(searchParams.get("toDate") ?? "");
  const [userId, setUserId] = useState(searchParams.get("userId") ?? "");
  const [actionTypes, setActionTypes] = useState<string[]>(
    searchParams.get("actionTypes")?.split(",").filter(Boolean) ?? []
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [page, setPage] = useState(
    Number(searchParams.get("page")) || 1
  );
  const [limit] = useState(
    Number(searchParams.get("limit")) || 50
  );

  // Data state
  const [data, setData] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // Sync filters to URL
  const syncUrl = useCallback(
    (overrides?: Record<string, string | number>) => {
      const params = new URLSearchParams();
      const values: Record<string, string | number> = {
        page,
        limit,
        fromDate,
        toDate,
        userId,
        actionTypes: actionTypes.join(","),
        search: debouncedSearch,
        ...overrides,
      };
      for (const [key, val] of Object.entries(values)) {
        const v = String(val);
        if (v) params.set(key, v);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [page, limit, fromDate, toDate, userId, actionTypes, debouncedSearch, router]
  );

  // Fetch data when filters change
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        if (userId) params.set("userId", userId);
        if (actionTypes.length > 0)
          params.set("actionTypes", actionTypes.join(","));
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(`/api/audit-log?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch audit logs");
        const json: ApiResponse = await res.json();
        setData(json.data);
        setTotal(json.total);
        setTotalPages(json.totalPages);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Failed to load audit logs");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    syncUrl();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, fromDate, toDate, userId, actionTypes, debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleFilterChange = (
    key: "fromDate" | "toDate" | "userId",
    value: string
  ) => {
    if (key === "fromDate") setFromDate(value);
    else if (key === "toDate") setToDate(value);
    else if (key === "userId") setUserId(value);
    setPage(1);
  };

  const handleActionTypesChange = (types: string[]) => {
    setActionTypes(types);
    setPage(1);
  };

  // Build export URL with current filters
  const exportUrl = (() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (userId) params.set("userId", userId);
    if (actionTypes.length > 0)
      params.set("actionTypes", actionTypes.join(","));
    if (debouncedSearch) params.set("search", debouncedSearch);
    return `/api/audit-log/export?${params.toString()}`;
  })();

  const [clearing, setClearing] = useState(false);

  const handleClearLog = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/audit-log/clear", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Audit log cleared successfully.");
      setData([]);
      setTotal(0);
      setTotalPages(0);
      setPage(1);
    } catch {
      toast.error("Failed to clear audit log.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Log
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Audit Log?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all audit log entries. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearLog}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear All Entries
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterRow
            fromDate={fromDate}
            toDate={toDate}
            userId={userId}
            actionTypes={actionTypes}
            search={search}
            onFilterChange={handleFilterChange}
            onActionTypesChange={handleActionTypesChange}
            onSearchChange={setSearch}
            exportUrl={exportUrl}
          />

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <AuditLogTable
              data={data}
              onRowClick={setSelectedEntry}
            />
          )}

          {/* Pagination */}
          {!loading && totalPages > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {data.length} of {total} entries (page {page} of{" "}
                {totalPages})
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {!loading && data.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No audit log entries found.
            </p>
          )}
        </CardContent>
      </Card>

      <RowDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
