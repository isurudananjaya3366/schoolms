import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role, TeacherAssignmentType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

const assignmentItemSchema = z.object({
  teacherId: z.string().min(1),
  type: z.nativeEnum(TeacherAssignmentType),
  subject: z.string().min(1).nullable().optional(),
  electiveName: z.string().min(1).nullable().optional(),
});

const putBodySchema = z.object({
  classId: z.string().min(1),
  assignments: z.array(assignmentItemSchema),
});

/**
 * GET /api/teachers/assign?classId=...
 * Returns all TeacherAssignment records for the given class.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    if (!classId) {
      return NextResponse.json({ error: "classId is required." }, { status: 400 });
    }

    const assignments = await prisma.teacherAssignment.findMany({ where: { classId } });
    return NextResponse.json(assignments);
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * PUT /api/teachers/assign
 * Replaces ALL assignments for a class with the provided list.
 * Body: { classId: string; assignments: AssignmentItem[] }
 */
export async function PUT(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = putBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { classId, assignments } = parsed.data;

    // Verify class exists
    const classGroup = await prisma.classGroup.findUnique({ where: { id: classId } });
    if (!classGroup) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    // Validate all teacher IDs and assignment rules
    const teacherIds = assignments.map((a) => a.teacherId);
    const teachers = await prisma.user.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, role: true },
    });
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));

    // Validate assignment-level rules
    for (const a of assignments) {
      const teacher = teacherMap.get(a.teacherId);
      if (!teacher || teacher.role !== Role.TEACHER) {
        return NextResponse.json(
          { error: `User ${a.teacherId} is not a teacher.` },
          { status: 400 }
        );
      }
      if (a.type === TeacherAssignmentType.SUBJECT && !a.subject) {
        return NextResponse.json(
          { error: "SUBJECT assignments must include a subject field." },
          { status: 400 }
        );
      }
      if (a.type !== TeacherAssignmentType.SUBJECT && a.subject) {
        return NextResponse.json(
          { error: "Only SUBJECT assignments may have a subject field." },
          { status: 400 }
        );
      }
    }

    // Only one MAIN teacher per class
    const mainCount = assignments.filter((a) => a.type === TeacherAssignmentType.MAIN).length;
    if (mainCount > 1) {
      return NextResponse.json(
        { error: "Only one main teacher can be assigned per class." },
        { status: 400 }
      );
    }

    // Only one teacher per (subject, electiveName) slot
    const subjectSlotSeen = new Set<string>();
    for (const a of assignments) {
      if (a.type === TeacherAssignmentType.SUBJECT) {
        const slotKey = `${a.subject}::${a.electiveName ?? ""}`;
        if (subjectSlotSeen.has(slotKey)) {
          return NextResponse.json(
            { error: `Only one teacher can be assigned to subject slot "${a.subject}".` },
            { status: 400 }
          );
        }
        subjectSlotSeen.add(slotKey);
      }
    }

    // Replace all existing assignments for this class
    await prisma.teacherAssignment.deleteMany({ where: { classId } });

    if (assignments.length > 0) {
      await prisma.teacherAssignment.createMany({
        data: assignments.map((a) => ({
          classId,
          teacherId: a.teacherId,
          type: a.type,
          subject: a.subject ?? null,
          electiveName: a.electiveName ?? null,
        })),
      });
    }

    return NextResponse.json({ success: true, classId, count: assignments.length });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
