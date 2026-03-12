import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { USER_UPDATED, USER_DEACTIVATED, USER_REACTIVATED, USER_DELETED } from "@/lib/audit-actions";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const body = await request.json();

    const schema = z.object({
      name: z.string().trim().min(1).optional(),
      email: z.string().email().optional(),
      role: z.enum(["STAFF", "ADMIN"]).optional(),
      isActive: z.boolean().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = issue.message;
      }
      return NextResponse.json({ error: "Validation failed", fields }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { name, email, role, isActive } = parsed.data;

    // Role change restrictions
    if (role !== undefined) {
      // No one may change SUPERADMIN role
      if (target.role === Role.SUPERADMIN) {
        return NextResponse.json({ error: "Cannot change the SUPERADMIN role." }, { status: 403 });
      }
      // ADMIN cannot change their own role
      if (authResult.role === Role.ADMIN && authResult.id === id) {
        return NextResponse.json({ error: "You cannot change your own role." }, { status: 403 });
      }
      // ADMIN cannot elevate to ADMIN or SUPERADMIN
      if (authResult.role === Role.ADMIN && role !== "STAFF") {
        return NextResponse.json({ error: "Insufficient permissions to assign this role." }, { status: 403 });
      }
    }

    // isActive restrictions: cannot deactivate SUPERADMIN
    if (isActive === false && target.role === Role.SUPERADMIN) {
      return NextResponse.json({ error: "The SUPERADMIN account cannot be deactivated." }, { status: 403 });
    }

    // Email uniqueness check
    if (email && email !== target.email) {
      const emailTaken = await prisma.user.findFirst({ where: { email, id: { not: id } } });
      if (emailTaken) {
        return NextResponse.json(
          { error: "Email already in use.", fields: { email: "Email already taken by another account" } },
          { status: 409 }
        );
      }
    }

    // Build update payload dynamically
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      if (isActive === false) {
        updateData.sessionInvalidatedAt = new Date();
      } else {
        updateData.sessionInvalidatedAt = null;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    // Determine audit action
    let auditAction = USER_UPDATED;
    if (isActive === false) auditAction = USER_DEACTIVATED;
    else if (isActive === true) auditAction = USER_REACTIVATED;

    // Build changed fields for audit
    const changedFields: string[] = [];
    const newValues: Record<string, unknown> = {};
    if (name !== undefined && name !== target.name) { changedFields.push("name"); newValues.name = name; }
    if (email !== undefined && email !== target.email) { changedFields.push("email"); newValues.email = email; }
    if (role !== undefined && role !== target.role) { changedFields.push("role"); newValues.role = role; }
    if (isActive !== undefined && isActive !== target.isActive) { changedFields.push("isActive"); newValues.isActive = isActive; }

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    await prisma.auditLog.create({
      data: {
        userId: authResult.id,
        userDisplayName: authResult.name,
        action: auditAction,
        targetId: id,
        targetType: "USER",
        ipAddress: ip,
        details: JSON.stringify({ targetName: target.name, changedFields, newValues }),
      },
    }).catch(console.error);

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(Role.SUPERADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const target = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.role === Role.SUPERADMIN) {
      return NextResponse.json({ error: "The SUPERADMIN account cannot be deleted." }, { status: 403 });
    }

    // Audit log before delete
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    await prisma.auditLog.create({
      data: {
        userId: authResult.id,
        userDisplayName: authResult.name,
        action: USER_DELETED,
        targetId: id,
        targetType: "USER",
        ipAddress: ip,
        details: JSON.stringify({ targetName: target.name, email: target.email, role: target.role }),
      },
    }).catch(console.error);

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
