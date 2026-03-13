import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import ClassPresenterShell from "@/components/preview/ClassPresenterShell";

export const metadata = {
  title: "Class Presenter | SchoolMS",
};

export default async function PreviewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; year?: string; focusTerm?: string; medium?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { classId, year: yearParam, focusTerm, medium } = await searchParams;
  if (!classId) notFound();

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classId },
    select: { id: true, grade: true, section: true },
  });

  if (!classGroup) notFound();

  const students = await prisma.student.findMany({
    where: { classId, isDeleted: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, indexNumber: true },
  });

  if (students.length === 0) notFound();

  // Serialize to plain objects (remove Prisma internals)
  const plainStudents = students.map((s) => ({
    id: s.id,
    name: s.name,
    indexNumber: s.indexNumber ?? null,
  }));

  return (
    <ClassPresenterShell
      classGroup={{ grade: classGroup.grade, section: classGroup.section }}
      students={plainStudents}
      year={year}
      focusTerm={focusTerm}
      medium={medium}
    />
  );
}
