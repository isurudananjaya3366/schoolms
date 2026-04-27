import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import type { SlideLabels } from "@/types/preview";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(Role.STAFF);
  if (authResult instanceof NextResponse) return authResult;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key param" }, { status: 400 });
  }

  const config = await prisma.presentationConfig.findUnique({ where: { key } });
  return NextResponse.json({ labels: (config?.labels ?? {}) as SlideLabels });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(Role.ADMIN);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json() as { key: string; labels: SlideLabels };
  if (!body.key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  await prisma.presentationConfig.upsert({
    where: { key: body.key },
    update: { labels: body.labels as object },
    create: { key: body.key, labels: body.labels as object },
  });

  return NextResponse.json({ success: true });
}
