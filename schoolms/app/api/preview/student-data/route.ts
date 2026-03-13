import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { buildPreviewData } from "@/lib/preview-data";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const check = await requireAuth(Role.STAFF);
  if (check instanceof NextResponse) return check;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const yearParam = searchParams.get("year");

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  const year = yearParam ? parseInt(yearParam, 10) : undefined;
  if (yearParam && (isNaN(year!) || year! < 2000 || year! > 2100)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const focusTerm = searchParams.get("focusTerm") ?? undefined;

  const data = await buildPreviewData(studentId, year, focusTerm);
  if (!data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
