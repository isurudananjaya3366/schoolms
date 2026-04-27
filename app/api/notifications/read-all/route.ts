import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

/** POST /api/notifications/read-all
 *  Marks all notifications (for this user's role) as read.
 */
export async function POST(_request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const userId = authResult.id;
    const role = authResult.role as string;

    // Find all unread notifications targeted at this role
    const unread = await prisma.notification.findMany({
      where: {
        targetRoles: { has: role },
        NOT: { readBy: { has: userId } },
      },
      select: { id: true },
    });

    if (unread.length > 0) {
      await Promise.all(
        unread.map((n) =>
          prisma.notification.update({
            where: { id: n.id },
            data: { readBy: { push: userId } },
          })
        )
      );
    }

    return NextResponse.json({ markedRead: unread.length });
  } catch (error) {
    console.error("POST /api/notifications/read-all error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
