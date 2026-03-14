import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

/** POST /api/notifications/[id]/read
 *  Marks a single notification as read by the current user.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = params;
    const userId = authResult.id;
    const role = authResult.role as string;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // Ensure the user's role is a target for this notification
    if (!notification.targetRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!notification.readBy.includes(userId)) {
      await prisma.notification.update({
        where: { id },
        data: { readBy: { push: userId } },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/notifications/[id]/read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
