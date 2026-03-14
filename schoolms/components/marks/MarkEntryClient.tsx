"use client";

import { useMarkEntryState } from "@/hooks/useMarkEntryState";
import FilterPanel from "@/components/marks/FilterPanel";
import MarkEntryGrid from "@/components/marks/MarkEntryGrid";
import SavePanel from "@/components/marks/SavePanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface MarkEntryClientProps {
  role: string;
}

export default function MarkEntryClient({ role }: MarkEntryClientProps) {
  const state = useMarkEntryState();

  // Role check: only ADMIN, SUPERADMIN, STAFF, and TEACHER can access
  if (role !== "ADMIN" && role !== "SUPERADMIN" && role !== "STAFF" && role !== "TEACHER") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  // Settings loading
  if (state.settingsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Settings error
  if (state.settingsError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-sm text-destructive">{state.settingsError}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const handleSaveDraft = async () => {
    const result = await state.handleSaveDraft();
    if (!result) return;
    if (result.success) {
      toast.success(
        `${result.count} mark${result.count !== 1 ? "s" : ""} saved as draft.`
      );
    } else if ("partial" in result && result.partial) {
      toast.warning(
        `Some marks could not be saved. ${result.failedKeys?.length || 0} entries failed.`
      );
    } else if ("error" in result) {
      toast.error(result.error || "Failed to save marks.");
    }
  };

  const handlePublish = async () => {
    const result = await state.handlePublish();
    if (!result) return;
    if (result.success) {
      if ("releaseError" in result && result.releaseError) {
        toast.warning(String(result.releaseError));
      } else {
        toast.success(
          `${result.count} mark${result.count !== 1 ? "s" : ""} published successfully.`
        );
      }
    } else if ("partial" in result && result.partial) {
      toast.warning(
        `Some marks could not be saved. ${result.failedKeys?.length || 0} entries failed.`
      );
    } else if ("error" in result) {
      toast.error(result.error || "Failed to publish marks.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-2xl font-bold">Mark Entry</h1>
        {state.classLabel && state.term && (
          <p className="text-sm text-muted-foreground">
            {state.classLabel} · {state.term?.replace("_", " ")} · {state.year}
            {state.studentCount > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {state.studentCount} student{state.studentCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        )}
      </div>

      <FilterPanel
        grade={state.grade}
        classId={state.classId}
        term={state.term}
        year={state.year}
        yearOptions={state.yearOptions}
        yearOptionsLoading={state.yearOptionsLoading}
        classOptions={state.classOptions}
        classLoading={state.classLoading}
        searchQuery={state.searchQuery}
        onGradeChange={state.handleGradeChange}
        onClassChange={state.handleClassChange}
        onTermChange={state.handleTermChange}
        onYearChange={state.handleYearChange}
        onSearchChange={state.handleSearchChange}
      />

      {/* Grid area */}
      {!state.filtersReady && !state.gridLoading && (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground">
            Select a grade, class, year, and term to load marks.
          </p>
        </div>
      )}

      {state.gridLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {state.gridError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center gap-4">
            <span>{state.gridError}</span>
            <Button variant="outline" size="sm" onClick={state.retryGridFetch}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!state.gridLoading &&
        !state.gridError &&
        state.filtersReady &&
        state.rows.length === 0 && (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              No students found in this class group.
            </p>
          </div>
        )}

      {!state.gridLoading && !state.gridError && state.rows.length > 0 && (
        <>
          {state.filteredRows.length === 0 && state.searchQuery ? (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground">
                No students match &quot;{state.searchQuery}&quot;.
              </p>
            </div>
          ) : (
            <MarkEntryGrid
              rows={state.filteredRows}
              editedValues={state.editedValues}
              dirtyMap={state.dirtyMap}
              invalidRows={state.invalidRows}
              onMarkChange={state.handleMarkChange}
            />
          )}
          <SavePanel
            dirtyCount={state.dirtyCount}
            saving={state.saving}
            hasInvalidRows={state.hasInvalidRows}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
          />
        </>
      )}
    </div>
  );
}
