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
    });

    const currentYear = new Date().getFullYear();
    const dbYears = records.map(r => r.year);
    const minYear = dbYears.length > 0 ? Math.min(...dbYears) : currentYear;

    const allYears: number[] = [];
    for (let y = currentYear; y >= minYear; y--) {
      allYears.push(y);
    }

    return NextResponse.json(allYears);
  } catch (error) {
    console.error("GET /api/marks/years error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
