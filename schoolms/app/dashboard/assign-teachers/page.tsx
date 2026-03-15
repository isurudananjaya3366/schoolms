import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import AssignTeachersClient from "./AssignTeachersClient";

export const metadata = { title: "Assign Teachers | SchoolMS" };

export default async function AssignTeachersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!(await hasPermission(session.user.role, "assign_teachers"))) {
    redirect("/dashboard");
  }

  // Fetch all class groups
  const classGroups = await prisma.classGroup.findMany({
    orderBy: [{ grade: "asc" }, { section: "asc" }],
  });

  // Fetch all teacher users with their assigned class
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", isActive: true },
    select: { id: true, name: true, email: true, assignedClassId: true },
    orderBy: { name: "asc" },
  });

  // Build class→teacher map
  const teacherByClassId = new Map(
    teachers
      .filter((t) => t.assignedClassId)
      .map((t) => [t.assignedClassId!, { id: t.id, name: t.name, email: t.email }])
  );

  const classesWithTeachers = classGroups.map((cls) => ({
    id: cls.id,
    grade: cls.grade,
    section: cls.section,
    teacher: teacherByClassId.get(cls.id) ?? null,
  }));

  return (
    <AssignTeachersClient
      classes={classesWithTeachers}
      teachers={teachers}
    />
  );
}
