import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

/** GET /api/notifications
 *  ?page=1&limit=20&unread=true
 *
 *  Returns notifications targeted at the current user's role.
 *  Includes per-notification `isRead` field derived from readBy array.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const unreadOnly = searchParams.get("unread") === "true";

    const role = authResult.role as string;
    const userId = authResult.id;

    // Base filter: notification targets this user's role
    const where: Record<string, unknown> = {
      targetRoles: { has: role },
    };

    // Fetch all for unread count calculation when listing
    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const mapped = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      targetRoles: n.targetRoles,
      data: n.data,
      createdBy: n.createdBy,
      createdAt: n.createdAt,
      isRead: n.readBy.includes(userId),
    }));

    // Compute total unread count for badge (across all pages)
    const allNotifs = await prisma.notification.findMany({
      where,
      select: { readBy: true },
    });
    const unreadCount = allNotifs.filter((n) => !n.readBy.includes(userId)).length;

    const filtered = unreadOnly ? mapped.filter((n) => !n.isRead) : mapped;

    return NextResponse.json({
      data: filtered,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
