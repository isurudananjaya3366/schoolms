import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const records = await prisma.markRecord.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });

    const years = records.map(r => r.year);
    return NextResponse.json(years);
  } catch (error) {
    console.error("GET /api/marks/years error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
