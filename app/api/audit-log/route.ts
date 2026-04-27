import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  userId: z.string().optional(),
  actionTypes: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(Role.SUPERADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters." },
        { status: 400 }
      );
    }

    const { page, limit, fromDate, toDate, userId, actionTypes, search } =
      parsed.data;
    const skip = (page - 1) * limit;

    // Build dynamic where clause
    const conditions: Record<string, unknown>[] = [];

    if (fromDate) {
      conditions.push({ timestamp: { gte: new Date(fromDate) } });
    }
    if (toDate) {
      // Include the entire end day
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      conditions.push({ timestamp: { lte: endDate } });
    }
    if (userId) {
      conditions.push({ userId });
    }
    if (actionTypes) {
      const actionTypesArray = actionTypes
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      if (actionTypesArray.length > 0) {
        conditions.push({ action: { in: actionTypesArray } });
      }
    }
    if (search) {
      conditions.push({
        OR: [
          { userDisplayName: { contains: search, mode: "insensitive" } },
          { details: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where =
      conditions.length > 0 ? { AND: conditions } : {};

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/audit-log error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
