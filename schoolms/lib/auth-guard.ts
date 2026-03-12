import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

const ROLE_HIERARCHY: Role[] = [Role.STAFF, Role.ADMIN, Role.SUPERADMIN];

export async function requireAuth(minimumRole?: Role) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (minimumRole) {
    const userRoleIndex = ROLE_HIERARCHY.indexOf(session.user.role as Role);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(minimumRole);

    if (userRoleIndex < requiredRoleIndex) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return session.user;
}
