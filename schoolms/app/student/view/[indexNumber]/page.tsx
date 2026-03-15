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
      markRecords: {
        orderBy: [{ year: "desc" }, { term: "asc" }],
      },
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

  // ── Filter mark records to only show PUBLISHED marks ──
  // Fetch all published releases for this student's class
  const publishedReleases = await prisma.marksRelease.findMany({
    where: { classId: student.classId, status: "PUBLISHED" },
    select: { term: true, year: true, subject: true, electiveName: true },
  });

  // Build lookup: "TERM_1::2026" → { classLevel: boolean; subjects: Set<"science::"> | Set<"categoryI::Tamil"> }
  const releaseMap = new Map<string, { classLevel: boolean; subjects: Set<string> }>();
  for (const r of publishedReleases) {
    const k = `${r.term}::${r.year}`;
    if (!releaseMap.has(k)) releaseMap.set(k, { classLevel: false, subjects: new Set() });
    const entry = releaseMap.get(k)!;
    if (r.subject === null) {
      entry.classLevel = true;
    } else {
      entry.subjects.add(`${r.subject}::${r.electiveName ?? ""}`);
    }
  }

  const allSubjectKeys = ["sinhala", "buddhism", "maths", "science", "english", "history", "categoryI", "categoryII", "categoryIII"];
  const electives = student.electives as { categoryI?: string; categoryII?: string; categoryIII?: string } | null;

  const filteredMarkRecords = student.markRecords
    .map((record) => {
      const k = `${record.term}::${record.year}`;
      const rel = releaseMap.get(k);
      if (!rel) return null; // no releases for this term/year — hide entirely

      if (rel.classLevel) return record; // entire term published — show all

      // Per-subject masking: only expose marks for released subjects
      const maskedMarks: Record<string, number | null> = {};
      let hasAnyReleased = false;

      for (const key of allSubjectKeys) {
        const electiveName =
          key === "categoryI" ? (electives?.categoryI ?? "")
          : key === "categoryII" ? (electives?.categoryII ?? "")
          : key === "categoryIII" ? (electives?.categoryIII ?? "")
          : "";
        const subjectKey = `${key}::${electiveName}`;
        const rawValue = (record.marks as Record<string, unknown> | null)?.[key];
        if (rel.subjects.has(subjectKey)) {
          maskedMarks[key] = typeof rawValue === "number" ? rawValue : null;
          hasAnyReleased = true;
        } else {
          maskedMarks[key] = null;
        }
      }

      if (!hasAnyReleased) return null;
      return { ...record, marks: maskedMarks };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Serialize for client components
  const serializedStudent = JSON.parse(JSON.stringify(student));
  const serializedMarkRecords = JSON.parse(JSON.stringify(filteredMarkRecords));

  // Compute available years from published mark records only
  const yearsFromRecords = Array.from(
    new Set(serializedMarkRecords.map((r: { year: number }) => r.year)),
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
          markRecords={serializedMarkRecords}
          role={Role.STAFF}
          availableYears={availableYears}
          defaultYear={currentAcademicYear}
          publicMode={true}
        />
      </div>
    </div>
  );
}

