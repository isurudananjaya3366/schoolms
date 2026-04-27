import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { STUDENT_DELETED, STUDENT_UPDATED } from "@/lib/audit-actions";
import { createNotification, NOTIF } from "@/lib/notifications";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: true,
        markRecords: true,
      },
    });

    if (!student || student.isDeleted) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("GET /api/students/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student || student.isDeleted) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    await prisma.student.update({
      where: { id },
      data: { isDeleted: true },
    });

    createNotification({
      type: NOTIF.STUDENT_DELETED,
      title: "Student Removed",
      message: `${authResult.name ?? "Admin"} removed ${student.name} from the system.`,
      createdBy: authResult.name ?? authResult.email,
      data: { studentId: student.id, studentName: student.name },
    });

    await prisma.auditLog.create({
      data: {
        userId: authResult.id,
        userDisplayName: authResult.name ?? authResult.email,
        action: STUDENT_DELETED,
        targetId: student.id,
        targetType: "Student",
        details: `Soft-deleted student "${student.name}" (Index: ${student.indexNumber})`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Student removed successfully",
    });
  } catch (error) {
    console.error("DELETE /api/students/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH handler - Update a student
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();

    const schema = z.object({
      name: z.string().trim().min(2).max(100).optional(),
      indexNumber: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9]{2,20}$/)
        .nullable()
        .optional(),
      classId: z.string().min(1).optional(),
      electives: z
        .object({
          categoryI: z.string().max(100).optional(),
          categoryII: z.string().max(100).optional(),
          categoryIII: z.string().max(100).optional(),
        })
        .optional(),
      scholarshipMarks: z.number().int().min(0).max(200).nullable().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = issue.message;
      }
      return NextResponse.json(
        { error: "Validation failed", fields },
        { status: 400 }
      );
    }

    // Fetch current student
    const currentStudent = await prisma.student.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!currentStudent || currentStudent.isDeleted) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const { name, indexNumber, classId, electives, scholarshipMarks } = parsed.data;

    // If indexNumber changed, check uniqueness excluding self
    if (indexNumber && indexNumber !== currentStudent.indexNumber) {
      const existingStudent = await prisma.student.findFirst({
        where: { indexNumber, isDeleted: false, id: { not: id } },
      });
      if (existingStudent) {
        return NextResponse.json(
          {
            error: "Index number already in use",
            fields: {
              indexNumber:
                "This index number is already assigned to another student",
            },
          },
          { status: 400 }
        );
      }
    }

    // If classId changed, verify ClassGroup exists
    let newClassGroup = currentStudent.class;
    if (classId && classId !== currentStudent.classId) {
      const classGroup = await prisma.classGroup.findUnique({
        where: { id: classId },
      });
      if (!classGroup) {
        return NextResponse.json(
          {
            error: "Invalid class selected",
            fields: { classId: "Class not found" },
          },
          { status: 400 }
        );
      }
      newClassGroup = classGroup;
    }

    // Merge electives: spread existing, overlay submitted
    const mergedElectives = {
      categoryI: electives?.categoryI ?? currentStudent.electives.categoryI,
      categoryII: electives?.categoryII ?? currentStudent.electives.categoryII,
      categoryIII:
        electives?.categoryIII ?? currentStudent.electives.categoryIII,
    };

    // Track changed fields
    const changedFields: string[] = [];
    const newValues: Record<string, unknown> = {};

    if (name && name !== currentStudent.name) {
      changedFields.push("name");
      newValues.name = name;
    }
    if (indexNumber && indexNumber !== currentStudent.indexNumber) {
      changedFields.push("indexNumber");
      newValues.indexNumber = indexNumber;
    }
    if (classId && classId !== currentStudent.classId) {
      changedFields.push("classId");
      newValues.classId = classId;
      newValues.grade = newClassGroup.grade;
      newValues.classSection = newClassGroup.section;
    }
    if (
      mergedElectives.categoryI !== currentStudent.electives.categoryI ||
      mergedElectives.categoryII !== currentStudent.electives.categoryII ||
      mergedElectives.categoryIII !== currentStudent.electives.categoryIII
    ) {
      changedFields.push("electives");
      newValues.electives = mergedElectives;
    }
    if (scholarshipMarks !== undefined && scholarshipMarks !== currentStudent.scholarshipMarks) {
      changedFields.push("scholarshipMarks");
      newValues.scholarshipMarks = scholarshipMarks;
    }

    // Update student
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(indexNumber !== undefined ? { indexNumber: indexNumber || null } : {}),
        ...(classId ? { classId } : {}),
        electives: mergedElectives,
        ...(scholarshipMarks !== undefined ? { scholarshipMarks } : {}),
      },
      include: { class: true },
    });

    // Audit log
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    await prisma.auditLog
      .create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name,
          action: STUDENT_UPDATED,
          targetId: updatedStudent.id,
          targetType: "STUDENT",
          ipAddress: ip,
          details: JSON.stringify({
            targetName: updatedStudent.name,
            changedFields,
            newValues,
          }),
        },
      })
      .catch(console.error);

    createNotification({
      type: NOTIF.STUDENT_UPDATED,
      title: "Student Profile Updated",
      message: `${authResult.name ?? "Admin"} updated ${updatedStudent.name}'s profile.`,
      createdBy: authResult.name ?? authResult.email,
      data: { studentId: updatedStudent.id, studentName: updatedStudent.name, changedFields },
    });

    return NextResponse.json(updatedStudent);
  } catch (error) {
    console.error("PATCH /api/students/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
