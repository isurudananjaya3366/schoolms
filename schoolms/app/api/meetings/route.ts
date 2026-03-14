import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

const MeetingSchema = z.object({
  title: z.string().min(1).max(200),
  classGroup: z.string().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
});

/** GET /api/meetings?month=YYYY-MM  — returns all meetings in given month */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // "YYYY-MM"

  let dateFilter: object = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    dateFilter = {
      date: { gte: `${month}-01`, lte: `${month}-31` },
    };
  }

  const meetings = await prisma.meeting.findMany({
    where: dateFilter,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(meetings);
}

/** POST /api/meetings — create a meeting (ADMIN+) */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { title, classGroup, date, startTime, endTime, description } = parsed.data;

  // Conflict detection: same classGroup, same date, overlapping time
  const conflicts = await detectConflicts(classGroup, date, startTime, endTime ?? null, null);
  if (conflicts.length > 0) {
    return NextResponse.json(
      {
        error: "Time conflict",
        conflicts: conflicts.map((c) => ({
          id: c.id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
        })),
      },
      { status: 409 }
    );
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      classGroup,
      date,
      startTime,
      endTime: endTime ?? null,
      description: description ?? null,
      createdBy: authResult.name ?? authResult.email,
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}

// ── Shared conflict helper ───────────────────────────────────────
/**
 * Returns meetings that overlap the given time range for the same classGroup on the same date.
 * Excludes `excludeId` when updating.
 */
async function detectConflicts(
  classGroup: string,
  date: string,
  startTime: string,
  endTime: string | null,
  excludeId: string | null
) {
  const same = await prisma.meeting.findMany({
    where: {
      classGroup,
      date,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });

  return same.filter((m) => timesOverlap(m.startTime, m.endTime, startTime, endTime));
}

function timesOverlap(
  existStart: string,
  existEnd: string | null,
  newStart: string,
  newEnd: string | null
): boolean {
  // A meeting with no endTime is treated as a point-in-time event lasting 30 min
  const resolvedExistEnd = existEnd ?? addMinutes(existStart, 30);
  const resolvedNewEnd = newEnd ?? addMinutes(newStart, 30);

  return newStart < resolvedExistEnd && resolvedNewEnd > existStart;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
