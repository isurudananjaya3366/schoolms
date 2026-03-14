import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ indexNumber: string }> }
) {
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

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  return NextResponse.json({ student });
}
