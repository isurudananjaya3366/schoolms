import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;

    // Verify the class group exists
    const classGroup = await prisma.classGroup.findUnique({
      where: { id },
    });
    if (!classGroup) {
      return NextResponse.json(
        { error: "Class group not found" },
        { status: 404 }
      );
    }

    // Check if any students are enrolled
    const studentCount = await prisma.student.count({
      where: { classId: id },
    });
    if (studentCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete class group with ${studentCount} enrolled student${studentCount !== 1 ? "s" : ""}`,
        },
        { status: 400 }
      );
    }

    await prisma.classGroup.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/class-groups/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
