"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserX, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type TeacherUser = {
  id: string;
  name: string | null;
  email: string;
  assignedClassId: string | null;
};

type ClassWithTeacher = {
  id: string;
  grade: number;
  section: string;
  teacher: { id: string; name: string | null; email: string } | null;
};

interface AssignTeachersClientProps {
  classes: ClassWithTeacher[];
  teachers: TeacherUser[];
}

export default function AssignTeachersClient({
  classes: initialClasses,
  teachers,
}: AssignTeachersClientProps) {
  const [classes, setClasses] = useState<ClassWithTeacher[]>(initialClasses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithTeacher | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("__none__");
  const [isPending, startTransition] = useTransition();

  function openDialog(cls: ClassWithTeacher) {
    setSelectedClass(cls);
    setSelectedTeacherId(cls.teacher?.id ?? "__none__");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!selectedClass) return;

    const teacherId = selectedTeacherId === "__none__" ? null : selectedTeacherId;

    startTransition(async () => {
      try {
        const res = await fetch("/api/teachers/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: selectedClass.id, teacherId }),
        });

        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Request failed" }));
          toast.error(error ?? "Failed to save assignment");
          return;
        }

        // Update local state
        const assignedTeacher = teachers.find((t) => t.id === teacherId) ?? null;
        setClasses((prev) =>
          prev.map((cls) => {
            if (cls.id === selectedClass.id) {
              return {
                ...cls,
                teacher: assignedTeacher
                  ? { id: assignedTeacher.id, name: assignedTeacher.name, email: assignedTeacher.email }
                  : null,
              };
            }
            // Clear previous assignment if this teacher was elsewhere
            if (teacherId && cls.teacher?.id === teacherId) {
              return { ...cls, teacher: null };
            }
            return cls;
          })
        );

        toast.success(
          teacherId
            ? `Assigned ${assignedTeacher?.name ?? "teacher"} to Grade ${selectedClass.grade}${selectedClass.section}`
            : `Removed teacher from Grade ${selectedClass.grade}${selectedClass.section}`
        );
        setDialogOpen(false);
      } catch {
        toast.error("An unexpected error occurred");
      }
    });
  }

  // Build a map of teacherId → class label for "already assigned" hints
  const teacherAssignedClass = new Map<string, string>();
  for (const cls of classes) {
    if (cls.teacher) {
      teacherAssignedClass.set(cls.teacher.id, `Grade ${cls.grade}${cls.section}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assign Teachers</h1>
          <p className="text-sm text-muted-foreground">
            Assign a registered teacher account to each class group
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Grade</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Assigned Teacher</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  No class groups found. Create class groups first.
                </TableCell>
              </TableRow>
            ) : (
              classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">Grade {cls.grade}</TableCell>
                  <TableCell>{cls.section}</TableCell>
                  <TableCell>
                    {cls.teacher ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">
                          {cls.teacher.name ?? cls.teacher.email}
                        </span>
                        <span className="text-xs text-muted-foreground">{cls.teacher.email}</span>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground border-dashed gap-1"
                      >
                        <UserX className="h-3 w-3" />
                        Unassigned
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDialog(cls)}
                      className="gap-1.5"
                    >
                      {cls.teacher ? "Change" : "Assign"}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign Teacher — Grade {selectedClass?.grade}
              {selectedClass?.section}
            </DialogTitle>
            <DialogDescription>
              Select a teacher to assign to this class, or remove the current assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a teacher…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">— No teacher (unassign) —</span>
                </SelectItem>
                {teachers.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    No teacher accounts found
                  </SelectItem>
                ) : (
                  teachers.map((t) => {
                    const alreadyAt = teacherAssignedClass.get(t.id);
                    const isSelf = alreadyAt === `Grade ${selectedClass?.grade}${selectedClass?.section}`;
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span>{t.name ?? t.email}</span>
                          {alreadyAt && !isSelf && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              (assigned to {alreadyAt})
                            </span>
                          )}
                          {isSelf && (
                            <span className="text-xs text-green-600 dark:text-green-400">
                              (current)
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
