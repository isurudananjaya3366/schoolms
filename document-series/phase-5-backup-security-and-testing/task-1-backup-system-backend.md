# Task 5.1 — Backup System Backend

**Phase:** 5 — Backup, Security Hardening, and Testing
**Task Number:** 5.1 of 4
**Complexity:** High
**Depends On:** All phases 1–4 operational. Prisma schema stable. SystemConfig collection seeded.

---

## Objective

Implement the entire backup infrastructure backend for SchoolMS, covering storage abstraction, Prisma data export utility, JSON serialisation, gzip compression, API route handlers, retention cleanup, Vercel Cron configuration, and failure alerting via Resend. This task establishes all server-side plumbing needed before a backup management UI can be built. It produces no visible UI changes on its own.

---

## Deliverables

- `lib/backup.ts` — Storage abstraction layer and backup orchestration utility containing all provider detection, export, compression, upload, download, delete, and list logic.
- `app/api/backup/route.ts` — GET handler (cron-triggered backup) and POST handler (manual SUPERADMIN-triggered backup).
- `app/api/backup/list/route.ts` — GET handler that returns the backup history array from SystemConfig.
- `app/api/backup/[fileId]/route.ts` — DELETE handler that removes a single backup from storage and from SystemConfig history.
- `app/api/backup/restore/route.ts` — POST handler that downloads, decompresses, parses, and re-inserts backup data using Prisma createMany.
- `vercel.json` — Updated to include the cron schedule entry for the nightly backup at 2:00 AM UTC.
- Updates to `lib/prisma.ts` if any helper types or re-exports are needed to support the backup utility.

---

## Context and Background

The backup system is designed to run automatically once per day via Vercel Cron. When triggered, it exports all five primary MongoDB collections through the existing Prisma client, serialises the result to JSON, compresses it with Node.js gzip, and uploads the compressed buffer to either AWS S3 or Vercel Blob depending on which environment variables are present. A metadata record for each backup is written into the SystemConfig document so that the application has a persistent history of all backup attempts without needing a separate collection.

Failures at any stage of the pipeline must not be silent. When the backup pipeline throws an error, the system queries all users with the SUPERADMIN role, extracts their email addresses, and delivers a plain-language alert email via Resend. The email includes the school name, a human-readable error description, and the timestamp of the failed attempt. Stack traces are intentionally excluded from the email body and are instead written as structured entries in the AuditLog collection so they can be reviewed inside the application.

SUPERADMIN users are not limited to the scheduled backup cadence. The POST handler on the same route allows any authenticated SUPERADMIN to trigger a manual backup at any time. The pipeline executed during a manual backup is identical to the cron-triggered pipeline, including the retention cleanup pass and the SystemConfig history update. Both routes return a consistent response shape so that a future UI component can consume them uniformly.

The restore endpoint provides a safe recovery path by using Prisma's createMany with the skipDuplicates option set to true. This means re-inserting a backup over a database that already contains some of those records will not throw duplicate key errors; it will simply skip the records that already exist and insert those that are missing. This approach is intentionally non-destructive: the restore does not wipe existing data before inserting. This is a deliberate design decision that must be clearly communicated in the restore API response.

---

## Storage Abstraction Layer (`lib/backup.ts`)

### Provider Detection Logic

At module initialisation time, the storage layer inspects the process environment to determine which provider to use. The detection order is deliberate and must not be changed without updating documentation. First, the module checks for the simultaneous presence of `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET`. All three must be non-empty strings for the S3 provider to be selected. If any one of the three is absent or empty, the S3 path is bypassed entirely.

If S3 is not available, the module checks for `BLOB_READ_WRITE_TOKEN`. If that variable is present, the Vercel Blob provider is selected. Vercel Blob is treated as the fallback provider because it requires only a single environment variable and is native to the Vercel deployment environment. If neither provider can be configured, the module sets an internal flag indicating a misconfiguration. The backup pipeline checks this flag before beginning the export phase. If the flag is set, the pipeline aborts immediately and records the misconfiguration as the failure reason, rather than exporting data and then failing during upload.

### Abstracted Operations

The storage abstraction exposes exactly four operations to the rest of the application. All four operations are asynchronous and return promises.

- `uploadBackup(buffer, filename)` — accepts a Node.js Buffer containing the compressed backup data and a string filename, and returns a string fileId that uniquely identifies the upload in the chosen storage provider.
- `downloadBackup(fileId)` — accepts the fileId string and returns a Node.js Buffer containing the raw bytes of the stored file.
- `deleteBackup(fileId)` — accepts the fileId string and removes the file from storage, returning void on success.
- `listBackupsFromStorage()` — returns an array of objects, each containing at minimum the fileId and any available metadata such as size, upload timestamp, and content type.

All four operations are implemented twice internally — once for S3 and once for Vercel Blob — and the provider flag set during initialisation determines which implementation is called. The backup routes import only these four named exports and have no direct dependency on any SDK-specific type or client instance.

### S3 Specifics

When S3 is the active provider, backup files are stored under a consistent key prefix. The key pattern is `backups/schoolms-backup-YYYY-MM-DD-HHmmss.json.gz`, where the timestamp reflects the UTC time at which the backup was initiated. Upload is performed using the `PutObjectCommand` from `@aws-sdk/client-s3`, with the content type set to `application/gzip`. Download is performed by generating a presigned URL using `GetObjectCommand` with an expiry of 3600 seconds (one hour), then fetching the URL's response body and converting it to a Buffer. Delete is performed using `DeleteObjectCommand` with the file's S3 object key as the identifier. The fileId stored in SystemConfig for S3 backups is the full S3 object key, not a numeric or UUID identifier.

### Vercel Blob Specifics

When Vercel Blob is the active provider, upload is performed using the `put()` function from `@vercel/blob`. The access setting must be `private` — not `public` — to prevent the backup URL from being accessible without authentication. The `put()` call returns a blob object whose `url` property serves as the fileId stored in SystemConfig. Download retrieves the stored URL from SystemConfig history and performs a server-side fetch to obtain the response buffer. Delete is performed using the `del()` function from `@vercel/blob`, passing the stored URL directly. The fileId for Vercel Blob backups is therefore a full HTTPS URL, whereas for S3 it is an object key path.

---

## Backup Orchestration (`lib/backup.ts` continued)

### Export Strategy

The export function runs six sequential Prisma queries: one `findMany` for each of the five collections, plus a `count` call for metadata. The five collections queried are `users`, `classGroups`, `students`, `markRecords`, and `systemConfig`. No filters, pagination, or field selection is applied — all fields of all records are exported. This guarantees a complete snapshot and avoids the risk of partial data caused by a filter that does not match expected values after a schema change.

The results are assembled into a single JavaScript object. The outer object has a `meta` key and five collection keys, each containing its respective array. Assembling everything into one object before serialisation ensures the backup file is a single valid JSON document that can be parsed atomically on restore.

All ObjectId fields are handled automatically by the Prisma MongoDB connector, which returns them as plain strings. All DateTime fields are returned as JavaScript Date objects by Prisma, and JSON.stringify converts them to ISO 8601 strings automatically. No manual type coercion should be necessary, but the Developer Notes section below flags this as a point requiring verification during testing.

### Backup Meta Object

The meta object embedded at the top of every backup file contains the following fields:

| Field | Type | Description |
|---|---|---|
| version | string | Fixed value "1.0" — incremented only on schema changes to the backup format |
| timestamp | string | ISO 8601 UTC string of the moment the export began |
| schoolName | string | Value of the schoolName field from the SystemConfig document |
| totalStudents | number | Integer count of all student records at the time of export |
| totalMarkRecords | number | Integer count of all mark record entries at the time of export |

### Compression

After the data object is assembled and serialised to a JSON string, the string is converted to a Buffer and compressed using Node.js's built-in `zlib.gzip()`. Because `zlib.gzip()` uses a callback pattern, it must be wrapped in a Promise — either manually or using `util.promisify` — before it can be used cleanly in the async export pipeline. The compressed Buffer is what gets passed to `uploadBackup`. The original JSON string is not retained in memory after compression.

### Backup Filename Format

The filename used for each backup follows the pattern `schoolms-backup-YYYY-MM-DDTHH-mm-ss.json.gz`. Colons are replaced with hyphens in the time component to ensure the filename is valid on Windows file systems, which do not permit colons in filenames. This matters because developers may download backups locally for inspection. The date and time values in the filename always reflect UTC.

---

## Retention Policy

After a successful upload, the backup pipeline performs a retention cleanup pass to prevent unbounded accumulation of backup files. The pipeline reads the current backup history array from SystemConfig. If the total number of entries in the array is 30 or fewer, no cleanup is performed. If the count exceeds 30, the array is sorted by the timestamp field in ascending order so that the oldest entries appear first. All entries beyond position 30 in the sorted array — meaning the oldest ones above the retention limit — are flagged for deletion.

For each flagged entry, the pipeline calls `deleteBackup()` with the entry's fileId to remove the file from the storage provider. Entries are deleted one at a time rather than in parallel to avoid rate-limiting issues with the storage APIs. After all deletions complete, the flagged entries are removed from the history array in memory. The trimmed array is then written back to the SystemConfig document using a Prisma update. If a delete call for a specific file throws an error, that file's entry should still be removed from the history array after logging the failure, to avoid the history referencing a file that may or may not exist.

---

## API Route Implementations

### GET `/api/backup` — Cron-Triggered Backup

This handler is called exclusively by the Vercel Cron scheduler. Authentication relies on a shared secret rather than a session. On every request, the handler reads the `Authorization` header and compares its value against the `CRON_SECRET` environment variable using a constant-time comparison function to prevent timing attacks. If the header is absent or the comparison fails, the handler returns a 401 response immediately without logging or alerting.

If the secret is valid, the handler invokes the full backup pipeline: export all collections, serialise, compress, upload, record in SystemConfig, and run retention cleanup. On success, the handler returns a 200 response containing the generated fileId, the compressed size in bytes, and the UTC timestamp. On any error caught from the pipeline, the handler writes an AuditLog entry with the error message and stack trace, sends the failure alert email to all SUPERADMIN addresses, and returns a 500 response with a generic error message that does not expose internal details.

### POST `/api/backup` — Manual Backup

This handler requires an authenticated NextAuth session with the SUPERADMIN role. The session is validated at the start of the handler using the standard `getServerSession()` call. If the session is absent or the user role is not SUPERADMIN, the handler returns a 403 response. Authenticated SUPERADMIN users trigger the identical backup pipeline used by the cron handler. There is no distinction in the stored metadata between a cron-triggered backup and a manually triggered one. The response structure is the same as the GET handler on success and failure.

### GET `/api/backup/list` — Backup History

This handler requires an authenticated SUPERADMIN session. It reads the backup history array directly from the SystemConfig document in MongoDB via Prisma. The array is sorted in memory by the timestamp field in descending order so that the most recent backup appears first. The sorted array is returned as the response body. Each entry in the array contains the following fields:

| Field | Description |
|---|---|
| fileId | Storage provider identifier for the backup file |
| filename | Human-readable filename with timestamp |
| timestamp | ISO string of when the backup was created |
| sizeBytes | Compressed file size in bytes |
| storageProvider | Either "s3" or "vercel-blob" |
| status | Either "success" or "failed" |

### DELETE `/api/backup/[fileId]` — Delete Backup

This handler requires an authenticated SUPERADMIN session. The fileId is read from the dynamic route segment. Before calling the storage provider, the handler looks up the fileId in the SystemConfig backup history array to confirm it exists. If the fileId is not found in the history, a 404 response is returned. This prevents deletion attempts against arbitrary storage keys that are not tracked by the application. If the fileId exists, `deleteBackup()` is called. On success, the entry is removed from the SystemConfig history array via a Prisma update, an AuditLog entry of type `BACKUP_DELETED` is written, and a 200 response is returned.

### POST `/api/backup/restore` — Restore from Backup

This handler requires an authenticated SUPERADMIN session. The request body must contain the fileId of the backup to restore. The handler first looks up the fileId in SystemConfig history to retrieve its metadata, then calls `downloadBackup(fileId)` to retrieve the compressed buffer. The buffer is decompressed using `zlib.gunzip()` (wrapped in a Promise), and the resulting string is parsed as JSON.

For each of the five collection arrays in the parsed object, the handler calls Prisma `createMany` with `skipDuplicates: true`. The collections are restored in dependency order: `systemConfig` first, then `users`, then `classGroups`, then `students`, then `markRecords`. This order reduces the chance of foreign key constraint issues if the schema is extended with relational constraints in the future.

After all five `createMany` calls complete, the handler writes an AuditLog entry of type `RESTORE_COMPLETED` that includes the per-collection insertion counts and the original timestamp of the restored backup. The handler then returns a 200 response with an object summarising how many records were inserted per collection. If any step throws an error, an AuditLog entry of type `RESTORE_FAILED` is written and a 500 response is returned. The response for a failed restore does not include partial insertion counts.

---

## Vercel Cron Configuration

Add a `crons` array to the `vercel.json` file at the project root. The cron entry specifies the path `/api/backup` and the schedule `"0 2 * * *"`, which runs once daily at 2:00 AM UTC. If a `vercel.json` file does not yet exist at the project root, it must be created with the appropriate top-level structure before adding the crons array.

Vercel Cron jobs execute automatically only on Pro and Enterprise plans. On the Hobby plan, the cron entry is recognised and validated by Vercel but is never triggered automatically. The backup management UI built in a later task must display a visible notice to users on Hobby-plan deployments informing them that the automatic schedule is inactive and that manual backups via the POST endpoint must be used instead. The detection of the plan tier can be approximated by reading a `VERCEL_ENV` environment variable or by providing a `NEXT_PUBLIC_CRON_ENABLED` flag in the environment configuration.

---

## Failure Alert Email

When the backup pipeline catches any thrown error, the alert sequence begins immediately after the AuditLog entry is written. The pipeline queries Prisma for all user records where the role field equals `SUPERADMIN`. The `email` field is extracted from each result. If no SUPERADMIN users exist in the database, the alert sequence is skipped silently — this condition should itself be logged as a warning in the AuditLog.

The email is sent via Resend using the `RESEND_API_KEY` environment variable. The sender address should match the configured from address used elsewhere in the application for consistency. The subject line is fixed as `"SchoolMS Backup Failed"`. The email body includes three pieces of information: the school name retrieved from SystemConfig, the error message string from the caught exception, and the UTC timestamp of the failed attempt formatted in a human-readable way. Stack traces, internal file paths, and environment variable names must not appear in the email body. These details are available in the AuditLog for users who have dashboard access.

---

## Acceptance Criteria

1. Running the GET `/api/backup` route with the correct `CRON_SECRET` in the Authorization header completes without error and produces a new entry in the SystemConfig backup history array.
2. Running the GET `/api/backup` route with an incorrect or missing Authorization header returns 401 and produces no backup attempt.
3. Calling POST `/api/backup` as an authenticated SUPERADMIN produces a backup identical in content and structure to a cron-triggered backup.
4. Calling POST `/api/backup` without a valid SUPERADMIN session returns 403.
5. A backup file can be downloaded via `downloadBackup()`, decompressed, and parsed as valid JSON with all five collection arrays present and a valid meta object.
6. The backup history returned by GET `/api/backup/list` is sorted most-recent-first and contains all fields specified in the route documentation.
7. Deleting a backup via DELETE `/api/backup/[fileId]` removes the entry from the SystemConfig history array and from the storage provider.
8. Calling DELETE `/api/backup/[fileId]` with a fileId that does not exist in SystemConfig returns 404.
9. Running POST `/api/backup/restore` with a valid fileId re-inserts missing records and returns per-collection insertion counts.
10. Running POST `/api/backup/restore` on a database that already contains all records in the backup results in zero insertions across all collections and a 200 response — not an error.
11. If the backup pipeline fails, all SUPERADMIN email addresses receive an alert email from Resend within the same request lifecycle.
12. After the total backup count exceeds 30, the oldest backups beyond the retention limit are deleted from storage and removed from SystemConfig history on the next successful backup run.

---

## Notes and Pitfalls

- MongoDB ObjectIds are returned as strings by the Prisma MongoDB connector, but this behaviour should be explicitly verified with a small test during initial development — if a newer version of Prisma changes this behaviour, JSON.stringify will produce non-string values in the backup file that will fail to restore cleanly via createMany.
- The `zlib.gzip` and `zlib.gunzip` functions in Node.js are callback-based APIs; using them without wrapping in `util.promisify` or the Promise-based stream form will cause confusing bugs where the pipeline returns before compression or decompression completes — always verify the async wrapping before testing the full pipeline.
- The constant-time comparison for `CRON_SECRET` must use `crypto.timingSafeEqual` rather than a plain string equality check; timing attacks against string comparison are a known vulnerability in webhook and cron authentication patterns, and this is a low-effort fix with meaningful security benefit.
- If the SystemConfig document does not yet have a `backupHistory` field when the first backup runs, the export step will read `undefined` rather than an empty array; the backup pipeline must initialise this field to an empty array using an upsert or conditional update before attempting to push the new entry.
- The restore endpoint is not transactional — if `createMany` for `markRecords` succeeds but a subsequent step fails, the already-inserted documents remain in the database; this is a known and accepted limitation that must be documented explicitly in the restore response body so that SUPERADMIN users understand partial restores are possible and can take corrective action manually.
