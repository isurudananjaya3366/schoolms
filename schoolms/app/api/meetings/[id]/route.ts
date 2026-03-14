import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createNotification, NOTIF } from "@/lib/notifications";

const UpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  classGroup: z.string().min(1).max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
});

/** PUT /api/meetings/[id] - update meeting (ADMIN+) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const merged = {
    classGroup: parsed.data.classGroup ?? existing.classGroup,
    date: parsed.data.date ?? existing.date,
    startTime: parsed.data.startTime ?? existing.startTime,
    endTime: "endTime" in parsed.data ? parsed.data.endTime ?? null : existing.endTime,
  };

  // Conflict detection excluding the current meeting
  const conflicts = await detectConflicts(
    merged.classGroup,
    merged.date,
    merged.startTime,
    merged.endTime,
    id
  );

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

  const updated = await prisma.meeting.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.classGroup !== undefined && { classGroup: parsed.data.classGroup }),
      ...(parsed.data.date !== undefined && { date: parsed.data.date }),
      ...(parsed.data.startTime !== undefined && { startTime: parsed.data.startTime }),
      ...("endTime" in parsed.data && { endTime: parsed.data.endTime ?? null }),
      ...("description" in parsed.data && { description: parsed.data.description ?? null }),
    },
  });

  createNotification({
    type: NOTIF.MEETING_UPDATED,
    title: "Meeting Updated",
    message: `${authResult.name ?? "Admin"} updated meeting "${updated.title}" (${updated.date} at ${updated.startTime}, Class: ${updated.classGroup}).`,
    createdBy: authResult.name ?? authResult.email,
    data: { meetingId: id, title: updated.title, classGroup: updated.classGroup, date: updated.date },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/meetings/[id] - delete meeting (ADMIN+) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  await prisma.meeting.delete({ where: { id } });

  createNotification({
    type: NOTIF.MEETING_CANCELLED,
    title: "Meeting Cancelled",
    message: `${authResult.name ?? "Admin"} cancelled meeting "${existing.title}" (${existing.date} at ${existing.startTime}, Class: ${existing.classGroup}).`,
    createdBy: authResult.name ?? authResult.email,
    data: { meetingId: id, title: existing.title, classGroup: existing.classGroup, date: existing.date },
  });

  return NextResponse.json({ success: true });
}

// ── Conflict detection ────────────────────────────────────────────
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
