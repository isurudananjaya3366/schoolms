import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { sanitizeMongoUri } from "@/lib/utils";

const superadminSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = superadminSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check for existing SUPERADMIN
    const existingSuperadmin = await prisma.user.findFirst({
      where: { role: "SUPERADMIN" },
    });

    if (existingSuperadmin) {
      return NextResponse.json(
        { error: "A superadmin account already exists" },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password and create user
    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "SUPERADMIN",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Handle P2002 duplicate key error
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    const rawMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: sanitizeMongoUri(rawMessage) },
      { status: 500 }
    );
  }
}
