import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * GET /api/preview/available-years?classId=xxx
 *
 * Returns the distinct years for which mark records exist for students
 * in the given class, sorted descending.
 */
export async function GET(req: NextRequest) {
  const check = await requireAuth(Role.STAFF);
  if (check instanceof NextResponse) return check;

  const classId = new URL(req.url).searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  // Find all non-deleted students in this class
  const students = await prisma.student.findMany({
    where: { classId, isDeleted: false },
    select: { id: true },
  });

  if (students.length === 0) {
    return NextResponse.json({ years: [] });
  }

  const studentIds = students.map((s) => s.id);

  // Get distinct years from mark records for those students
  const rows = await prisma.markRecord.findMany({
    where: { studentId: { in: studentIds } },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });

  const years = rows.map((r) => r.year);
  return NextResponse.json({ years });
}
