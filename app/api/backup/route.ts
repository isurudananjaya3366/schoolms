import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { runBackupPipeline, sendFailureAlert, getActiveProvider, createLocalBackup } from "@/lib/backup";
import { BACKUP_TRIGGERED, BACKUP_COMPLETED, BACKUP_FAILED } from "@/lib/audit-actions";
import { createNotification, NOTIF } from "@/lib/notifications";
import { getSecureSetting } from "@/lib/secure-settings";

// GET - Cron-triggered backup
export async function GET(request: NextRequest) {
  // Authenticate via CRON_SECRET
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = (await getSecureSetting("CRON_SECRET")) || "";

  if (!cronSecret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const a = Buffer.from(authHeader);
    const b = Buffer.from(`Bearer ${cronSecret}`);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run backup
  try {
    await prisma.auditLog.create({
      data: { userDisplayName: "System (Cron)", action: BACKUP_TRIGGERED, details: JSON.stringify({ trigger: "cron" }) },
    });

    const result = await runBackupPipeline();

    await prisma.auditLog.create({
      data: { userDisplayName: "System (Cron)", action: BACKUP_COMPLETED, details: JSON.stringify(result) },
    });

    createNotification({
      type: NOTIF.BACKUP_COMPLETED,
      title: "Scheduled Backup Completed",
      message: `Automated backup completed successfully.`,
      createdBy: "System (Cron)",
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.auditLog.create({
      data: { userDisplayName: "System (Cron)", action: BACKUP_FAILED, details: JSON.stringify({ error: errorMessage, stack: err instanceof Error ? err.stack : undefined }) },
    }).catch(() => {});

    await sendFailureAlert(errorMessage);

    createNotification({
      type: NOTIF.BACKUP_FAILED,
      title: "Backup Failed",
      message: `Automated backup failed: ${errorMessage}`,
      createdBy: "System (Cron)",
    });

    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}

// POST - Manual backup by SUPERADMIN
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(Role.SUPERADMIN);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userDisplayName: user.name || "Unknown",
        action: BACKUP_TRIGGERED,
        details: JSON.stringify({ trigger: "manual" }),
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      },
    });

    const provider = await getActiveProvider();

    if (provider === "none") {
      // Local mode - return the file directly for browser download
      const { buffer, filename, sizeBytes, timestamp } = await createLocalBackup();

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userDisplayName: user.name || "Unknown",
          action: BACKUP_COMPLETED,
          details: JSON.stringify({ filename, sizeBytes, timestamp, provider: "local" }),
          ipAddress: request.headers.get("x-forwarded-for") || undefined,
        },
      });

      createNotification({
        type: NOTIF.BACKUP_COMPLETED,
        title: "Manual Backup Completed",
        message: `${user.name ?? "Admin"} triggered a manual backup. File: ${filename} (${Math.round(sizeBytes / 1024)} KB).`,
        createdBy: user.name ?? "Admin",
      });

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(sizeBytes),
        },
      });
    }

    // Cloud mode (S3 / Vercel Blob)
    const result = await runBackupPipeline();

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userDisplayName: user.name || "Unknown",
        action: BACKUP_COMPLETED,
        details: JSON.stringify(result),
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      },
    });

    createNotification({
      type: NOTIF.BACKUP_COMPLETED,
      title: "Manual Backup Completed",
      message: `${user.name ?? "Admin"} triggered a manual cloud backup successfully.`,
      createdBy: user.name ?? "Admin",
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userDisplayName: user.name || "Unknown",
        action: BACKUP_FAILED,
        details: JSON.stringify({ error: errorMessage }),
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      },
    }).catch(() => {});

    await sendFailureAlert(errorMessage);

    createNotification({
      type: NOTIF.BACKUP_FAILED,
      title: "Manual Backup Failed",
      message: `${user.name ?? "Admin"}'s manual backup failed: ${errorMessage}`,
      createdBy: user.name ?? "Admin",
    });

    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
