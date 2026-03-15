import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import MarkEntryClient from "@/components/marks/MarkEntryClient";
import type { TeacherFilter } from "@/hooks/useMarkEntryState";

export default async function MarkEntryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, id } = session.user;

  if (!(await hasPermission(role, "edit_marks"))) redirect("/dashboard");

  let teacherFilter: TeacherFilter | null = null;
  if (role === "TEACHER") {
    // Prefer TeacherAssignment records (new system)
    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId: id },
      select: { classId: true, type: true, subject: true, electiveName: true },
    });

    if (assignments.length > 0) {
      const classId = assignments[0].classId;
      // Only consider assignments for the teacher's primary class
      const classAssignments = assignments.filter((a) => a.classId === classId);
      const isMain = classAssignments.some(
        (a) => a.type === "MAIN" || a.type === "ADDITIONAL"
      );
      const subjects = classAssignments
        .filter((a) => a.type === "SUBJECT" && a.subject)
        .map((a) => ({
          subject: a.subject!,
          electiveName: a.electiveName ?? undefined,
        }));
      teacherFilter = { classId, isMain, subjects };
    } else {
      // Fallback: old-style assignedClassId (full access)
      const userRecord = await prisma.user.findUnique({
        where: { id },
        select: { assignedClassId: true },
      });
      if (userRecord?.assignedClassId) {
        teacherFilter = {
          classId: userRecord.assignedClassId,
          isMain: true,
          subjects: [],
        };
      }
    }
  }

  return <MarkEntryClient role={role} teacherFilter={teacherFilter} />;
}
