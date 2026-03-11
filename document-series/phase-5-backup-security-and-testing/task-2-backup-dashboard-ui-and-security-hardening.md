# Task 5.2 — Backup Dashboard UI and Security Hardening

**Phase:** 5 — Backup, Security Hardening, and Testing
**Task Number:** 5.2 of 4
**Complexity:** High
**Depends On:** Task 5.1 complete (all backup API routes operational)

---

## Objective

Build the `/dashboard/backup` page with full UI for managing, triggering, and restoring backups. Implement rate limiting using Upstash Redis with an in-memory fallback for development, add HTTP security headers to harden the application against common browser-based attacks, and perform a one-time secrets audit to confirm no credentials leak through logs, source control, or build output.

---

## Deliverables

- `app/dashboard/backup/page.tsx` — the server component that enforces SUPERADMIN access and renders the backup dashboard shell
- `app/dashboard/backup/_components/StatusBanner.tsx` — client component displaying the most recent backup state
- `app/dashboard/backup/_components/BackupHistoryTable.tsx` — paginated history table with download, restore, and delete actions
- `app/dashboard/backup/_components/RestoreDialog.tsx` — confirmation modal with typed confirmation gate
- `app/dashboard/backup/_components/ConfigureBackupForm.tsx` — cron, storage provider, and email alert configuration form
- `app/dashboard/backup/_components/ManualBackupButton.tsx` — one-click trigger button with loading state
- `lib/rate-limit.ts` — shared utility wrapping route handlers with Upstash Redis or in-memory rate limiting
- `next.config.js` — updated with a `headers()` export adding five security response headers
- `middleware.ts` — updated to apply the rate limiting wrapper to login and password-reset routes
- `documents/secrets-audit-checklist.md` — completed and signed-off audit record

---

## Backup Dashboard Page

### Access Control

The page is restricted to the SUPERADMIN role only. The `middleware.ts` role guard intercepts requests to `/dashboard/backup` and redirects any authenticated session whose role is not SUPERADMIN to `/dashboard`. The server component itself performs a second check: it reads the session via `getServerSession`, inspects the role field, and calls `redirect('/dashboard')` if the role is insufficient. This double-layer defence ensures that neither a missing middleware configuration nor a direct server-side fetch can leak the page to unauthorised users.

### Status Banner Section

A prominent banner renders at the very top of the page content area, above all other widgets. The banner has two visual states:

- **Success state** — displayed with a green or neutral background. Shows the date of the last successful backup, the time in UTC, the file size in megabytes, and the name of the storage provider used (AWS S3 or Vercel Blob).
- **Failed state** — displayed with a red alert background. Shows the timestamp of the most recent failure and the recorded error message returned by the backup job.

The banner derives its state by calling `GET /api/backup/list` and examining the most recent entry in the returned array. A "Run Health Check" button sits inside the banner. Clicking it invalidates the cached list, re-fetches, and updates the banner without a full page reload. The banner must be the first visible content element above the fold on all screen sizes.

### Backup History Table

A paginated table renders below the status banner. The table is sorted most-recent-first by default.

| Column | Description |
|---|---|
| Date | Date of the backup attempt in local display format |
| Time UTC | Time of the backup attempt displayed in Coordinated Universal Time |
| File Size | Compressed backup file size in megabytes |
| Status | Colour-coded badge — green for Success, red for Failed |
| Storage Location | Short label indicating AWS S3 or Vercel Blob |
| Actions | Three inline controls per row |

The Actions column contains three controls per row:

- **Download** — Fetches or opens a presigned URL (for S3) or a direct Vercel Blob URL. Opens the download in a new tab.
- **Restore** — Opens the restore confirmation dialog for the selected backup row. Does not perform any operation immediately.
- **Delete** — Displays an inline "Are you sure?" confirmation before calling `DELETE /api/backup/[fileId]`. On confirmation, the row is removed from the table without a full reload.

When no backups have been created yet, the table body is replaced with a centred empty-state illustration and a short message instructing the user to run their first manual backup.

### Restore Confirmation Dialog

The dialog opens in response to clicking the Restore button on any table row. It is a modal overlay and must trap focus while open. The dialog body contains:

- The date and time of the selected backup, displayed prominently at the top of the modal.
- A plain-language explanation stating that the restore operation adds missing records to the live database without overwriting any records that already exist. The operation is additive only.
- A text input labelled "Type RESTORE to confirm". The placeholder text shows the expected value.
- A Confirm button that remains disabled until the input value exactly equals the string `RESTORE` (case-sensitive). Partial matches or lowercase variants do not satisfy the condition.

When Confirm is clicked, the dialog calls `POST /api/backup/restore` with the selected `fileId`. A loading spinner replaces the Confirm button during the operation. On a successful response, the dialog closes and a toast notification appears listing the number of records inserted per collection. On failure, the dialog remains open and a red error toast displays the error message returned by the API.

### Configure Backup Section

Rendered below the history table. This section allows SUPERADMIN to adjust the backup schedule, storage target, and notification recipients without editing environment variables. The form contains:

- A cron expression text input. Beneath the input, a real-time human-readable interpretation renders as the user types (for example, "Every day at 2:00 AM UTC"). This preview uses a cron-parser library to translate the expression. If the entered expression is syntactically invalid, a red validation error message appears below the input and the submit button is disabled.
- A radio group labelled "Storage Provider" with two options: AWS S3 and Vercel Blob. The AWS S3 option is shown as disabled with a tooltip if the required AWS environment variables are absent from the runtime. The Vercel Blob option is shown as disabled if `BLOB_READ_WRITE_TOKEN` is absent.
- An email list editor allowing the SUPERADMIN to add or remove alert recipient addresses. Each address renders as a removable chip. An "Add" input is used to append new addresses.

Submitting the form sends a `PATCH /api/backup/config` request with the updated fields. On success, an `AuditLog` entry with action `CONFIG_CHANGED` is written through the API. The form shows a success toast on completion and an error toast on failure.

### Manual Backup Now Button

A clearly labelled button is placed within the status banner area or immediately adjacent to it. Clicking the button calls `POST /api/backup`. The button transitions to a loading state with a spinner and its label changes to "Backing up…". It is disabled while the operation is in progress to prevent duplicate requests. When the API responds, a success toast or failure toast is shown. The backup history table then re-fetches its data to reflect the new entry.

### Vercel Hobby Plan Notice

If the environment variable `VERCEL_PLAN` is absent or set to a value indicating the Hobby tier, an informational banner is displayed directly below the page title and above the status banner. The banner uses a neutral yellow or blue background to distinguish it from error states. The text explains that Vercel cron jobs do not execute automatically on the Hobby plan and that the Configure Backup section's cron schedule will have no effect. It directs the user to use the Manual Backup Now button as the only available trigger on this plan.

---

## Rate Limiting Implementation (lib/rate-limit.ts)

### Architecture Overview

The rate limiter is a utility function that wraps API route handlers. It accepts three configuration parameters: a key prefix that identifies the specific endpoint being protected, a limit representing the maximum number of allowed requests, and a window expressed in seconds defining the sliding or fixed time interval. On each invocation, the utility extracts the client IP address from the incoming request headers (checking `x-forwarded-for` first, then falling back to the request connection address). It constructs a namespaced Redis key from the prefix and the IP, checks the current count, increments it, and either allows the request to proceed to the inner handler or returns a short-circuit 429 response with a `Retry-After` header.

### Upstash Redis Integration

When both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present in the environment, the utility instantiates an Upstash Redis client using the `@upstash/redis` package. The counter logic uses a Redis pipeline that issues an INCR command followed by an EXPIRE command set to the configured window. On the very first request in a new window, the INCR creates the key with a count of 1 and EXPIRE sets the TTL. On subsequent requests within the same window, INCR increments the existing key and EXPIRE refreshes its TTL only on the initial set. The utility reads the INCR result after the pipeline executes and compares it against the configured limit.

### In-Memory Fallback

When Upstash credentials are absent, the utility falls back to a module-level `Map` stored in the Node.js process memory. Each map entry uses the full namespaced key and stores an object containing a numeric count and a numeric `expiresAt` timestamp in milliseconds. On each call, the utility first evicts any entries whose `expiresAt` is in the past. It then looks up the current entry for the key, creates a fresh entry if none exists, increments the count, and evaluates against the limit. This fallback is suitable for local development only and should not be relied upon in production because process restarts clear the state and multiple serverless instances do not share memory. A console warning is emitted at startup noting that the Redis-backed rate limiter is inactive.

### Applied Rate Limits

Three route categories are protected:

| Route | Limit | Window |
|---|---|---|
| `POST /api/auth/signin` (login) | 5 requests | 15-minute window per IP |
| `POST /api/auth/password-reset` | 3 requests | 1-hour window per IP |
| `PATCH /api/backup/config` (system config submit) | 5 requests | 1-hour window per IP |

Each route handler invokes the `withRateLimit` wrapper at the top of the handler function before any database or business logic executes.

### 429 Response Format

When the rate limit is exceeded the utility returns a response with:

- HTTP status code 429
- A `Retry-After` header set to the integer number of seconds remaining until the current window expires and the counter resets
- A JSON body containing a `message` field with a human-readable explanation of the rate limit exceeded condition, including the limit and the window duration

---

## HTTP Security Headers (next.config.js)

### Headers Overview

Five response headers are configured inside the `headers()` async function exported from `next.config.js`. The function returns an array with a single entry whose `source` pattern matches all routes. All five headers are applied to every response served by the Next.js application, including API routes and page routes.

### Content-Security-Policy

The CSP header restricts what resources the browser may load and execute. Its directive structure follows:

- Script sources are limited to the same origin and the application's Vercel deployment domain. No inline scripts are permitted.
- Object sources are set to none, blocking all plugin-based content embeds such as Flash or PDF viewers.
- Style sources are limited to the same origin only. Inline styles may need a nonce or hash exception if any third-party UI library injects them.
- Image sources permit the same origin and inline data URIs. External image domains used by the application (such as a school logo host) must be explicitly listed here.
- Frame ancestors are set to none, which reinforces the X-Frame-Options header at the CSP level and prevents any framing by external origins.
- The `upgrade-insecure-requests` directive is included to cause the browser to automatically rewrite HTTP subresource requests to HTTPS.

### X-Frame-Options

Set to `DENY`. This legacy header instructs the browser to refuse to render the application inside any `<iframe>` or `<frame>` element regardless of the requesting origin. It provides a fallback clickjacking mitigation for browsers that do not fully interpret the CSP `frame-ancestors` directive.

### X-Content-Type-Options

Set to `nosniff`. This header prevents the browser from performing MIME-type sniffing on responses. Without it, a browser might execute a file with an incorrect content type — for example, treating an uploaded text file as an executable script — which is a relevant risk given that the application handles user-uploaded school logo files.

### Referrer-Policy

Set to `strict-origin-when-cross-origin`. Under this policy, the full URL including path is sent in the `Referer` header only for same-origin navigation. For cross-origin requests over HTTPS, only the origin (scheme and host) is sent. For requests to HTTP destinations or downgrades from HTTPS, no referrer information is sent at all. This policy balances analytics utility with privacy protection.

### Permissions-Policy

Restricts browser feature access for the application origin and all embedded content. Three features are fully disabled by assigning them empty allow lists:

- `camera` — no origin may access the device camera through this application
- `microphone` — no origin may access the device microphone
- `geolocation` — no origin may request the user's physical location

These restrictions are appropriate for a school management system that has no legitimate use for any of these hardware APIs.

---

## Secrets Audit

### Audit Checklist

This is a one-time manual review step performed before any production deployment. The developer completing the audit records the date and their name in `documents/secrets-audit-checklist.md` and marks each item as confirmed. The eight items to verify are:

1. `DATABASE_URL`, `NEXTAUTH_SECRET`, `VERCEL_API_TOKEN`, `CRON_SECRET`, AWS access key and secret, `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RESEND_API_KEY` are all stored exclusively in Vercel project environment variables. None of these values appear in any source file, configuration file, or committed document.

2. No API route, middleware function, or utility module logs any of the above values at any log level — not even the first or last few characters as a debug hint.

3. The repository's `.gitignore` file explicitly excludes `.env`, `.env.local`, `.env.production`, `.env.development`, and any other dot-env variant files from being tracked by git.

4. The Prisma `schema.prisma` file contains no hardcoded `datasource` URL string. The `url` field references the `DATABASE_URL` environment variable and only that.

5. No environment variable name or value appears in the static build output HTML, JavaScript bundles, or source maps. This can be verified by searching the `.next/static` build directory for known partial secret values.

6. The `NEXTAUTH_SECRET` value is unique to this project and has not been reused from any other application, tutorial, or template repository. A fresh value must be generated if there is any doubt.

7. The `CRON_SECRET` is at least 32 characters long and was generated using a cryptographically secure random generator, not a manually typed string or a dictionary word.

8. No GitHub Actions workflow file, repository secret configuration, or README document exposes any secret name-value pair in plaintext, including in commented-out job steps or example environment blocks.

---

## Acceptance Criteria

1. Navigating to `/dashboard/backup` as a TEACHER or ADMIN role results in an immediate redirect to `/dashboard` with no content briefly visible.
2. The status banner correctly displays green success state when the most recent backup entry has a success status, and red failed state when the most recent entry is a failure.
3. Clicking "Run Health Check" re-fetches the backup list and updates the banner contents without a full page navigation.
4. The history table lists all backup entries sorted newest-first and renders the Status badge in the correct colour for each row.
5. Clicking Delete on a table row prompts for confirmation and, after confirmation, removes the entry from the table and calls the delete API.
6. The Restore dialog's Confirm button remains disabled until the user has typed the exact string `RESTORE` in the confirmation input.
7. After a successful restore, a toast displays per-collection insert counts and the dialog closes.
8. The cron expression input in the Configure Backup section shows a human-readable preview in real time and displays a red validation error for invalid expressions.
9. The `withRateLimit` wrapper returns HTTP 429 with a `Retry-After` header after the configured threshold is reached for the login route.
10. All five security headers appear in every page and API response with the correct directive values when inspected in browser developer tools or a curl response.
11. The in-memory fallback activates and logs a startup warning when `UPSTASH_REDIS_REST_URL` is absent from the environment.
12. All eight items in `documents/secrets-audit-checklist.md` are marked confirmed with a recorded date before the production deployment tag is created.

---

## Notes and Pitfalls

- The Content-Security-Policy header will break inline scripts injected by the Recharts library if any chart component uses inline `style` attributes or inline event handler patterns. Audit all chart components in the analytics phase for inline handlers and convert them to class-based or external style references before deploying the CSP header in production.
- Upstash Redis INCR returns the value of the key after the increment has been applied. The comparison against the configured limit must happen after the increment is read, not before. Comparing the pre-increment value will allow one extra request beyond the intended limit on the boundary request.
- The restore confirmation dialog should be designed with a generous operation timeout. Large school databases may contain thousands of records across multiple collections, and the `createMany` calls for each collection may take several seconds to complete. Setting a short client-side timeout or showing a stalled spinner without progress indication will confuse users and may trigger duplicate restore attempts.
- The cron expression human-readable preview renderer must wrap the parser call in a try-catch block. Cron parsers throw synchronous exceptions on invalid input. An unhandled throw inside a React render or event handler will crash the component tree. The error should be caught and replaced with the validation error message display.
- If the application serves the school logo from an external domain using `next/image`, that domain must be added to the `images.domains` array (or `remotePatterns`) in `next.config.js` and also explicitly listed in the `img-src` directive of the Content-Security-Policy header. Failing to do both will cause the logo to fail to load in production because `next/image` rewrites the URL through the image optimisation endpoint, which the CSP will then block if the source domain is not whitelisted.
