import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Normalize a string for fuzzy matching: lowercase, strip spaces & punctuation
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.]/g, "");
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters." },
      { status: 400 }
    );
  }

  const normQuery = normalize(query);

  // 1. Try exact index number match first
  const byIndex = await prisma.student.findFirst({
    where: {
      indexNumber: { equals: query, mode: "insensitive" },
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      indexNumber: true,
      class: { select: { grade: true, section: true } },
    },
  });

  if (byIndex) {
    return NextResponse.json({ students: [byIndex] });
  }

  // 2. Fuzzy name search — fetch candidates matching a case-insensitive substring
  //    then re-rank in application by normalized match
  const candidates = await prisma.student.findMany({
    where: {
      name: { contains: query.split("").slice(0, 4).join(""), mode: "insensitive" },
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      indexNumber: true,
      class: { select: { grade: true, section: true } },
    },
    take: 50,
  });

  // If substring search returns nothing, try a broader first 3-char prefix
  const pool =
    candidates.length > 0
      ? candidates
      : await prisma.student.findMany({
          where: {
            name: {
              contains: query.substring(0, 3),
              mode: "insensitive",
            },
            isDeleted: false,
          },
          select: {
            id: true,
            name: true,
            indexNumber: true,
            class: { select: { grade: true, section: true } },
          },
          take: 50,
        });

  type Candidate = {
    id: string;
    name: string;
    indexNumber: string | null;
    class: { grade: number; section: string };
  };

  // Score each candidate: higher = better match
  const scored = (pool as Candidate[])
    .map((s: Candidate) => {
      const normName = normalize(s.name);
      let score = 0;
      if (normName === normQuery) score = 100;
      else if (normName.startsWith(normQuery)) score = 80;
      else if (normName.includes(normQuery)) score = 60;
      else if (normQuery.includes(normName)) score = 40;
      else {
        // partial overlap
        let overlap = 0;
        for (let i = 0; i < normQuery.length; i++) {
          if (normName.includes(normQuery[i])) overlap++;
        }
        score = Math.floor((overlap / Math.max(normName.length, normQuery.length)) * 30);
      }
      return { ...s, score };
    })
    .filter((s: Candidate & { score: number }) => s.score > 0)
    .sort((a: Candidate & { score: number }, b: Candidate & { score: number }) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _score, ...s }: Candidate & { score: number }) => s);

  return NextResponse.json({ students: scored });
}
