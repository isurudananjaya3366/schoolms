import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import StudentProfileClient from "@/components/students/StudentProfileClient";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      class: true,
      markRecords: true,
    },
  });

  if (!student || student.isDeleted) {
    notFound();
  }

  const role = session.user.role as Role;

  // Fetch academic year from settings
  const academicYearSetting = await prisma.systemConfig.findUnique({
    where: { key: "academic_year" },
  });

  const currentAcademicYear = academicYearSetting
    ? Number(academicYearSetting.value)
    : new Date().getFullYear();

  // Serialize for client components
  const serializedStudent = JSON.parse(JSON.stringify(student));

  // Compute available years from mark records (+ always include current academic year)
  const yearsFromRecords = Array.from(
    new Set(
      serializedStudent.markRecords.map((r: { year: number }) => r.year),
    ),
  ) as number[];

  if (!yearsFromRecords.includes(currentAcademicYear)) {
    yearsFromRecords.push(currentAcademicYear);
  }

  const availableYears = yearsFromRecords.sort((a, b) => b - a); // newest first

  return (
    <StudentProfileClient
      student={{
        id: serializedStudent.id,
        name: serializedStudent.name,
        indexNumber: serializedStudent.indexNumber,
        electives: serializedStudent.electives,
        class: serializedStudent.class,
        scholarshipMarks: serializedStudent.scholarshipMarks ?? null,
      }}
      markRecords={serializedStudent.markRecords}
      role={role}
      availableYears={availableYears}
      defaultYear={currentAcademicYear}
    />
  );
}
