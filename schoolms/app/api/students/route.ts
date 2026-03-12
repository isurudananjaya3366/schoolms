import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { STUDENT_CREATED } from "@/lib/audit-actions";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  grade: z.coerce.number().int().min(6).max(11).optional(),
  classId: z.string().optional(),
  classSection: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["name", "indexNumber", "grade", "createdAt"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, limit, grade, classId, classSection, search, sort, order } =
      parsed.data;

    // Build where clause
    const where: Record<string, unknown> = { isDeleted: false };

    if (grade !== undefined) {
      where.class = { ...((where.class as object) ?? {}), grade };
    }

    if (classId) {
      where.classId = classId;
    }

    if (classSection) {
      where.class = { ...((where.class as object) ?? {}), section: classSection };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { indexNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build orderBy
    let orderBy: Record<string, unknown>;
    if (sort === "grade") {
      orderBy = { class: { grade: order } };
    } else {
      orderBy = { [sort]: order };
    }

    const skip = (page - 1) * limit;

    const [data, totalCount] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { class: true },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST handler - Create a new student
export async function POST(request: Request) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();

    const schema = z.object({
      name: z.string().trim().min(2).max(100),
      indexNumber: z.string().trim().regex(/^[A-Za-z0-9]{2,20}$/).nullable().optional(),
      classId: z.string().min(1),
      electives: z.object({
        categoryI: z.string().max(100).default(""),
        categoryII: z.string().max(100).default(""),
        categoryIII: z.string().max(100).default(""),
      }),
      scholarshipMarks: z.number().int().min(0).max(200),
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

    const { name, indexNumber, classId, electives, scholarshipMarks } = parsed.data;

    // Verify classId
    const classGroup = await prisma.classGroup.findUnique({
      where: { id: classId },
    });
    if (!classGroup) {
      return NextResponse.json(
        { error: "Invalid class selected", fields: { classId: "Class not found" } },
        { status: 400 }
      );
    }

    // Check index number uniqueness (only if provided)
    if (indexNumber) {
      const existingStudent = await prisma.student.findFirst({
        where: { indexNumber, isDeleted: false },
      });
      if (existingStudent) {
        return NextResponse.json(
          {
            error: "Index number already in use",
            fields: { indexNumber: "This index number is already assigned to another student" },
          },
          { status: 400 }
        );
      }
    }

    // Create student
    const newStudent = await prisma.student.create({
      data: {
        name,
        indexNumber: indexNumber || null,
        classId,
        electives: {
          categoryI: electives.categoryI,
          categoryII: electives.categoryII,
          categoryIII: electives.categoryIII,
        },
        scholarshipMarks,
        isDeleted: false,
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
          action: STUDENT_CREATED,
          targetId: newStudent.id,
          targetType: "STUDENT",
          ipAddress: ip,
          details: JSON.stringify({
            name: newStudent.name,
            indexNumber: newStudent.indexNumber,
            grade: classGroup.grade,
            classSection: classGroup.section,
            targetName: newStudent.name,
          }),
        },
      })
      .catch(console.error);

    return NextResponse.json(newStudent, { status: 201 });
  } catch (err) {
    console.error("POST /api/students error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
