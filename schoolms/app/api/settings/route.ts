import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { SETTINGS_UPDATED } from "@/lib/audit-actions";

const SETTINGS_KEYS = [
  "school_name",
  "academic_year",
  "elective_label_I",
  "elective_label_II",
  "elective_label_III",
  "core_subjects",
  "school_logo_url",
] as const;

const DEFAULTS: Record<string, string> = {
  school_name: "SchoolMS",
  academic_year: new Date().getFullYear().toString(),
  elective_label_I: JSON.stringify(["Geography", "Civic Studies", "Accounting", "Tamil"]),
  elective_label_II: JSON.stringify(["Art", "Dancing", "Music", "Drama & Theatre", "Sinhala Literature", "English Literature"]),
  elective_label_III: JSON.stringify(["Health", "ICT", "Agriculture", "Art & Crafts", "Electrical & Electronic Tech.", "Construction Tech."]),
  core_subjects: JSON.stringify({ sinhala: "Sinhala", buddhism: "Buddhism", maths: "Mathematics", science: "Science", english: "English", history: "History" }),
  school_logo_url: "",
};

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: [...SETTINGS_KEYS] } },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    const result: Record<string, string> = {};
    for (const key of SETTINGS_KEYS) {
      result[key] = configMap[key] || DEFAULTS[key];
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const patchSchema = z.object({
  school_name: z.string().trim().min(1).optional(),
  academic_year: z.string().trim().min(1).optional(),
  elective_label_I: z.string().trim().min(1).optional(),
  elective_label_II: z.string().trim().min(1).optional(),
  elective_label_III: z.string().trim().min(1).optional(),
  core_subjects: z.string().optional(),
  school_logo_url: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const updates = parsed.data;
    const updatedKeys: string[] = [];
    const updatedValues: Record<string, string> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        updatedKeys.push(key);
        updatedValues[key] = value;
      }
    }

    // Audit log
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    await prisma.auditLog.create({
      data: {
        userId: authResult.id,
        userDisplayName: authResult.name,
        action: SETTINGS_UPDATED,
        targetType: "SETTINGS",
        ipAddress: ip,
        details: JSON.stringify({ updatedKeys, updatedValues }),
      },
    }).catch(console.error);

    // Return final state with fallbacks
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: [...SETTINGS_KEYS] } },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    const result: Record<string, string> = {};
    for (const key of SETTINGS_KEYS) {
      result[key] = configMap[key] || DEFAULTS[key];
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
