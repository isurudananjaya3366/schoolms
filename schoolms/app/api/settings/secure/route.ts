import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import {
  SECURE_KEYS,
  getSecureSettingsStatus,
  setSecureSetting,
  clearSecureSettingsCache,
} from "@/lib/secure-settings";
import { z } from "zod";
import { SETTINGS_UPDATED } from "@/lib/audit-actions";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET  — returns key metadata + whether each key has a stored / env value
//        NEVER returns actual secret values
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const authResult = await requireAuth(Role.SUPERADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const status = await getSecureSettingsStatus();

    const keys = SECURE_KEYS.map((meta) => ({
      ...meta,
      hasDbValue: status[meta.key]?.hasDbValue ?? false,
      hasEnvFallback: status[meta.key]?.hasEnvFallback ?? false,
    }));

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("GET /api/settings/secure error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — upsert one or more secure keys (values are encrypted in DB)
// ---------------------------------------------------------------------------

const patchSchema = z.record(
  z.string(),
  z.string() // empty string → delete key
);

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth(Role.SUPERADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const validKeys = new Set(SECURE_KEYS.map((k) => k.key));
    const updates = parsed.data;
    const saved: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!validKeys.has(key)) continue;
      await setSecureSetting(key, value);
      saved.push(key);
    }

    // Clear cache so all consumers pick up new values immediately
    clearSecureSettingsCache();

    // Audit log (keys only, never values)
    if (saved.length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name,
          action: SETTINGS_UPDATED,
          targetType: "SecureSetting",
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          details: JSON.stringify({ updatedKeys: saved }),
        },
      }).catch(console.error);
    }

    return NextResponse.json({
      ok: true,
      updatedKeys: saved,
    });
  } catch (error) {
    console.error("PATCH /api/settings/secure error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
