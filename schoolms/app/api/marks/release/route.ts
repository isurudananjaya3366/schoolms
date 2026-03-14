import { NextResponse, NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { Term, MarksStatus, Role } from "@prisma/client";

// Roles that can access release management
const ALLOWED_ROLES: Role[] = [Role.TEACHER, Role.STAFF, Role.ADMIN, Role.SUPERADMIN];

export async function GET(request: NextRequest) {
  const authResult = await requireRole(ALLOWED_ROLES);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId") || undefined;
  const term = searchParams.get("term") as Term | undefined;
  const yearStr = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (classId) where.classId = classId;
  if (term) where.term = term;
  if (yearStr) where.year = parseInt(yearStr, 10);

  // TEACHER: restrict to their assigned class only
  if (user.role === "TEACHER") {
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { assignedClassId: true },
    });
    if (!userRecord?.assignedClassId) {
      return NextResponse.json([], { status: 200 });
    }
    where.classId = userRecord.assignedClassId;
  }

  try {
    const releases = await prisma.marksRelease.findMany({
      where,
      orderBy: [{ year: "desc" }, { term: "asc" }],
    });
    return NextResponse.json(releases);
  } catch (error) {
    console.error("GET /api/marks/release error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  // STAFF cannot change release status; TEACHER (assigned class only), ADMIN, SUPERADMIN can
  const authResult = await requireRole([Role.TEACHER, Role.ADMIN, Role.SUPERADMIN]);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    const body = await request.json();
    const { classId, term, year, status } = body as {
      classId?: string;
      term?: string;
      year?: number;
      status?: string;
    };

    if (!classId || !term || year === undefined || !status) {
      return NextResponse.json({ error: "classId, term, year, status are required" }, { status: 400 });
    }

    if (!["DRAFT", "PUBLISHED"].includes(status)) {
      return NextResponse.json({ error: "status must be DRAFT or PUBLISHED" }, { status: 400 });
    }

    if (!Object.values(Term).includes(term as Term)) {
      return NextResponse.json({ error: "Invalid term" }, { status: 400 });
    }

    // TEACHER: can only manage their assigned class
    if (user.role === "TEACHER") {
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { assignedClassId: true },
      });
      if (!userRecord?.assignedClassId || userRecord.assignedClassId !== classId) {
        return NextResponse.json(
          { error: "You can only manage marks for your assigned class" },
          { status: 403 }
        );
      }
    }

    const release = await prisma.marksRelease.upsert({
      where: {
        classId_term_year: {
          classId,
          term: term as Term,
          year: Number(year),
        },
      },
      create: {
        classId,
        term: term as Term,
        year: Number(year),
        status: status as MarksStatus,
        changedBy: user.id,
        changedAt: new Date(),
      },
      update: {
        status: status as MarksStatus,
        changedBy: user.id,
        changedAt: new Date(),
      },
    });

    return NextResponse.json(release);
  } catch (error) {
    console.error("PATCH /api/marks/release error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
