/**
 * Secure settings storage — encrypted key-value pairs in MongoDB.
 * Falls back to process.env when a DB value isn't set.
 *
 * All values are encrypted at rest using AES-256-GCM (see lib/encryption.ts).
 * An in-memory cache with 5-minute TTL avoids repeated DB queries.
 */

import prisma from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

// ─── Key definitions ─────────────────────────────────────

export interface SecureKeyMeta {
  key: string;
  label: string;
  group: string;
  description: string;
  isSensitive: boolean; // mask in UI
}

export const SECURE_KEYS: SecureKeyMeta[] = [
  // Email — Resend
  {
    key: "RESEND_API_KEY",
    label: "Resend API Key",
    group: "Email",
    description: "Resend email service API key",
    isSensitive: true,
  },

  // Email — SMTP
  {
    key: "SMTP_HOST",
    label: "SMTP Host",
    group: "Email",
    description: "SMTP server hostname (fallback email provider)",
    isSensitive: false,
  },
  {
    key: "SMTP_PORT",
    label: "SMTP Port",
    group: "Email",
    description: "SMTP server port (default: 587)",
    isSensitive: false,
  },
  {
    key: "SMTP_USER",
    label: "SMTP Username",
    group: "Email",
    description: "SMTP authentication username",
    isSensitive: false,
  },
  {
    key: "SMTP_PASS",
    label: "SMTP Password",
    group: "Email",
    description: "SMTP authentication password",
    isSensitive: true,
  },
  {
    key: "EMAIL_FROM",
    label: "Sender Email",
    group: "Email",
    description: "Sender email address (e.g. SchoolMS <noreply@yourdomain.com>)",
    isSensitive: false,
  },

  // Blob Storage (for signatures, logo upload)
  {
    key: "BLOB_READ_WRITE_TOKEN",
    label: "Vercel Blob Token",
    group: "Blob Storage",
    description: "Vercel Blob read/write token for file uploads (signatures, logo). Works on free tier.",
    isSensitive: true,
  },

  // Rate Limiting (Coming Soon)
  {
    key: "UPSTASH_REDIS_REST_URL",
    label: "Upstash Redis URL",
    group: "Rate Limiting",
    description: "Upstash Redis REST URL for rate limiting",
    isSensitive: true,
  },
];

// ─── In-memory cache ─────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function clearSecureSettingsCache() {
  cache.clear();
}

// ─── Core read / write ───────────────────────────────────

/**
 * Get a secure setting value. Checks in order:
 * 1. In-memory cache
 * 2. Database (SecureSetting table) — decrypted
 * 3. Falls back to process.env[key]
 *
 * Returns empty string if not found anywhere.
 */
export async function getSecureSetting(key: string): Promise<string> {
  // 1. Check cache
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // 2. Check database
  try {
    const row = await prisma.secureSetting.findUnique({ where: { key } });
    if (row) {
      const decrypted = decrypt(row.value);
      cache.set(key, {
        value: decrypted,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return decrypted;
    }
  } catch {
    // DB may be unreachable during build or test; fall through silently
  }

  // 3. Fallback to process.env
  const envVal = process.env[key] ?? "";
  if (envVal) {
    cache.set(key, {
      value: envVal,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
  return envVal;
}

/**
 * Set (upsert) a secure setting in the database.
 * The value is encrypted before storage. An empty string deletes the key.
 */
export async function setSecureSetting(
  key: string,
  plainValue: string
): Promise<void> {
  if (!plainValue) {
    // Delete the key if value is empty
    await prisma.secureSetting
      .delete({ where: { key } })
      .catch(() => {
        /* not found — fine */
      });
    cache.delete(key);
    return;
  }

  const encrypted = encrypt(plainValue);

  await prisma.secureSetting.upsert({
    where: { key },
    update: { value: encrypted },
    create: { key, value: encrypted },
  });

  // Update cache
  cache.set(key, {
    value: plainValue,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Get all stored secure-setting keys (without values) plus whether
 * each key has a DB value or an env fallback. Used by the settings UI.
 */
export async function getSecureSettingsStatus(): Promise<
  Record<string, { hasDbValue: boolean; hasEnvFallback: boolean }>
> {
  const rows = await prisma.secureSetting.findMany({
    select: { key: true },
  });
  const dbKeys = new Set(rows.map((r: { key: string }) => r.key));

  const result: Record<
    string,
    { hasDbValue: boolean; hasEnvFallback: boolean }
  > = {};

  for (const meta of SECURE_KEYS) {
    result[meta.key] = {
      hasDbValue: dbKeys.has(meta.key),
      hasEnvFallback: !!process.env[meta.key],
    };
  }

  return result;
}
