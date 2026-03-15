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

  // TEACHER: restrict to their assigned class only (via TeacherAssignment)
  if (user.role === "TEACHER") {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { teacherId: user.id },
      select: { classId: true },
    });
    if (!assignment?.classId) {
      return NextResponse.json([], { status: 200 });
    }
    where.classId = assignment.classId;
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
  const authResult = await requireRole([Role.TEACHER, Role.ADMIN, Role.SUPERADMIN]);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    const body = await request.json();
    const { classId, term, year, status, subject, electiveName } = body as {
      classId?: string;
      term?: string;
      year?: number;
      status?: string;
      // null/undefined = class-level; string = per-subject (e.g. "science", "categoryI")
      subject?: string | null;
      // Only for elective subjects (categoryI/II/III): the specific elective name
      electiveName?: string | null;
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

    const resolvedSubject = subject ?? null;
    const resolvedElective = electiveName ?? null;

    // TEACHER: validate via TeacherAssignment (not User.assignedClassId)
    if (user.role === "TEACHER") {
      const assignments = await prisma.teacherAssignment.findMany({
        where: { teacherId: user.id, classId },
        select: { type: true, subject: true, electiveName: true },
      });

      if (assignments.length === 0) {
        return NextResponse.json(
          { error: "You are not assigned to this class" },
          { status: 403 }
        );
      }

      const hasMainRole = assignments.some(
        (a) => a.type === "MAIN" || a.type === "ADDITIONAL"
      );
      const subjectAssignments = assignments.filter((a) => a.type === "SUBJECT");

      if (resolvedSubject === null) {
        // Class-level release: only MAIN/ADDITIONAL teachers can do this
        if (!hasMainRole) {
          return NextResponse.json(
            { error: "Only the main class teacher can release all marks at once. Release your assigned subjects individually." },
            { status: 403 }
          );
        }
      } else {
        // Per-subject release: teacher must have this specific subject assignment
        const allowed = subjectAssignments.some(
          (a) =>
            a.subject === resolvedSubject &&
            (a.electiveName ?? null) === resolvedElective
        );
        if (!allowed) {
          return NextResponse.json(
            { error: "You can only release marks for your assigned subjects" },
            { status: 403 }
          );
        }
      }
    }

    const existing = await prisma.marksRelease.findFirst({
      where: {
        classId,
        term: term as Term,
        year: Number(year),
        subject: resolvedSubject,
        electiveName: resolvedElective,
      },
    });

    let release;
    if (existing) {
      release = await prisma.marksRelease.update({
        where: { id: existing.id },
        data: {
          status: status as MarksStatus,
          changedBy: user.id,
          changedAt: new Date(),
        },
      });
    } else {
      release = await prisma.marksRelease.create({
        data: {
          classId,
          term: term as Term,
          year: Number(year),
          subject: resolvedSubject,
          electiveName: resolvedElective,
          status: status as MarksStatus,
          changedBy: user.id,
          changedAt: new Date(),
        },
      });
    }

    return NextResponse.json(release);
  } catch (error) {
    console.error("PATCH /api/marks/release error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

