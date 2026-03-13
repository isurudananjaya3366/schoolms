"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Users } from "lucide-react";

const GRADES = [10, 11] as const;
const SECTIONS = ["A", "B", "C", "D", "E", "F"] as const;

interface ClassGroup {
  id: string;
  grade: number;
  section: string;
  _count?: { students: number };
}

export default function ClassGroupsSection() {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ClassGroup | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/class-groups");
      if (res.ok) {
        setGroups(await res.json());
      }
    } catch {
      toast.error("Failed to load class groups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const groupMap = new Map<string, ClassGroup>();
  for (const g of groups) {
    groupMap.set(`${g.grade}-${g.section}`, g);
  }

  const handleAdd = async (grade: number, section: string) => {
    const key = `${grade}-${section}`;
    setPendingOp(key);
    try {
      const res = await fetch("/api/class-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, section }),
      });
      if (res.ok) {
        toast.success(`Added Grade ${grade} Section ${section}`);
        await fetchGroups();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to add class group.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setPendingOp(null);
    }
  };

  const handleRemove = async (group: ClassGroup) => {
    const key = `${group.grade}-${group.section}`;
    setPendingOp(key);
    setConfirmRemove(null);
    try {
      const res = await fetch(`/api/class-groups/${group.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(
          `Removed Grade ${group.grade} Section ${group.section}`
        );
        await fetchGroups();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to remove class group.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setPendingOp(null);
    }
  };

  const totalCount = groups.length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Class Groups</CardTitle>
          <CardDescription>
            Manage class groups per grade. Toggle sections A–F for each grade
            (10–11).
            <span className="ml-2">
              <Badge variant="outline">{totalCount}</Badge> configured
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {GRADES.map((g) => (
                <Skeleton key={g} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {GRADES.map((grade) => (
                <div
                  key={grade}
                  className="flex flex-wrap items-center gap-2 rounded-md border p-3"
                >
                  <span className="w-20 text-sm font-semibold shrink-0">
                    Grade {grade}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {SECTIONS.map((section) => {
                      const key = `${grade}-${section}`;
                      const existing = groupMap.get(key);
                      const isPending = pendingOp === key;
                      const studentCount =
                        existing?._count?.students ?? 0;

                      return (
                        <Tooltip key={key}>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant={existing ? "default" : "outline"}
                              disabled={isPending}
                              className="min-w-[56px] relative"
                              onClick={() => {
                                if (existing) {
                                  setConfirmRemove(existing);
                                } else {
                                  handleAdd(grade, section);
                                }
                              }}
                            >
                              {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  {section}
                                  {existing && studentCount > 0 && (
                                    <span className="ml-1 inline-flex items-center gap-0.5 text-xs opacity-80">
                                      <Users className="h-3 w-3" />
                                      {studentCount}
                                    </span>
                                  )}
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {existing
                              ? `Section ${section} — ${studentCount} student${studentCount !== 1 ? "s" : ""}. Click to remove.`
                              : `Add Section ${section}`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove class group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove Grade {confirmRemove?.grade} Section{" "}
              {confirmRemove?.section}. Class groups with enrolled students
              cannot be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
