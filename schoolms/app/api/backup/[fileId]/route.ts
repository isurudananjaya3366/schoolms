import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { deleteBackup, getBackupHistory } from "@/lib/backup";
import { BACKUP_DELETED } from "@/lib/audit-actions";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const authResult = await requireAuth(Role.SUPERADMIN);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { fileId } = await params;
  const decodedFileId = decodeURIComponent(fileId);

  // Verify exists in history
  const history = await getBackupHistory();
  const entry = history.find(h => h.fileId === decodedFileId);
  if (!entry) {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }

  try {
    await deleteBackup(decodedFileId);
  } catch (err) {
    console.error("Storage delete error:", err);
  }

  // Remove from history
  const config = await prisma.systemConfig.findUnique({ where: { key: "backupHistory" } });
  if (config?.value) {
    try {
      let hist = JSON.parse(config.value);
      hist = hist.filter((h: { fileId: string }) => h.fileId !== decodedFileId);
      await prisma.systemConfig.update({
        where: { key: "backupHistory" },
        data: { value: JSON.stringify(hist) },
      });
    } catch { /* ignore */ }
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      userDisplayName: user.name || "Unknown",
      action: BACKUP_DELETED,
      details: JSON.stringify({ fileId: decodedFileId, filename: entry.filename }),
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    },
  });

  return NextResponse.json({ success: true });
}
