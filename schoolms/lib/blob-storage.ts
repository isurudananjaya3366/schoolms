/**
 * Blob storage utilities for file uploads (signatures, school logo).
 * Uses Vercel Blob with token from secure settings (works on free tier).
 */

import { put, del, list } from "@vercel/blob";
import { getSecureSetting } from "@/lib/secure-settings";

/**
 * Get the Vercel Blob token from secure settings or env fallback.
 * Returns null if not configured.
 */
export async function getBlobToken(): Promise<string | null> {
  const token = await getSecureSetting("BLOB_READ_WRITE_TOKEN");
  return token || null;
}

/**
 * Upload a file to Vercel Blob storage.
 * @param pathname - The path/name for the blob (e.g. "signatures/11B-teacher.png")
 * @param file - The file data (Buffer, Blob, ReadableStream, etc.)
 * @param contentType - MIME type of the file
 * @returns The public URL of the uploaded blob, or null if blob storage not configured
 */
export async function uploadBlob(
  pathname: string,
  file: Buffer | Blob | ReadableStream | ArrayBuffer,
  contentType?: string
): Promise<string | null> {
  const token = await getBlobToken();
  if (!token) return null;

  const { url } = await put(pathname, file, {
    access: "public",
    token,
    contentType,
  });

  return url;
}

/**
 * Delete a blob by its URL.
 */
export async function deleteBlob(url: string): Promise<void> {
  const token = await getBlobToken();
  if (!token) return;

  await del(url, { token });
}

/**
 * List all blobs with an optional prefix.
 */
export async function listBlobs(prefix?: string) {
  const token = await getBlobToken();
  if (!token) return { blobs: [] };

  return list({ prefix, token });
}
