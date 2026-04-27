import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import MarksManagementClient from "@/components/marks/MarksManagementClient";

export default async function MarksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, id } = session.user;

  if (!(await hasPermission(role, "edit_marks"))) {
    redirect("/dashboard");
  }

  // For TEACHER: get their assigned class id (prefer TeacherAssignment, fall back to User)
  let assignedClassId: string | null = null;
  let teacherSubjectFilter: {
    isMain: boolean;
    subjects: Array<{ subject: string; electiveName?: string }>;
  } | null = null;

  if (role === "TEACHER") {
    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId: id },
      select: { classId: true, type: true, subject: true, electiveName: true },
    });

    if (assignments.length > 0) {
      // Use the first assignment's classId as the primary class
      assignedClassId = assignments[0].classId;

      const classAssignments = assignments.filter((a) => a.classId === assignedClassId);
      const isMain = classAssignments.some(
        (a) => a.type === "MAIN" || a.type === "ADDITIONAL"
      );
      const subjectAssignments = classAssignments
        .filter((a) => a.type === "SUBJECT" && a.subject)
        .map((a) => ({
          subject: a.subject!,
          ...(a.electiveName ? { electiveName: a.electiveName } : {}),
        }));

      teacherSubjectFilter = { isMain, subjects: subjectAssignments };
    } else {
      // Fall back to User.assignedClassId if no TeacherAssignment records
      const userRecord = await prisma.user.findUnique({
        where: { id },
        select: { assignedClassId: true },
      });
      assignedClassId = userRecord?.assignedClassId ?? null;
      // Without assignment records, treat as main teacher (can release all)
      teacherSubjectFilter = { isMain: true, subjects: [] };
    }
  }

  return (
    <MarksManagementClient
      role={role}
      assignedClassId={assignedClassId}
      teacherSubjectFilter={teacherSubjectFilter}
    />
  );
}

