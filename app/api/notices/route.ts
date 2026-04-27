import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

const NoticeSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required").max(5000),
  targetRoles: z
    .array(z.string())
    .min(1, "At least one target role is required")
    .default(["ALL"]),
  expiresAt: z.string().datetime().optional().nullable(),
});

const ROLE_PRIORITY: Record<string, number> = {
  STAFF: 1,
  TEACHER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

/** GET /api/notices - list notices
 *  Admin+: all notices with optional ?status filter
 *  Others: only PUBLISHED non-expired notices
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const user = authResult;
  const isAdmin = (ROLE_PRIORITY[user.role] ?? 0) >= 2;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status"); // "DRAFT" | "PUBLISHED" | "ARCHIVED"

  const now = new Date();

  // Admins can filter by any status; non-admins only see published
  const where = isAdmin
    ? statusFilter
      ? { status: statusFilter as "DRAFT" | "PUBLISHED" | "ARCHIVED" }
      : {}
    : {
        status: "PUBLISHED" as const,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      };

  const notices = await prisma.notice.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notices);
}

/** POST /api/notices - create a new notice (ADMIN+) */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  const user = authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = NoticeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { title, content, targetRoles, expiresAt } = parsed.data;

  const notice = await prisma.notice.create({
    data: {
      title,
      content,
      targetRoles,
      status: "DRAFT",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: user.name,
      createdById: user.id,
    },
  });

  return NextResponse.json(notice, { status: 201 });
}
