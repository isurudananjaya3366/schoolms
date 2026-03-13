import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Normalize a string for fuzzy matching: lowercase, strip spaces & punctuation
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.]/g, "");
}

type Candidate = {
  id: string;
  name: string;
  indexNumber: string | null;
  class: { grade: number; section: string };
};

const SELECT_FIELDS = {
  id: true,
  name: true,
  indexNumber: true,
  class: { select: { grade: true, section: true } },
} as const;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters." },
      { status: 400 }
    );
  }

  const normQuery = normalize(query);

  // 1. Try exact index number match first (case-insensitive)
  const exactByIndex = await prisma.student.findFirst({
    where: {
      indexNumber: { equals: query, mode: "insensitive" },
      isDeleted: false,
    },
    select: SELECT_FIELDS,
  });

  if (exactByIndex) {
    return NextResponse.json({ students: [exactByIndex] });
  }

  // 2. Parallel search: partial index contains + name fuzzy search
  const [byIndexPartial, byNamePartial] = await Promise.all([
    prisma.student.findMany({
      where: {
        indexNumber: { contains: query, mode: "insensitive" },
        isDeleted: false,
      },
      select: SELECT_FIELDS,
      take: 20,
    }),
    prisma.student.findMany({
      where: {
        name: {
          contains: query.split("").slice(0, 4).join(""),
          mode: "insensitive",
        },
        isDeleted: false,
      },
      select: SELECT_FIELDS,
      take: 50,
    }),
  ]);

  // Merge candidates, deduplicate by id
  const seenIds = new Set<string>();
  const pool: Candidate[] = [];
  for (const c of [...byIndexPartial, ...byNamePartial] as Candidate[]) {
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      pool.push(c);
    }
  }

  // If still nothing, try a broader 3-char prefix on names
  if (pool.length === 0) {
    const broader = await prisma.student.findMany({
      where: {
        name: { contains: query.substring(0, 3), mode: "insensitive" },
        isDeleted: false,
      },
      select: SELECT_FIELDS,
      take: 50,
    });
    pool.push(...(broader as Candidate[]));
  }

  // Score each candidate: check against both name and index number
  const scored = pool
    .map((s: Candidate) => {
      const normName = normalize(s.name);
      const normIndex = normalize(s.indexNumber ?? "");
      let score = 0;
      for (const norm of [normName, normIndex]) {
        if (!norm) continue;
        if (norm === normQuery) score = Math.max(score, 100);
        else if (norm.startsWith(normQuery)) score = Math.max(score, 80);
        else if (norm.includes(normQuery)) score = Math.max(score, 60);
        else if (normQuery.includes(norm)) score = Math.max(score, 40);
        else {
          let overlap = 0;
          for (let i = 0; i < normQuery.length; i++) {
            if (norm.includes(normQuery[i])) overlap++;
          }
          score = Math.max(
            score,
            Math.floor(
              (overlap / Math.max(norm.length, normQuery.length)) * 30
            )
          );
        }
      }
      return { ...s, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _score, ...s }) => s);

  return NextResponse.json({ students: scored });
}

