import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

/**
 * Roles that participate in the administrative hierarchy.
 * TEACHER and STUDENT are outside this hierarchy — they have
 * dedicated role-specific endpoints accessed via requireRole().
 */
const ROLE_HIERARCHY: Role[] = [Role.STAFF, Role.ADMIN, Role.SUPERADMIN];

/**
 * requireAuth(minimumRole?)
 *
 * - No arg: any authenticated user (including TEACHER and STUDENT).
 * - With arg: the user must be in the admin hierarchy at or above minimumRole.
 *   (TEACHER and STUDENT are excluded from the hierarchy.)
 */
export async function requireAuth(minimumRole?: Role) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (minimumRole) {
    const userRoleIndex = ROLE_HIERARCHY.indexOf(session.user.role as Role);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(minimumRole);

    // User is not in the admin hierarchy OR doesn't meet minimum level
    if (userRoleIndex < 0 || userRoleIndex < requiredRoleIndex) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return session.user;
}

/**
 * requireRole(allowedRoles)
 *
 * Explicit allow-list check — use this for endpoints that should be
 * accessible by specific roles (e.g., [TEACHER, ADMIN, SUPERADMIN]).
 */
export async function requireRole(allowedRoles: Role[]) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowedRoles.includes(session.user.role as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session.user;
}
