import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { MARK_UPDATED } from "@/lib/audit-actions";
import { batchUpsertBodySchema } from "@/lib/validators/marks";
import { Term } from "@prisma/client";

export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const parsed = batchUpsertBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { classId, term, year, subject, entries } = parsed.data;

    // Get all students in the class for membership validation
    const classStudents = await prisma.student.findMany({
      where: { classId, isDeleted: false },
      select: { id: true },
    });
    const classStudentIds = new Set(classStudents.map(s => s.id));

    // Separate valid vs invalid entries
    const validEntries: typeof entries = [];
    const failed: { studentId: string; reason: string }[] = [];

    for (const entry of entries) {
      if (!classStudentIds.has(entry.studentId)) {
        failed.push({ studentId: entry.studentId, reason: "Student not found in class" });
      } else {
        validEntries.push(entry);
      }
    }

    if (validEntries.length === 0) {
      return NextResponse.json({ succeeded: [], failed }, { status: 400 });
    }

    // Pre-fetch existing records for audit comparison
    const existingRecords = await prisma.markRecord.findMany({
      where: {
        studentId: { in: validEntries.map(e => e.studentId) },
        term: term as Term,
        year,
      },
    });
    const existingMap = new Map(existingRecords.map(r => [r.studentId, r]));

    // Build upsert operations
    const upsertOps = validEntries.map(entry => {
      const existing = existingMap.get(entry.studentId);

      // Build the full marks object for create (all nulls except this subject)
      const createMarks: Record<string, number | null> = {
        sinhala: null, buddhism: null, maths: null, science: null,
        english: null, history: null, categoryI: null, categoryII: null, categoryIII: null,
      };
      createMarks[subject] = entry.markValue;

      // For update, spread existing marks and override just this subject
      const updateMarks: Record<string, number | null> = existing
        ? { ...(existing.marks as Record<string, number | null>) }
        : { ...createMarks };
      updateMarks[subject] = entry.markValue;

      return prisma.markRecord.upsert({
        where: {
          studentId_term_year: {
            studentId: entry.studentId,
            term: term as Term,
            year,
          },
        },
        create: {
          studentId: entry.studentId,
          term: term as Term,
          year,
          marks: createMarks,
          updatedBy: authResult.id,
        },
        update: {
          marks: updateMarks,
          updatedBy: authResult.id,
        },
      });
    });

    // Execute as transaction
    const results = await prisma.$transaction(upsertOps);

    const succeeded = results.map(r => r.studentId);

    // Write audit logs for changed entries only
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const auditPromises = validEntries
      .filter(entry => {
        const existing = existingMap.get(entry.studentId);
        const oldValue = existing
          ? (existing.marks as Record<string, number | null>)[subject]
          : null;
        return oldValue !== entry.markValue;
      })
      .map(entry => {
        const existing = existingMap.get(entry.studentId);
        const oldValue = existing
          ? (existing.marks as Record<string, number | null>)[subject]
          : null;

        return prisma.auditLog.create({
          data: {
            userId: authResult.id,
            userDisplayName: authResult.name || "Unknown",
            action: MARK_UPDATED,
            targetId: entry.studentId,
            targetType: "STUDENT",
            ipAddress: ip,
            details: JSON.stringify({
              subject,
              term,
              year,
              classId,
              oldValue,
              newValue: entry.markValue,
            }),
          },
        });
      });

    await Promise.allSettled(auditPromises);

    const statusCode = failed.length === 0 ? 200 : 207;
    return NextResponse.json({ succeeded, failed }, { status: statusCode });
  } catch (error) {
    console.error("PATCH /api/marks/batch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
