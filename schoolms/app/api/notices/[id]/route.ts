import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createNotification, NOTIF } from "@/lib/notifications";
import type { NotifiableRole } from "@/lib/notifications";

const UpdateNoticeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  targetRoles: z.array(z.string()).min(1).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

const ALL_NOTIFIABLE_ROLES: NotifiableRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "STAFF",
  "TEACHER",
];

/** GET /api/notices/[id] — get a single notice (auth required) */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const notice = await prisma.notice.findUnique({ where: { id } });
  if (!notice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(notice);
}

/** PUT /api/notices/[id] — update a notice (ADMIN+)
 *  When status changes to PUBLISHED, an in-app notification is emitted.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  const user = authResult;
  const { id } = await params;

  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateNoticeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { title, content, targetRoles, expiresAt, status } = parsed.data;

  const isPublishing =
    status === "PUBLISHED" && existing.status !== "PUBLISHED";

  const updated = await prisma.notice.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(targetRoles !== undefined && { targetRoles }),
      ...(expiresAt !== undefined && {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }),
      ...(status !== undefined && { status }),
      ...(isPublishing && { publishedAt: new Date() }),
    },
  });

  // When publishing, emit an in-app notification to the target roles
  if (isPublishing) {
    const noticeTargetRoles = updated.targetRoles;
    const notifRoles: NotifiableRole[] = noticeTargetRoles.includes("ALL")
      ? ALL_NOTIFIABLE_ROLES
      : (noticeTargetRoles.filter((r) =>
          ALL_NOTIFIABLE_ROLES.includes(r as NotifiableRole)
        ) as NotifiableRole[]);

    const preview =
      updated.content.length > 150
        ? updated.content.slice(0, 147) + "..."
        : updated.content;

    createNotification({
      type: NOTIF.NOTICE_PUBLISHED,
      title: updated.title,
      message: preview,
      targetRoles: notifRoles.length > 0 ? notifRoles : ALL_NOTIFIABLE_ROLES,
      data: { noticeId: id },
      createdBy: user.name,
    });
  }

  return NextResponse.json(updated);
}

/** DELETE /api/notices/[id] — delete a notice (ADMIN+) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.notice.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
