import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { USER_CREATED } from "@/lib/audit-actions";
import { createNotification, NOTIF } from "@/lib/notifications";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
};

export async function GET() {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    let users;
    if (authResult.role === Role.SUPERADMIN) {
      users = await prisma.user.findMany({
        select: userSelect,
        orderBy: { createdAt: "desc" },
      });
    } else {
      // ADMIN: see STAFF + own account
      users = await prisma.user.findMany({
        where: {
          OR: [
            { role: Role.STAFF },
            { id: authResult.id },
          ],
        },
        select: userSelect,
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(["STAFF", "ADMIN", "TEACHER", "STUDENT"]),
  assignedClassId: z.string().optional().nullable(),
  linkedStudentId: z.string().optional().nullable(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fields[path]) fields[path] = issue.message;
      }
      return NextResponse.json({ error: "Validation failed", fields }, { status: 400 });
    }

    const { name, email, password, role, assignedClassId, linkedStudentId } = parsed.data;

    // Role elevation guard:
    // ADMIN can only create STAFF, TEACHER, or STUDENT - not ADMIN or above
    if (authResult.role === Role.ADMIN && (role === "ADMIN" || role === "SUPERADMIN" as string)) {
      return NextResponse.json(
        { error: "Insufficient permissions to create an account with this role." },
        { status: 403 }
      );
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists.", fields: { email: "Email already in use" } },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as Role,
        isActive: true,
        assignedClassId: assignedClassId || null,
        linkedStudentId: linkedStudentId || null,
      },
      select: userSelect,
    });

    // Audit log
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    await prisma.auditLog.create({
      data: {
        userId: authResult.id,
        userDisplayName: authResult.name,
        action: USER_CREATED,
        targetId: newUser.id,
        targetType: "USER",
        ipAddress: ip,
        details: JSON.stringify({ name: newUser.name, email: newUser.email, role: newUser.role, targetName: newUser.name }),
      },
    }).catch(console.error);

    createNotification({
      type: NOTIF.USER_CREATED,
      title: "New User Account Created",
      message: `${authResult.name ?? "Admin"} created a new ${newUser.role} account for ${newUser.name}.`,
      createdBy: authResult.name ?? authResult.email,
      data: { userId: newUser.id, userName: newUser.name, role: newUser.role },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
