import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  loadPermissions,
  PERMISSION_FEATURES,
  CONFIGURABLE_ROLES,
  DEFAULT_PERMISSIONS,
  type AllRolePermissions,
  type PermissionKey,
} from "@/lib/permissions";

// GET — return current permissions (SUPERADMIN only)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const permissions = await loadPermissions();
  return NextResponse.json({ permissions });
}

// PUT — save permissions (SUPERADMIN only)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Validate and sanitise — only accept known roles and permission keys
  const validKeys = new Set(Object.keys(PERMISSION_FEATURES) as PermissionKey[]);
  const sanitised: AllRolePermissions = { ...DEFAULT_PERMISSIONS };

  for (const role of CONFIGURABLE_ROLES) {
    const roleData = (body as Record<string, unknown>)[role];
    if (roleData && typeof roleData === "object" && !Array.isArray(roleData)) {
      const merged = { ...DEFAULT_PERMISSIONS[role] };
      for (const key of validKeys) {
        const val = (roleData as Record<string, unknown>)[key];
        if (typeof val === "boolean") {
          merged[key] = val;
        }
      }
      sanitised[role] = merged;
    }
  }

  await prisma.systemConfig.upsert({
    where: { key: "role_permissions" },
    create: { key: "role_permissions", value: JSON.stringify(sanitised) },
    update: { value: JSON.stringify(sanitised) },
  });

  return NextResponse.json({ permissions: sanitised });
}
