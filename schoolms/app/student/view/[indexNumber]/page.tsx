import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StudentProfileClient from "@/components/students/StudentProfileClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ indexNumber: string }>;
}) {
  const { indexNumber } = await params;
  const student = await prisma.student.findFirst({
    where: { indexNumber: { equals: indexNumber, mode: "insensitive" }, isDeleted: false },
    select: { name: true },
  });
  return { title: student ? `${student.name} | SchoolMS` : `Student ${indexNumber} | SchoolMS` };
}

export default async function StudentViewPage({
  params,
}: {
  params: Promise<{ indexNumber: string }>;
}) {
  const { indexNumber } = await params;

  const student = await prisma.student.findFirst({
    where: {
      indexNumber: { equals: indexNumber, mode: "insensitive" },
      isDeleted: false,
    },
    include: {
      class: true,
      markRecords: true,
    },
  });

  if (!student) notFound();

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
    new Set(serializedStudent.markRecords.map((r: { year: number }) => r.year)),
  ) as number[];

  if (!yearsFromRecords.includes(currentAcademicYear)) {
    yearsFromRecords.push(currentAcademicYear);
  }

  const availableYears = yearsFromRecords.sort((a: number, b: number) => b - a);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Back link */}
        <Link
          href="/student"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

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
          role={Role.STAFF}
          availableYears={availableYears}
          defaultYear={currentAcademicYear}
          publicMode={true}
        />
      </div>
    </div>
  );
}
