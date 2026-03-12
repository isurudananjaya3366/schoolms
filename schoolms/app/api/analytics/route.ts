import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";

export async function GET() {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  return NextResponse.json({
    message: "Analytics API — Not yet implemented (Phase 4)",
    route: "/api/analytics",
  });
}
