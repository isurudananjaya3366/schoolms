import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  classId: z.string().min(1),
  teacherId: z.string().nullable(),
});

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { classId, teacherId } = parsed.data;

    // Verify class exists
    const classGroup = await prisma.classGroup.findUnique({ where: { id: classId } });
    if (!classGroup) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    // Clear any existing teacher assigned to this class
    await prisma.user.updateMany({
      where: { assignedClassId: classId, role: Role.TEACHER },
      data: { assignedClassId: null },
    });

    // Assign new teacher (if provided)
    if (teacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        select: { id: true, role: true },
      });
      if (!teacher || teacher.role !== Role.TEACHER) {
        return NextResponse.json({ error: "User is not a teacher." }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: teacherId },
        data: { assignedClassId: classId },
      });
    }

    return NextResponse.json({ success: true, classId, teacherId });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
