import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { put, del } from "@vercel/blob";
import { promisify } from "util";
import { gzip, gunzip } from "zlib";
import prisma from "@/lib/prisma";
import { getSecureSetting } from "@/lib/secure-settings";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

type StorageProvider = "s3" | "vercel-blob" | "none";

let _cachedProvider: StorageProvider | null = null;

async function detectProvider(): Promise<StorageProvider> {
  if (_cachedProvider !== null) return _cachedProvider;
  const hasS3 = (await getSecureSetting("AWS_ACCESS_KEY_ID")) &&
                (await getSecureSetting("AWS_SECRET_ACCESS_KEY")) &&
                (await getSecureSetting("AWS_S3_BUCKET"));
  if (hasS3) { _cachedProvider = "s3"; return "s3"; }
  if (await getSecureSetting("BLOB_READ_WRITE_TOKEN")) { _cachedProvider = "vercel-blob"; return "vercel-blob"; }
  _cachedProvider = "none";
  return "none";
}

// S3 Client (lazy init)
async function getS3Client(): Promise<S3Client> {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: (await getSecureSetting("AWS_ACCESS_KEY_ID"))!,
      secretAccessKey: (await getSecureSetting("AWS_SECRET_ACCESS_KEY"))!,
    },
  });
}

// Storage operations
export async function uploadBackup(buffer: Buffer, filename: string): Promise<string> {
  const activeProvider = await detectProvider();
  if (activeProvider === "s3") {
    const key = `backups/${filename}`;
    const s3 = await getS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: (await getSecureSetting("AWS_S3_BUCKET"))!,
      Key: key,
      Body: buffer,
      ContentType: "application/gzip",
    }));
    return key;
  }
  if (activeProvider === "vercel-blob") {
    const blob = await put(`backups/${filename}`, buffer, { access: "public", contentType: "application/gzip" });
    return blob.url;
  }
  throw new Error("No storage provider configured");
}

export async function downloadBackup(fileId: string): Promise<Buffer> {
  const activeProvider = await detectProvider();
  if (activeProvider === "s3") {
    const s3 = await getS3Client();
    const response = await s3.send(new GetObjectCommand({
      Bucket: (await getSecureSetting("AWS_S3_BUCKET"))!,
      Key: fileId,
    }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) { chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  if (activeProvider === "vercel-blob") {
    const res = await fetch(fileId);
    if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("No storage provider configured");
}

export async function deleteBackup(fileId: string): Promise<void> {
  const activeProvider = await detectProvider();
  if (activeProvider === "s3") {
    const s3 = await getS3Client();
    await s3.send(new DeleteObjectCommand({
      Bucket: (await getSecureSetting("AWS_S3_BUCKET"))!,
      Key: fileId,
    }));
    return;
  }
  if (activeProvider === "vercel-blob") {
    await del(fileId);
    return;
  }
  throw new Error("No storage provider configured");
}

export async function getActiveProvider(): Promise<StorageProvider> {
  return detectProvider();
}

// Backup orchestration types
export interface BackupMeta {
  version: string;
  timestamp: string;
  schoolName: string;
  totalStudents: number;
  totalMarkRecords: number;
}

export interface BackupHistoryEntry {
  fileId: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  storageProvider: string;
  status: "success" | "failed";
  errorMessage?: string;
}

export async function runBackupPipeline(): Promise<{ fileId: string; sizeBytes: number; timestamp: string }> {
  const activeProvider = await detectProvider();
  if (activeProvider === "none") {
    throw new Error("Backup misconfigured: no storage provider available. Set AWS S3 or Vercel Blob environment variables.");
  }

  // 1. Get school name from settings
  const schoolNameConfig = await prisma.systemConfig.findUnique({ where: { key: "school_name" } });
  const schoolName = schoolNameConfig?.value || "SchoolMS";

  // 2. Export all collections
  const [users, classGroups, students, markRecords, systemConfigs] = await Promise.all([
    prisma.user.findMany(),
    prisma.classGroup.findMany(),
    prisma.student.findMany(),
    prisma.markRecord.findMany(),
    prisma.systemConfig.findMany(),
  ]);

  // 3. Get counts
  const totalStudents = students.length;
  const totalMarkRecords = markRecords.length;

  // 4. Assemble backup object
  const timestamp = new Date().toISOString();
  const meta: BackupMeta = {
    version: "1.0",
    timestamp,
    schoolName,
    totalStudents,
    totalMarkRecords,
  };

  const backupData = {
    meta,
    users,
    classGroups,
    students,
    markRecords,
    systemConfigs,
  };

  // 5. Serialize + compress
  const jsonString = JSON.stringify(backupData);
  const compressed = await gzipAsync(Buffer.from(jsonString));

  // 6. Generate filename
  const safeTimestamp = timestamp.replace(/:/g, "-").replace(/\./g, "-");
  const filename = `schoolms-backup-${safeTimestamp}.json.gz`;

  // 7. Upload
  const fileId = await uploadBackup(compressed, filename);

  // 8. Record in SystemConfig backup history
  await updateBackupHistory({
    fileId,
    filename,
    timestamp,
    sizeBytes: compressed.length,
    storageProvider: activeProvider,
    status: "success",
  });

  // 9. Retention cleanup
  await runRetentionCleanup();

  return { fileId, sizeBytes: compressed.length, timestamp };
}

async function updateBackupHistory(entry: BackupHistoryEntry): Promise<void> {
  const existing = await prisma.systemConfig.findUnique({ where: { key: "backupHistory" } });
  let history: BackupHistoryEntry[] = [];
  if (existing?.value) {
    try { history = JSON.parse(existing.value); } catch { history = []; }
  }
  history.push(entry);
  await prisma.systemConfig.upsert({
    where: { key: "backupHistory" },
    update: { value: JSON.stringify(history) },
    create: { key: "backupHistory", value: JSON.stringify(history) },
  });
}

export async function getBackupHistory(): Promise<BackupHistoryEntry[]> {
  const config = await prisma.systemConfig.findUnique({ where: { key: "backupHistory" } });
  if (!config?.value) return [];
  try {
    const history: BackupHistoryEntry[] = JSON.parse(config.value);
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}



async function runRetentionCleanup(): Promise<void> {
  const config = await prisma.systemConfig.findUnique({ where: { key: "backupHistory" } });
  if (!config?.value) return;
  try {
    let history: BackupHistoryEntry[] = JSON.parse(config.value);
    if (history.length <= 30) return;
    // Sort ascending by timestamp (oldest first)
    history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const toDelete = history.slice(0, history.length - 30);
    for (const entry of toDelete) {
      try {
        await deleteBackup(entry.fileId);
      } catch (err) {
        console.error(`Failed to delete old backup ${entry.fileId}:`, err);
      }
    }
    // Keep only the 30 most recent
    const kept = history.slice(history.length - 30);
    await prisma.systemConfig.update({
      where: { key: "backupHistory" },
      data: { value: JSON.stringify(kept) },
    });
  } catch { /* ignore */ }
}

export async function sendFailureAlert(errorMessage: string): Promise<void> {
  const resendApiKey = await getSecureSetting("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured, skipping failure alert email");
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    const superadmins = await prisma.user.findMany({ where: { role: "SUPERADMIN", isActive: true } });
    if (superadmins.length === 0) {
      console.warn("No SUPERADMIN users found for backup failure alert");
      return;
    }

    const emails = superadmins.map(u => u.email);
    const schoolNameConfig = await prisma.systemConfig.findUnique({ where: { key: "school_name" } });
    const schoolName = schoolNameConfig?.value || "SchoolMS";

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@schoolms.app",
      to: emails,
      subject: "SchoolMS Backup Failed",
      text: `Backup Failure Alert\n\nSchool: ${schoolName}\nError: ${errorMessage}\nTime: ${new Date().toUTCString()}\n\nPlease check the SchoolMS audit log for details.`,
    });
  } catch (err) {
    console.error("Failed to send backup failure alert email:", err);
  }
}

export { gzipAsync, gunzipAsync };

/**
 * Create a backup and return it as a Buffer (for local/browser download).
 * Does NOT require any cloud storage provider.
 */
export async function createLocalBackup(): Promise<{
  buffer: Buffer;
  filename: string;
  sizeBytes: number;
  timestamp: string;
}> {
  // 1. Get school name
  const schoolNameConfig = await prisma.systemConfig.findUnique({ where: { key: "school_name" } });
  const schoolName = schoolNameConfig?.value || "SchoolMS";

  // 2. Export all collections
  const [users, classGroups, students, markRecords, systemConfigs, secureSettings, auditLogs] = await Promise.all([
    prisma.user.findMany(),
    prisma.classGroup.findMany(),
    prisma.student.findMany(),
    prisma.markRecord.findMany(),
    prisma.systemConfig.findMany(),
    prisma.secureSetting.findMany(),
    prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 10000 }),
  ]);

  // 3. Assemble backup
  const timestamp = new Date().toISOString();
  const meta: BackupMeta = {
    version: "2.0",
    timestamp,
    schoolName,
    totalStudents: students.length,
    totalMarkRecords: markRecords.length,
  };

  const backupData = {
    meta,
    users,
    classGroups,
    students,
    markRecords,
    systemConfigs,
    secureSettings,
    auditLogs,
  };

  // 4. Compress
  const jsonString = JSON.stringify(backupData);
  const compressed = await gzipAsync(Buffer.from(jsonString));

  // 5. Filename
  const safeTimestamp = timestamp.replace(/:/g, "-").replace(/\./g, "-");
  const filename = `schoolms-backup-${safeTimestamp}.json.gz`;

  // 6. Record in history
  await updateBackupHistory({
    fileId: `local:${filename}`,
    filename,
    timestamp,
    sizeBytes: compressed.length,
    storageProvider: "local",
    status: "success",
  });

  return { buffer: compressed, filename, sizeBytes: compressed.length, timestamp };
}

/**
 * Progress callback type for restore operations.
 * `step` is the current step index (0-based), `total` is the total number of steps.
 */
export type RestoreProgressFn = (
  step: number,
  total: number,
  message: string
) => void;

/**
 * Restore from a decompressed backup JSON object.
 * This is a FULL REPLACEMENT - all existing data is deleted first.
 * Users are preserved to avoid lockout.
 *
 * Each operation is wrapped in try-catch for corruption resilience.
 * A progress callback is invoked at each step so the UI can show progress.
 */
export async function restoreFromData(
  backupData: Record<string, unknown>,
  onProgress?: RestoreProgressFn
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const errors: string[] = [];
  const TOTAL_STEPS = 8;
  let currentStep = 0;

  const emit = (msg: string) => {
    onProgress?.(currentStep, TOTAL_STEPS, msg);
    currentStep++;
  };

  // ─── Step 1: Delete mark records ────────────────────────
  emit("Clearing existing mark records…");
  try {
    await prisma.markRecord.deleteMany();
  } catch (e) {
    errors.push(`Failed to delete mark records: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Step 2: Delete students ────────────────────────────
  emit("Clearing existing students…");
  try {
    await prisma.student.deleteMany();
  } catch (e) {
    errors.push(`Failed to delete students: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Step 3: Delete class groups & settings ─────────────
  emit("Clearing existing class groups and settings…");
  try {
    await prisma.classGroup.deleteMany();
  } catch (e) {
    errors.push(`Failed to delete class groups: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const backupHistoryConfig = await prisma.systemConfig.findUnique({ where: { key: "backupHistory" } });
    await prisma.systemConfig.deleteMany();
    if (backupHistoryConfig) {
      await prisma.systemConfig.create({ data: { key: "backupHistory", value: backupHistoryConfig.value } });
    }
  } catch (e) {
    errors.push(`Failed to clear settings: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Step 4: Restore system configs + secure settings ───
  emit("Restoring system configurations…");
  const configs = backupData.systemConfigs as { key: string; value: string }[] | undefined;
  if (configs?.length) {
    let inserted = 0;
    for (const c of configs) {
      if (c.key === "backupHistory") continue;
      try {
        await prisma.systemConfig.upsert({
          where: { key: c.key },
          update: { value: c.value },
          create: { key: c.key, value: c.value },
        });
        inserted++;
      } catch { /* skip */ }
    }
    counts.systemConfigs = inserted;
  }

  const secSettings = backupData.secureSettings as { key: string; value: string }[] | undefined;
  if (secSettings?.length) {
    try { await prisma.secureSetting.deleteMany(); } catch { /* ignore */ }
    let inserted = 0;
    for (const s of secSettings) {
      try {
        await prisma.secureSetting.create({ data: { key: s.key, value: s.value } });
        inserted++;
      } catch { /* skip */ }
    }
    counts.secureSettings = inserted;
  }

  // ─── Step 5: Restore class groups ───────────────────────
  emit("Restoring class groups…");
  type ClassGroupRow = { id: string; grade: number; section: string };
  const classGroups = backupData.classGroups as ClassGroupRow[] | undefined;
  const classIdMap = new Map<string, string>();
  if (classGroups?.length) {
    let inserted = 0;
    for (const cg of classGroups) {
      try {
        const created = await prisma.classGroup.create({
          data: { grade: cg.grade, section: cg.section },
        });
        classIdMap.set(cg.id, created.id);
        inserted++;
      } catch { /* skip */ }
    }
    counts.classGroups = inserted;
  }

  // ─── Step 6: Restore students ───────────────────────────
  emit("Restoring students…");
  type StudentRow = {
    id: string; name: string; indexNumber?: string | null;
    classId: string; electives: { categoryI: string; categoryII: string; categoryIII: string };
    scholarshipMarks?: number | null; isDeleted?: boolean;
  };
  const students = backupData.students as StudentRow[] | undefined;
  const studentIdMap = new Map<string, string>();
  if (students?.length) {
    let inserted = 0;
    for (const s of students) {
      const newClassId = classIdMap.get(s.classId);
      if (!newClassId) continue;
      try {
        const created = await prisma.student.create({
          data: {
            name: s.name,
            indexNumber: s.indexNumber || undefined,
            classId: newClassId,
            electives: s.electives,
            scholarshipMarks: s.scholarshipMarks ?? undefined,
            isDeleted: s.isDeleted ?? false,
          },
        });
        studentIdMap.set(s.id, created.id);
        inserted++;
      } catch { /* skip duplicates */ }
    }
    counts.students = inserted;
  }

  // ─── Step 7: Restore mark records ──────────────────────
  emit("Restoring mark records…");
  type MarkRow = {
    studentId: string; term: string; year: number;
    marks: Record<string, number | null>; updatedBy: string;
  };
  const markRecords = backupData.markRecords as MarkRow[] | undefined;
  if (markRecords?.length) {
    let inserted = 0;
    for (const r of markRecords) {
      const newStudentId = studentIdMap.get(r.studentId);
      if (!newStudentId) continue;
      try {
        await prisma.markRecord.create({
          data: {
            studentId: newStudentId,
            term: r.term as import("@prisma/client").Term,
            year: r.year,
            marks: r.marks,
            updatedBy: r.updatedBy,
          },
        });
        inserted++;
      } catch { /* skip duplicates */ }
    }
    counts.markRecords = inserted;
  }

  // ─── Step 8: Merge users ───────────────────────────────
  emit("Merging user accounts…");
  type UserRow = {
    name: string; email: string; passwordHash: string;
    role: string; isActive: boolean;
  };
  const users = backupData.users as UserRow[] | undefined;
  if (users?.length) {
    let merged = 0;
    for (const u of users) {
      try {
        await prisma.user.upsert({
          where: { email: u.email },
          update: {},
          create: {
            name: u.name,
            email: u.email,
            passwordHash: u.passwordHash,
            role: u.role as import("@prisma/client").Role,
            isActive: u.isActive,
          },
        });
        merged++;
      } catch { /* skip */ }
    }
    counts.users = merged;
  }

  if (errors.length > 0) {
    counts._warnings = errors.length;
  }

  return counts;
}
