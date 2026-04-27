import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { format } from "date-fns";

const querySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  userId: z.string().optional(),
  actionTypes: z.string().optional(),
  search: z.string().optional(),
});

function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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

    const { fromDate, toDate, userId, actionTypes, search } = parsed.data;

    // Build dynamic where clause (same logic as list API)
    const conditions: Record<string, unknown>[] = [];

    if (fromDate) {
      conditions.push({ timestamp: { gte: new Date(fromDate) } });
    }
    if (toDate) {
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

    const where = conditions.length > 0 ? { AND: conditions } : {};

    // CSV header
    const header = [
      "ID",
      "Timestamp",
      "User",
      "Action",
      "Target Type",
      "Target ID",
      "IP Address",
      "Details",
    ].join(",");

    const csvRows: string[] = [header];

    // Batch retrieval in 500-entry chunks
    const BATCH_SIZE = 500;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: BATCH_SIZE,
      });

      for (const entry of batch) {
        const row = [
          escapeCsvField(entry.id),
          escapeCsvField(
            format(new Date(entry.timestamp), "yyyy-MM-dd HH:mm:ss")
          ),
          escapeCsvField(entry.userDisplayName),
          escapeCsvField(entry.action),
          escapeCsvField(entry.targetType ?? ""),
          escapeCsvField(entry.targetId ?? ""),
          escapeCsvField(entry.ipAddress ?? ""),
          escapeCsvField(entry.details),
        ].join(",");
        csvRows.push(row);
      }

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        skip += BATCH_SIZE;
      }
    }

    const csvContent = csvRows.join("\n");
    const today = format(new Date(), "yyyy-MM-dd");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-log-${today}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/audit-log/export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
