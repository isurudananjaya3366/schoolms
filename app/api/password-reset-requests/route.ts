import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";

// GET /api/password-reset-requests
// Returns all PENDING requests (excluding SUPERADMIN users) - Admin+ only.
export async function GET() {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const requests = await prisma.passwordResetRequest.findMany({
      where: {
        status: "PENDING",
        userRole: { not: "SUPERADMIN" },
      },
      select: {
        id: true,
        userName: true,
        userEmail: true,
        userRole: true,
        requestedAt: true,
        status: true,
        // passwordHash is intentionally excluded
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("[password-reset-requests GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
