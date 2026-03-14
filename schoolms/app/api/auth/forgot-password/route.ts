import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
});

// In-memory rate limiting: 5 requests per IP per hour
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// Always returns { ok: true } to prevent user enumeration
const OK = NextResponse.json({ ok: true });

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    // Always succeed on invalid input to prevent enumeration
    if (!parsed.success) return OK;

    const { email, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true },
    });

    // Don't process if not found, or if user is SUPERADMIN (SUPERADMIN must change in-app)
    if (!user || user.role === "SUPERADMIN") return OK;

    // Hash the new password server-side — admins never see it
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Upsert: one pending request per user at a time
    const existing = await prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
      select: { id: true },
    });

    if (existing) {
      await prisma.passwordResetRequest.update({
        where: { id: existing.id },
        data: { passwordHash, requestedAt: new Date() },
      });
    } else {
      await prisma.passwordResetRequest.create({
        data: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          passwordHash,
        },
      });
    }

    return OK;
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
