export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { uploadBlob, deleteBlob } from "@/lib/blob-storage";

/**
 * GET /api/uploads/signature — List all stored signatures
 * Returns signatures from systemConfig keys matching "signature_*"
 */
export async function GET() {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const configs = await prisma.systemConfig.findMany({
      where: { key: { startsWith: "signature_" } },
    });

    const signatures = configs.map((c) => {
      const parsed = JSON.parse(c.value);
      return {
        key: c.key,
        label: parsed.label || c.key,
        url: parsed.url || "",
        type: parsed.type || "class_teacher", // class_teacher | principal | vice_principal
        classLabel: parsed.classLabel || null,
      };
    });

    return NextResponse.json({ signatures });
  } catch (error) {
    console.error("GET /api/uploads/signature error:", error);
    return NextResponse.json(
      { error: "Failed to fetch signatures" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/uploads/signature — Upload a new signature image
 * FormData: file (image), type ("class_teacher" | "principal" | "vice_principal"), classLabel (e.g. "11B")
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "class_teacher";
    const classLabel = (formData.get("classLabel") as string) || "";

    if (!file || !file.size) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 2MB" },
        { status: 400 }
      );
    }

    // Determine config key and label
    let configKey: string;
    let label: string;

    if (type === "principal") {
      configKey = "signature_principal";
      label = "Principal";
    } else if (type === "vice_principal") {
      configKey = "signature_vice_principal";
      label = "Vice Principal";
    } else {
      if (!classLabel) {
        return NextResponse.json(
          { error: "classLabel is required for class teacher signatures" },
          { status: 400 }
        );
      }
      configKey = `signature_class_${classLabel.replace(/\s+/g, "_")}`;
      label = `Class ${classLabel} Teacher`;
    }

    // Check if a previous blob exists and delete it
    const existing = await prisma.systemConfig.findUnique({
      where: { key: configKey },
    });
    if (existing) {
      try {
        const parsed = JSON.parse(existing.value);
        if (parsed.url) await deleteBlob(parsed.url);
      } catch {
        // Ignore deletion errors
      }
    }

    // Upload to Vercel Blob
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "png";
    const pathname = `schoolms/signatures/${configKey}.${ext}`;

    const url = await uploadBlob(pathname, buffer, file.type);

    if (!url) {
      return NextResponse.json(
        { error: "Blob storage not configured. Please set the BLOB_READ_WRITE_TOKEN in API Keys settings." },
        { status: 422 }
      );
    }

    // Save to systemConfig
    const configValue = JSON.stringify({
      url,
      label,
      type,
      classLabel: classLabel || null,
      uploadedAt: new Date().toISOString(),
    });

    await prisma.systemConfig.upsert({
      where: { key: configKey },
      update: { value: configValue },
      create: { key: configKey, value: configValue },
    });

    // Audit log
    prisma.auditLog
      .create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name || "Unknown",
          action: "SIGNATURE_UPLOADED",
          targetType: "SystemConfig",
          details: JSON.stringify({ configKey, label, type, classLabel }),
        },
      })
      .catch(console.error);

    return NextResponse.json({
      key: configKey,
      label,
      url,
      type,
      classLabel: classLabel || null,
    });
  } catch (error) {
    console.error("POST /api/uploads/signature error:", error);
    return NextResponse.json(
      { error: "Failed to upload signature" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/uploads/signature — Delete a signature
 * Body: { key: "signature_class_11B" }
 */
export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth(Role.ADMIN);
    if (authResult instanceof NextResponse) return authResult;

    const { key } = await request.json();

    if (!key || !key.startsWith("signature_")) {
      return NextResponse.json(
        { error: "Invalid signature key" },
        { status: 400 }
      );
    }

    // Find and delete blob
    const existing = await prisma.systemConfig.findUnique({
      where: { key },
    });

    if (existing) {
      try {
        const parsed = JSON.parse(existing.value);
        if (parsed.url) await deleteBlob(parsed.url);
      } catch {
        // Ignore
      }

      await prisma.systemConfig.delete({ where: { key } });
    }

    // Audit log
    prisma.auditLog
      .create({
        data: {
          userId: authResult.id,
          userDisplayName: authResult.name || "Unknown",
          action: "SIGNATURE_DELETED",
          targetType: "SystemConfig",
          details: JSON.stringify({ key }),
        },
      })
      .catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/uploads/signature error:", error);
    return NextResponse.json(
      { error: "Failed to delete signature" },
      { status: 500 }
    );
  }
}
