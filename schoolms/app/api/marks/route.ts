import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { MARK_UPDATED } from "@/lib/audit-actions";
import { createNotification, NOTIF } from "@/lib/notifications";
import { queryParamsSchema, singleMarkBodySchema } from "@/lib/validators/marks";
import { Term } from "@prisma/client";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const rawParams = {
      studentId: searchParams.get("studentId") || undefined,
      classId: searchParams.get("classId") || undefined,
      term: searchParams.get("term") || undefined,
      year: searchParams.get("year") || undefined,
    };

    const parsed = queryParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentId, classId, term, year } = parsed.data;

    // Require at least studentId or classId
    if (!studentId && !classId) {
      return NextResponse.json(
        { error: "At least one of studentId or classId is required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    if (studentId) where.studentId = studentId;
    if (term) where.term = term;
    if (year) where.year = year;

    // If classId provided, find student IDs in that class first
    if (classId && !studentId) {
      const students = await prisma.student.findMany({
        where: { classId, isDeleted: false },
        select: { id: true },
      });
      const studentIds = students.map(s => s.id);
      where.studentId = { in: studentIds };
    }

    // If no year specified, default to current academic year
    if (!year) {
      const config = await prisma.systemConfig.findUnique({
        where: { key: "academic_year" },
      });
      if (config) {
        where.year = parseInt(config.value, 10);
      }
    }

    const records = await prisma.markRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("GET /api/marks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const parsed = singleMarkBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { studentId, year, term, marks } = parsed.data;

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student || student.isDeleted) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Pre-check for audit logging
    const oldRecord = await prisma.markRecord.findUnique({
      where: {
        studentId_term_year: { studentId, term: term as Term, year },
      },
    });

    // Upsert
    const record = await prisma.markRecord.upsert({
      where: {
        studentId_term_year: { studentId, term: term as Term, year },
      },
      create: {
        studentId,
        term: term as Term,
        year,
        marks,
        updatedBy: authResult.id,
      },
      update: {
        marks,
        updatedBy: authResult.id,
      },
    });

    // Audit log
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    await prisma.auditLog
      .create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name || "Unknown",
          action: MARK_UPDATED,
          targetId: studentId,
          targetType: "STUDENT",
          ipAddress: ip,
          details: JSON.stringify({
            subject: "all",
            term,
            year,
            oldValue: oldRecord?.marks || null,
            newValue: marks,
          }),
        },
      })
      .catch(console.error);

    createNotification({
      type: NOTIF.MARK_UPDATED,
      title: "Marks Updated",
      message: `${authResult.name ?? "Staff"} updated marks for a student (${term}, ${year}).`,
      createdBy: authResult.name ?? authResult.email,
      data: { studentId, term, year },
    });

    return NextResponse.json(record, { status: oldRecord ? 200 : 201 });
  } catch (error) {
    console.error("POST /api/marks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
