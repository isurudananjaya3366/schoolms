import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import { seedClassGroups } from "@/lib/seed-class-groups";

export async function POST() {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const result = await seedClassGroups();
    return NextResponse.json({ seeded: result.created, skipped: result.skipped });
  } catch (error) {
    console.error("POST /api/settings/seed-classes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
