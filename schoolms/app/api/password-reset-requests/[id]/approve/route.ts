import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";

// POST /api/password-reset-requests/[id]/approve
// Applies the hashed password to the user and marks the request as approved.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;
  const reviewer = authResult;

  const { id } = await params;

  try {
    const request = await prisma.passwordResetRequest.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        userRole: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Double-check: never approve a SUPERADMIN request
    if (request.userRole === "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "Request is no longer pending" },
        { status: 409 }
      );
    }

    // Apply new password hash to user and force session invalidation
    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.userId },
        data: {
          passwordHash: request.passwordHash,
          sessionInvalidatedAt: new Date(),
        },
      }),
      prisma.passwordResetRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: reviewer.id,
          reviewedByName: reviewer.name,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[approve password reset] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
