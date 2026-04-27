import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function DELETE() {
  try {
    const authResult = await requireAuth(Role.SUPERADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { count } = await prisma.auditLog.deleteMany({});

    return NextResponse.json({ success: true, deleted: count });
  } catch {
    return NextResponse.json(
      { error: "Failed to clear audit log." },
      { status: 500 }
    );
  }
}
