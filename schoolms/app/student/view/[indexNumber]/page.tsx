import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ indexNumber: string }>;
}) {
  const { indexNumber } = await params;
  return { title: `Student ${indexNumber} | SchoolMS` };
}

const TERM_LABELS: Record<string, string> = {
  TERM_1: "Term 1",
  TERM_2: "Term 2",
  TERM_3: "Term 3",
};

const SUBJECT_LABELS: Record<string, string> = {
  sinhala: "Sinhala",
  buddhism: "Buddhism",
  maths: "Mathematics",
  science: "Science",
  english: "English",
  history: "History",
  categoryI: "Elective I",
  categoryII: "Elective II",
  categoryIII: "Elective III",
};

function total(marks: Record<string, number | null | undefined>): number {
  return Object.values(marks).reduce<number>(
    (acc, v) => acc + (typeof v === "number" ? v : 0),
    0
  );
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
      class: { select: { grade: true, section: true } },
      markRecords: {
        orderBy: [{ year: "desc" }, { term: "asc" }],
      },
    },
  });

  if (!student) notFound();

  type MarkRec = (typeof student.markRecords)[number];

  // Group marks by year
  const byYear = student.markRecords.reduce<Record<number, MarkRec[]>>(
    (acc: Record<number, MarkRec[]>, r: MarkRec) => {
      if (!acc[r.year]) acc[r.year] = [];
      acc[r.year].push(r);
      return acc;
    },
    {}
  );

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Back link */}
        <Link
          href="/student"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        {/* Student header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{student.name}</CardTitle>
                <CardDescription>
                  Grade {student.class.grade}
                  {student.class.section}
                  {student.indexNumber && ` · Index: ${student.indexNumber}`}
                </CardDescription>
              </div>
              <Badge variant="secondary">
                Grade {student.class.grade}
                {student.class.section}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Marks by year */}
        {years.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No mark records available yet.
            </CardContent>
          </Card>
        ) : (
          years.map((year) => (
            <Card key={year}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{year}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-35">Subject</TableHead>
                        {byYear[year].map((r) => (
                          <TableHead key={r.id} className="text-center">
                            {TERM_LABELS[r.term] ?? r.term}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(SUBJECT_LABELS).map((subj) => (
                        <TableRow key={subj}>
                          <TableCell className="font-medium text-sm">
                            {SUBJECT_LABELS[subj]}
                          </TableCell>
                          {byYear[year].map((r) => {
                            const val =
                              r.marks[subj as keyof typeof r.marks];
                            return (
                              <TableCell
                                key={r.id}
                                className="text-center text-sm"
                              >
                                {val != null ? val : "—"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {/* Total row */}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>Total</TableCell>
                        {byYear[year].map((r) => (
                          <TableCell key={r.id} className="text-center">
                            {total(r.marks as Record<string, number | null>)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
