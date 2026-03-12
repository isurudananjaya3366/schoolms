"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Award, BookOpen } from "lucide-react";
import DeleteStudentDialog from "@/components/students/DeleteStudentDialog";

interface ProfileHeaderProps {
  student: {
    id: string;
    name: string;
    indexNumber: string | null;
    electives: {
      categoryI: string;
      categoryII: string;
      categoryIII: string;
    };
    class: {
      grade: number;
      section: string;
    };
    scholarshipMarks?: number | null;
  };
  role: Role;
}

export default function ProfileHeader({ student, role }: ProfileHeaderProps) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const isAdmin = role === Role.ADMIN || role === Role.SUPERADMIN;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Index No.{" "}
            <span className="font-mono font-medium text-foreground">
              {student.indexNumber ?? "N/A"}
            </span>
          </span>
          <span>
            Grade{" "}
            <span className="font-medium text-foreground">
              {student.class.grade}
            </span>
          </span>
          <span>
            Section{" "}
            <span className="font-medium text-foreground">
              {student.class.section}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
            <BookOpen className="size-3.5" />
            Selected Electives:
          </span>
          <Badge variant="outline">{student.electives.categoryI}</Badge>
          <Badge variant="outline">{student.electives.categoryII}</Badge>
          <Badge variant="outline">{student.electives.categoryIII}</Badge>
        </div>
        {student.scholarshipMarks != null && (
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5">
              <Award className="size-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">
                Scholarship Marks: {student.scholarshipMarks}
              </span>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/dashboard/students/${student.id}/edit`)
            }
          >
            <Pencil className="size-3.5 mr-1" />
            Edit Profile
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="size-3.5 mr-1" />
            Delete
          </Button>
        </div>
      )}

      <DeleteStudentDialog
        open={showDelete}
        studentId={student.id}
        studentName={student.name}
        onClose={() => setShowDelete(false)}
        onSuccess={() => router.push("/dashboard/students")}
      />
    </div>
  );
}
