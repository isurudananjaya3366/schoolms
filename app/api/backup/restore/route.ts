import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { downloadBackup, getBackupHistory, gunzipAsync, restoreFromData } from "@/lib/backup";
import type { RestoreProgressFn } from "@/lib/backup";
import { RESTORE_TRIGGERED, RESTORE_COMPLETED, RESTORE_FAILED } from "@/lib/audit-actions";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(Role.SUPERADMIN);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;
  const ip = request.headers.get("x-forwarded-for") || undefined;

  const contentType = request.headers.get("content-type") || "";

  // Parse input first, then stream progress
  let backupData: Record<string, unknown>;
  let sourceLabel: string;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      sourceLabel = `file:${file.name}`;

      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      let jsonStr: string;
      if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
        const decompressed = await gunzipAsync(buffer);
        jsonStr = decompressed.toString("utf-8");
      } else {
        jsonStr = buffer.toString("utf-8");
      }

      backupData = JSON.parse(jsonStr);

      if (!backupData.meta || !backupData.students) {
        return NextResponse.json(
          { error: "Invalid backup file - missing required data sections" },
          { status: 400 }
        );
      }
    } else {
      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { fileId } = body;
      if (!fileId) {
        return NextResponse.json({ error: "fileId is required" }, { status: 400 });
      }

      const history = await getBackupHistory();
      const entry = history.find((h) => h.fileId === fileId);
      if (!entry) {
        return NextResponse.json({ error: "Backup not found in history" }, { status: 404 });
      }
      sourceLabel = `cloud:${entry.filename}`;

      const compressed = await downloadBackup(fileId);
      const decompressed = await gunzipAsync(compressed);
      backupData = JSON.parse(decompressed.toString("utf-8"));
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to read backup: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 400 }
    );
  }

  // Audit: restore triggered
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userDisplayName: user.name || "Unknown",
      action: RESTORE_TRIGGERED,
      details: JSON.stringify({ source: sourceLabel }),
      ipAddress: ip,
    },
  }).catch(() => {});

  // Stream NDJSON progress
  const encoder = new TextEncoder();
  const capturedBackupData = backupData;
  const capturedSourceLabel = sourceLabel;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      const onProgress: RestoreProgressFn = (step, total, message) => {
        send({ type: "progress", step, total, message, percent: Math.round((step / total) * 100) });
      };

      try {
        const counts = await restoreFromData(capturedBackupData, onProgress);

        // Final progress 100%
        send({ type: "progress", step: 8, total: 8, message: "Restore complete!", percent: 100 });

        // Audit: restore completed
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            userDisplayName: user.name || "Unknown",
            action: RESTORE_COMPLETED,
            details: JSON.stringify({ source: capturedSourceLabel, counts }),
            ipAddress: ip,
          },
        }).catch(() => {});

        send({
          type: "done",
          success: true,
          message: "Full restore completed. All data has been replaced from the backup.",
          counts,
        });
      } catch (err) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            userDisplayName: user.name || "Unknown",
            action: RESTORE_FAILED,
            details: JSON.stringify({
              error: err instanceof Error ? err.message : "Unknown error",
            }),
            ipAddress: ip,
          },
        }).catch(() => {});

        send({
          type: "error",
          error: err instanceof Error ? err.message : "Restore failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
