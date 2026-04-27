import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const TERM_ORDER = ["TERM_1", "TERM_2", "TERM_3"];

export async function GET(req: NextRequest) {
  const check = await requireAuth(Role.STAFF);
  if (check instanceof NextResponse) return check;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const yearParam = searchParams.get("year");

  if (!classId || !yearParam) {
    return NextResponse.json({ error: "classId and year are required" }, { status: 400 });
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  // Find distinct terms recorded for any non-deleted student in this class for the given year
  const students = await prisma.student.findMany({
    where: { classId, isDeleted: false },
    select: {
      markRecords: {
        where: { year },
        select: { term: true },
      },
    },
  });

  const termSet = new Set<string>();
  for (const student of students) {
    for (const record of student.markRecords) {
      termSet.add(record.term);
    }
  }

  const terms = TERM_ORDER.filter((t) => termSet.has(t));
  return NextResponse.json({ terms });
}
