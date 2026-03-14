export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { uploadBlob, deleteBlob } from "@/lib/blob-storage";

/**
 * POST /api/uploads/logo — Upload school logo to Vercel Blob
 * Stores the blob URL in systemConfig.school_logo_url
 * Falls back to manually-entered URL if blob not configured
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.size) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 2MB" },
        { status: 400 }
      );
    }

    // Check if previous logo was a blob and delete it
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key: "school_logo_url" },
    });

    if (existingConfig?.value) {
      try {
        // Only delete if it's a Vercel Blob URL
        if (existingConfig.value.includes(".vercel-storage.com") || existingConfig.value.includes(".blob.")) {
          await deleteBlob(existingConfig.value);
        }
      } catch {
        // Ignore deletion errors
      }
    }

    // Upload to Vercel Blob
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "png";
    const pathname = `schoolms/logo/school-logo-${Date.now()}.${ext}`;

    const url = await uploadBlob(pathname, buffer, file.type);

    if (!url) {
      return NextResponse.json(
        { error: "Blob storage not configured. Please set the BLOB_READ_WRITE_TOKEN in API Keys settings, or use a direct URL instead." },
        { status: 422 }
      );
    }

    // Update systemConfig
    await prisma.systemConfig.upsert({
      where: { key: "school_logo_url" },
      update: { value: url },
      create: { key: "school_logo_url", value: url },
    });

    // Audit log
    prisma.auditLog
      .create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name || "Unknown",
          action: "LOGO_UPLOADED",
          targetType: "SystemConfig",
          details: JSON.stringify({ url }),
        },
      })
      .catch(console.error);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("POST /api/uploads/logo error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}
