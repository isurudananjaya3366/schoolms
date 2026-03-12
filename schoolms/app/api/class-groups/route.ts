import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const gradeParam = searchParams.get("grade");

    const where: Record<string, unknown> = {};
    if (gradeParam) {
      const grade = parseInt(gradeParam, 10);
      if (isNaN(grade)) {
        return NextResponse.json({ error: "Invalid grade parameter" }, { status: 400 });
      }
      where.grade = grade;
    }

    const classGroups = await prisma.classGroup.findMany({
      where,
      orderBy: [{ grade: "asc" }, { section: "asc" }],
      include: { _count: { select: { students: true } } },
    });

    return NextResponse.json(classGroups);
  } catch (error) {
    console.error("GET /api/class-groups error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const postSchema = z.object({
  grade: z.number().int().min(6).max(11),
  section: z.enum(["A", "B", "C", "D", "E", "F"]),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { grade, section } = parsed.data;

    // Check for duplicate
    const existing = await prisma.classGroup.findFirst({
      where: { grade, section },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Class group Grade ${grade} Section ${section} already exists` },
        { status: 409 }
      );
    }

    const created = await prisma.classGroup.create({
      data: { grade, section },
      include: { _count: { select: { students: true } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/class-groups error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
