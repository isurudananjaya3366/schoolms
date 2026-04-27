import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

const TERM_ORDER = ["TERM_1", "TERM_2", "TERM_3"] as const;

/**
 * GET /api/analytics/latest-period
 * Returns the most recent academic year and term that have mark records.
 */
export async function GET() {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    // Find the most recent year that has mark records
    const latestYearRecord = await prisma.markRecord.findFirst({
      orderBy: { year: "desc" },
      select: { year: true },
    });

    if (!latestYearRecord) {
      return NextResponse.json({
        latestYear: new Date().getFullYear(),
        latestTerm: "TERM_3",
      });
    }

    const latestYear = latestYearRecord.year;

    // Find all distinct terms present for that year
    const termRecords = await prisma.markRecord.findMany({
      where: { year: latestYear },
      select: { term: true },
      distinct: ["term"],
    });

    const availableTerms = new Set(termRecords.map((r) => r.term));

    // Pick the latest available term (TERM_3 > TERM_2 > TERM_1)
    let latestTerm: string = "TERM_1";
    for (const t of TERM_ORDER) {
      if (availableTerms.has(t)) latestTerm = t;
    }

    return NextResponse.json({ latestYear, latestTerm });
  } catch (err) {
    console.error("/api/analytics/latest-period error:", err);
    return NextResponse.json(
      { latestYear: new Date().getFullYear(), latestTerm: "TERM_3" },
      { status: 200 }, // Non-critical - return fallback rather than 500
    );
  }
}
