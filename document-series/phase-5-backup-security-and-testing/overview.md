# Phase 5: Backup, Security Hardening, and Testing

**Document Version:** 1.0
**Phase Number:** 5 of 5
**Recommended Task Documents:** 4
**Status:** Final Phase — System Completion

---

## Phase Summary

Phase 5 is the final phase of the SchoolMS project. It concludes the system by implementing the automated backup infrastructure, completing the security hardening layer, building the audit log viewer, establishing a comprehensive multi-level testing strategy, and configuring the CI/CD pipeline for production readiness.

This phase transforms a feature-complete but operationally unprotected system into a production-grade, auditable, and resilient school management platform. At its conclusion, SchoolMS v1.0 is fully deployable to a real secondary school environment with confidence in data durability, security posture, and software quality.

The phase covers six primary domains. First, the automated daily backup system, which introduces a Vercel Cron Job that orchestrates structured JSON exports of all critical database collections, compresses them, stores them to cloud storage, and enforces a rolling 30-day retention window. Second, the backup dashboard UI, which gives SUPERADMIN users full visibility and control over backup history, scheduling, manual triggers, and restore operations. Third, the restore functionality, which safely re-imports backup data without destroying existing records. Fourth, security hardening, which introduces rate limiting via Upstash Redis across sensitive endpoints, adds HTTP security response headers, and performs a full audit of secrets management. Fifth, the audit log viewer, which builds the missing UI to expose the AuditLog collection that has been populated since Phase 2. Sixth, the full testing strategy, which implements unit tests with Vitest, integration tests with Vitest and mocked Prisma, end-to-end tests with Playwright across five critical user journeys, component tests with React Testing Library, and the GitHub Actions CI/CD pipeline that ties everything together.

---

## Phase Scope

### In Scope

- Vercel Cron Job configuration via vercel.json for daily automated backups
- Backup API routes: GET /api/backup, POST /api/backup, GET /api/backup/list, DELETE /api/backup/[fileId], POST /api/backup/restore
- Structured JSON backup serialisation of all five collections: users, classGroups, students, markRecords, systemConfig
- Gzip compression of backup artifacts using Node's zlib module
- Dual storage provider support: AWS S3 as primary, Vercel Blob Storage as fallback
- 30-day rolling retention policy with automated cleanup
- Failure alerting via Resend email to all SUPERADMIN email addresses
- Backup dashboard page at /dashboard/backup with status banner, history table, configuration section, and manual trigger
- Restore flow with confirmation dialog and createMany with skipDuplicates strategy
- Rate limiting middleware using Upstash Redis with in-memory fallback
- Rate limiting on: login attempts, password reset requests, and system config submissions
- HTTP security response headers via Next.js configuration
- Secrets audit confirming no environment variables are exposed in logs or source control
- Audit log viewer at /dashboard/settings/audit with pagination, filters, row detail expansion, and CSV export
- Vitest unit tests for pure utility functions
- Vitest integration tests for API route handlers against a Prisma mock
- Playwright end-to-end tests for five critical user journeys
- React Testing Library component tests for five key UI components
- Accessibility checks using axe-core via @axe-core/playwright
- GitHub Actions CI/CD pipeline for pull request validation and main branch deployment
- Vercel preview deployment configuration

### Out of Scope

- Incremental or differential backup strategies (v1.0 uses full snapshots only)
- Point-in-time restore beyond the 30 available daily snapshots
- Backup encryption at rest (storage provider encryption is assumed sufficient for v1.0)
- Full automated security penetration testing or vulnerability scanning
- Load testing or performance benchmarking
- Multi-region backup replication
- Two-factor authentication (deferred to future roadmap)
- Offline/PWA functionality
- Mobile-native application wrappers
- Any feature changes to Phases 1–4 functionality (Phase 5 is additive only)

---

## Phase Goals — Acceptance Criteria

A Phase 5 implementation is considered complete when all of the following criteria are satisfied.

The automated backup system triggers via Vercel Cron at 2:00 AM UTC daily, produces a valid gzipped JSON artifact, uploads it to the configured storage provider, and records the result in SystemConfig. The artifact decompresses to a valid JSON structure matching the defined backup file format.

When the backup process fails for any reason, an AuditLog entry is written recording the failure, and an alert email is dispatched via Resend to all SUPERADMIN email addresses registered in the system.

The backup dashboard at /dashboard/backup renders correctly for SUPERADMIN sessions and is inaccessible to all other roles. The dashboard displays the last backup status, full backup history, and enables manual backup triggering and restore operations.

The restore flow completes successfully: a SUPERADMIN can select a backup entry, confirm the restore by typing the word RESTORE, and the API re-inserts all records using skipDuplicates logic without deleting or overwriting any existing data. An AuditLog entry is written for the restore operation.

Rate limiting is active on the login, password reset, and config submission endpoints. Exceeding the configured threshold returns HTTP 429. Upstash Redis is used when configured; the in-memory fallback activates automatically when Upstash credentials are absent.

All five HTTP security headers are present in every application response: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

The audit log viewer at /dashboard/settings/audit renders paginated AuditLog entries, supports date range and action type filtering, expands row details in a modal, and exports filtered results as a CSV file.

All unit tests pass with Vitest. All integration tests pass against a Prisma mock. All five Playwright end-to-end journeys pass against the staging environment. All component tests pass with React Testing Library. Accessibility checks via axe-core report no critical WCAG 2.1 AA violations.

The GitHub Actions CI/CD pipeline passes all steps on every pull request and triggers automatic Vercel production deployment on every merge to main.

---

## Phase Prerequisites

Phase 5 builds on the completed output of all prior phases. The following must be fully operational before Phase 5 work begins.

From Phase 1: Next.js 14 project initialised, TypeScript configured, Prisma with MongoDB Atlas connected, NextAuth.js v5 authentication active with bcrypt password hashing, middleware enforcing route protection, Tailwind CSS configured, Vercel deployment active, all environment variables set in Vercel dashboard, basic project folder structure established.

From Phase 2: Admin dashboard shell, student management CRUD, user management, SystemConfig settings page, AuditLog collection defined in Prisma schema, audit log write operations embedded in all mutation routes across the system.

From Phase 3: Mark entry system, W-rule implementation, batch mark save API, view marks page, PDF progress report generation.

From Phase 4: Analytics page with all six visualisations, subject average comparison, grade distribution, attendance trend, marks heat map, student performance chart, Preview Mode with all eight slides.

Additionally, the following environment variables must be present or ready to be added: RESEND_API_KEY for email alerting, CRON_SECRET for Vercel Cron authentication, UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for rate limiting, and either AWS_ACCESS_KEY_ID plus AWS_SECRET_ACCESS_KEY plus AWS_S3_BUCKET for S3 storage or BLOB_READ_WRITE_TOKEN for Vercel Blob Storage.

A GitHub repository with the SchoolMS codebase is required for the GitHub Actions pipeline. A second MongoDB Atlas cluster (M0 free tier is sufficient) or a mock database solution must be available for integration and end-to-end test environments.

---

## Backup System Architecture

### Overview and Design Philosophy

The backup system follows a simple, auditable, and recovery-focused design. Rather than complex change-data-capture or differential approaches, SchoolMS v1.0 uses full daily snapshots of all operational collections. Given the data volume typical of a secondary school (hundreds of students, thousands of mark records), a full snapshot is small enough to compress and transfer in seconds. The predictability and simplicity of a full snapshot also makes restores straightforward and trustworthy.

The system is composed of five integrated components: the Vercel Cron trigger, the backup API route orchestrator, the Prisma-powered export utility, the compression layer, and the storage abstraction layer.

### Vercel Cron Trigger

The cron job is configured as a path and schedule entry in vercel.json at the project root. The configured path is /api/backup and the schedule expression is "0 2 * * *", which means daily at 2:00 AM UTC. When the cron fires, Vercel sends an HTTP GET request to /api/backup and injects the CRON_SECRET header automatically using the value of the CRON_SECRET environment variable configured in the Vercel dashboard.

This trigger only functions automatically on Vercel Pro and Enterprise plans. On the free Hobby plan, the cron entry is parsed and validated but never fires automatically. The backup dashboard must detect the current Vercel plan context and display a visible notice when automatic backups will not execute.

### Backup API Route Orchestration

The /api/backup route handler at src/app/api/backup/route.ts is responsible for the entire backup pipeline. It accepts both GET (from cron) and POST (from Superadmin manual trigger via the dashboard) HTTP methods.

For GET requests, the route first validates the Authorization header containing the CRON_SECRET value. If the header is absent or does not match the stored secret, the route returns HTTP 401 immediately without proceeding. This prevents unauthorised external calls from triggering backups.

For POST requests, the route validates that the caller has a valid NextAuth session with SUPERADMIN role. If the session is invalid or the role is insufficient, the route returns HTTP 403.

Once authentication is satisfied, the route executes the backup pipeline in sequence: export all collections via Prisma, construct the backup JSON object with metadata, serialise to a JSON string, compress with gzip, upload to the configured storage provider, update SystemConfig with the new backup record, and run the retention cleanup to remove backups beyond the 30-entry limit.

If any step in the pipeline throws an error, the catch block writes a failure entry to the AuditLog collection and sends an alert email via the Resend API to all SUPERADMIN email addresses found in the users collection. The route then returns HTTP 500 with a generic error message.

### Export Strategy

The export utility queries all five collections using Prisma's findMany method with no filters, capturing every document. The collections exported are: users (all staff, admin, and superadmin accounts), classGroups (all class group definitions), students (all student records including soft-deleted ones), markRecords (all subject mark records across all terms), and systemConfig (the single configuration document).

The data is assembled into a structured JavaScript object. Each collection becomes a top-level key holding an array of its documents. A meta object is prepended containing identifying and statistical information about the snapshot.

### Compression Layer

Once the backup object is serialised to a JSON string, it is compressed using Node.js's built-in zlib.gzip() function. This typically reduces the file size by 60 to 70 percent for structured JSON data with repeated keys and patterns, which is characteristic of mark record arrays. The resulting buffer is what is actually uploaded to cloud storage.

The backup file is stored with a .json.gz extension. The filename follows the pattern: schoolms-backup-YYYY-MM-DD-HHmmss.json.gz where the timestamp is derived from the UTC time of backup creation.

### Retention Policy

After a successful upload, the backup route queries all existing backup file entries from SystemConfig. If the total count exceeds 30, the oldest entries beyond position 30 are identified and deleted from storage via the storage provider's delete API. Their records are also removed from the SystemConfig backup history array. This ensures storage costs remain bounded and the backup list remains manageable in the dashboard UI.

### Failure Alerting

If the backup pipeline fails, the system must not fail silently. The error handler queries the users collection for all users with SUPERADMIN role and extracts their email addresses. It then sends a formatted alert email via Resend with the subject "SchoolMS Backup Failed" and a body containing the error message, timestamp, and school name. This ensures that a system administrator is notified of backup failures even if they are not actively monitoring the dashboard.

---

## Backup File Format

The backup artifact, once decompressed, resolves to a single JSON object. This object has a defined structure that all restore logic must parse correctly.

The meta object contains the following fields: version (the string "1.0" to allow format versioning in future), timestamp (the ISO 8601 string of when the backup was created), schoolName (the value of the schoolName field from the SystemConfig document at backup time), totalStudents (the integer count of student documents included), and totalMarkRecords (the integer count of mark record documents included).

The remaining top-level keys are the collection arrays: users, classGroups, students, markRecords, and systemConfig. Each is an array of plain JavaScript objects representing the serialised Prisma model documents. All ObjectId fields are serialised as strings. All DateTime fields are serialised as ISO 8601 strings. These serialisation choices ensure the backup file is portable and not dependent on BSON types.

The version field in meta is important for forward compatibility. If a future SchoolMS version introduces a format "2.0", restore logic must check this field and apply the appropriate deserialisaton path. For v1.0, only format version "1.0" is valid.

---

## Storage Provider Strategy

The backup system must function with either AWS S3 or Vercel Blob Storage. The provider selection is automatic and based on the presence of environment variables at runtime.

### AWS S3 Detection and Usage

If all three environment variables are set — AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET — the system uses AWS S3 as the storage provider. The @aws-sdk/client-s3 package handles uploads, downloads, and deletes. The bucket name and region are derived from the environment. File keys within the bucket follow the pattern backups/schoolms-backup-YYYY-MM-DD-HHmmss.json.gz. Presigned URLs are generated for the download action in the dashboard, expiring after one hour.

### Vercel Blob Fallback

If any of the three AWS environment variables are absent, the system falls back to Vercel Blob Storage using the @vercel/blob package. The BLOB_READ_WRITE_TOKEN environment variable must be present for this fallback to function. If neither storage provider is properly configured, the backup pipeline fails early with a descriptive configuration error before attempting any export.

### Storage Abstraction Layer

To avoid scattering provider-specific logic throughout the backup route, a storage utility module should encapsulate the upload, download, delete, and list operations behind a consistent interface. The backup route calls these abstracted functions without knowledge of which provider is active. This makes the backup route testable with mocked storage calls and simplifies future provider additions.

---

## Backup Dashboard Design

The backup dashboard at /dashboard/backup is a dedicated SUPERADMIN-only page. Middleware and the page's server component must both verify SUPERADMIN role; access by any other role returns a redirect to the main dashboard with an access denied toast.

### Backup Status Banner

The top section of the page shows the current backup health at a glance. If the most recent backup succeeded, the banner renders in green or neutral styling and displays the last backup date, time (UTC), file size in megabytes, and storage provider used. If the most recent backup failed, the banner renders in red alert styling, displays the failure timestamp, and shows the recorded error message from SystemConfig. The banner serves as the first thing an administrator sees and should require no scrolling to identify a problem.

### Backup History Table

Below the status banner, a table lists all available backup artifacts. The table columns are: Date, Time (UTC), File Size, Status (colour-coded Success or Failed badge), Storage Location (S3 or Vercel Blob), and Actions.

The Actions column contains three controls per row. A Download button fetches the compressed backup file, either via a presigned S3 URL or a direct Vercel Blob URL, and initiates a browser file download. A Restore button opens the restore confirmation dialog. A Delete button permanently removes the backup artifact from storage and its record from SystemConfig history. The Delete action should require a brief secondary confirmation (a simple "Are you sure?" dialog, not the full RESTORE typing flow) to prevent accidental deletion.

The table is sorted most-recent-first. If the backup history is empty, an empty state illustration and message is shown prompting the user to trigger the first manual backup.

### Configure Backup Section

Below the history table, a configuration panel provides controls to adjust backup behaviour. A text input labelled Cron Schedule accepts a standard cron expression. Beneath the input, a human-readable interpretation of the expression is displayed in real time using a cron expression parsing library. Invalid expressions are highlighted with a validation error. A radio group labelled Storage Provider allows toggling between AWS S3 and Vercel Blob, with each option disabled if its required environment variables are absent. An email address list input allows adding or removing alert recipient addresses beyond the default SUPERADMIN accounts. Changes to this section submit to a dedicated settings API endpoint and write an AuditLog entry.

### Manual Backup Now Button

A prominently placed button labelled Back Up Now appears at the top of the page near the status banner. Clicking this button calls POST /api/backup with the current SUPERADMIN session. The button enters a loading state with a spinner during the operation. On completion, a success or failure toast is displayed and the backup history table refreshes to show the new entry.

### Cron Plan Notice

The page checks for the presence of the VERCEL_ENV environment variable or equivalent Vercel plan detection mechanism. If the system determines it is running on Vercel Hobby plan, an informational banner is displayed immediately below the page title. The banner explains that Vercel Hobby plan does not execute scheduled cron jobs, that the configured cron schedule will not trigger automatically, and that manual backups using the Back Up Now button are the only option until upgrading to Vercel Pro.

---

## Restore Flow Design

Restore is a potentially destructive and irreversible operation. The flow is designed with multiple safeguards to ensure it is never triggered accidentally.

### Step-by-Step Restore Process

Step 1: The SUPERADMIN user locates a backup entry in the history table and clicks the Restore button in that row's Actions column.

Step 2: A modal dialog opens. The dialog clearly states the date and time of the backup being restored from. It explains that this operation will not delete any existing records. New records from the backup that do not already exist in the database will be added. Existing records will be left unchanged. The user must type the word RESTORE (in uppercase) into an input field within the dialog to enable the Confirm button.

Step 3: The user types RESTORE and the Confirm button becomes active. The user clicks Confirm.

Step 4: The frontend calls POST /api/backup/restore with a JSON body containing the fileId of the selected backup.

Step 5: The API route validates the SUPERADMIN session, then downloads the backup artifact from the identified storage location using the file ID. The artifact is decompressed from gzip back to a JSON string and parsed into a JavaScript object.

Step 6: The API route iterates through each collection array in the backup object. For each collection, it calls Prisma's createMany() operation with the skipDuplicates option set to true. This means any document whose ID already exists in the database is silently skipped. No existing document is overwritten or modified. Only genuinely absent records are inserted.

Step 7: After all collections are processed, the API writes a RESTORE_TRIGGERED entry to the AuditLog collection, including the backup file ID, the timestamp of the restored backup, the counts of records inserted per collection, and the IP address of the requesting user.

Step 8: The API returns a success response with a summary of how many records were inserted per collection. The frontend displays this summary in a success toast notification and closes the modal.

If any step fails after the download has begun, the error is caught, an AuditLog entry is written with the failure details, and a failure toast is shown to the user. No partial data is committed without the full createMany operations completing.

### Why skipDuplicates Instead of Overwrite

The decision to use skipDuplicates rather than upsert or delete-and-recreate reflects the operational reality of a live school system. If a restore is triggered during an active term, partially overwriting current mark records or user accounts would cause data loss. The skipDuplicates strategy ensures that restore is always a safe additive operation — it can only add missing historical data, never corrupt current data. Administrators who need to fully replace current data with a backup would need to manually manage that through the database directly, which is a deliberate friction point to prevent accidental destructive restores.

---

## Backup API Routes Reference

### GET /api/backup

Purpose: Trigger a full database backup. This endpoint is called by the Vercel Cron runtime on its configured schedule. Authentication is performed by validating the CRON_SECRET header value against the CRON_SECRET environment variable. If the header is absent or incorrect, the route returns HTTP 401 without executing any backup logic. On success, returns HTTP 200 with a JSON body containing the backup file ID, file size in bytes, and timestamp. On failure, returns HTTP 500 with a generic error message. The detailed error is written to the AuditLog, not exposed in the response.

### POST /api/backup

Purpose: Trigger a manual backup on demand. This endpoint is called from the backup dashboard by a SUPERADMIN user. Authentication is performed by validating the NextAuth session and asserting the SUPERADMIN role. If the session is invalid or the role is insufficient, the route returns HTTP 403. The backup pipeline is identical to the GET handler. Returns HTTP 200 on success or HTTP 500 on failure.

### GET /api/backup/list

Purpose: Retrieve the list of all available backup artifacts for display in the backup history table. The response includes each backup's file ID, original filename, timestamp, compressed file size in bytes, storage provider, and recorded status (success or failed). This data is read from the backup history array stored in SystemConfig. Authentication requires a valid SUPERADMIN session. Returns HTTP 200 with an array of backup entries, or HTTP 403 if authentication fails.

### DELETE /api/backup/[fileId]

Purpose: Delete a specific backup artifact from storage and remove its entry from the SystemConfig backup history. The fileId dynamic path segment identifies which backup to delete. Authentication requires a valid SUPERADMIN session. The route deletes the file from whichever storage provider holds it, then removes the corresponding history entry from SystemConfig. An AuditLog entry is written for the deletion. Returns HTTP 200 on success or HTTP 404 if the file ID is not found in the history.

### POST /api/backup/restore

Purpose: Initiate a restore operation from a specific backup file. The request body must be a JSON object containing a fileId string that matches an entry in the backup history. Authentication requires a valid SUPERADMIN session. The route executes the full restore pipeline described in the Restore Flow Design section. Returns HTTP 200 with a restore summary object on success, or HTTP 500 with error details on failure.

---

## Cron Job Configuration

### vercel.json Structure

The vercel.json file at the project root must include a crons array. Each entry in the array specifies a path and a schedule in standard cron syntax. For SchoolMS, the single entry maps the path /api/backup to the schedule "0 2 * * *". This configuration is parsed and validated by Vercel's build process; an invalid cron expression will cause the deployment to fail.

### CRON_SECRET Validation Logic

The CRON_SECRET is a shared secret between the Vercel Cron runtime and the /api/backup route. When Vercel fires the cron job, it appends the secret as an Authorization header value. The route reads this header and compares it to the CRON_SECRET environment variable using a constant-time string comparison to prevent timing attacks. If the values match, the backup pipeline proceeds. If they do not match or the header is absent, the route returns HTTP 401 immediately.

The CRON_SECRET must be a long, randomly generated string — at minimum 32 characters — stored only in the Vercel environment variables dashboard and never committed to source control. Its value must not appear in any log output.

### Vercel Plan Limitations

Vercel Cron Jobs execute automatically only on Pro and Enterprise plans. On the free Hobby plan, the cron configuration in vercel.json is accepted without error but the jobs do not fire. This is a critical operational consideration for schools that deploy SchoolMS on the Hobby plan. The backup dashboard must surface this information clearly so administrators are not misled into believing automatic backups are running when they are not. The detection mechanism relies on checking whether the VERCEL_ENV is set to production in combination with checking the expected Vercel plan context via available runtime signals.

---

## Security Hardening Design

### Defence-in-Depth Context

Phases 1 through 4 established the foundational security layers: HTTPS via Vercel's automatic TLS, bcrypt password hashing with 12 rounds, httpOnly session cookies, CSRF protection via the NextAuth double-submit cookie pattern, middleware-enforced route authentication, role-based route handler checks, Zod input validation on all API bodies, and Prisma parameterised queries preventing NoSQL injection. Phase 5 completes the security hardening by adding rate limiting, HTTP security headers, and a secrets audit.

### Rate Limiting Architecture

Rate limiting is implemented as a middleware utility function that wraps any API route handler. The wrapper accepts a rate limit configuration specifying the maximum number of requests and the time window. When called, it extracts the client IP address from the request headers, constructs a Redis key combining the IP and the endpoint identifier, checks the current count in Upstash Redis, increments the counter with an appropriate TTL, and either allows the request to proceed or returns HTTP 429 Too Many Requests with a Retry-After header indicating when the limit resets.

The three rate-limited endpoints and their thresholds are as follows. The login endpoint allows a maximum of 5 attempts per 15-minute window per IP address. The password reset request endpoint allows a maximum of 3 requests per hour per IP address. The system configuration submission endpoint allows a maximum of 5 submissions per hour per IP address.

### Upstash Redis Integration

Upstash Redis is the preferred backend for the rate limiter because it is a serverless Redis offering with a REST API that works cleanly in Vercel's edge and serverless function environment without requiring persistent TCP connections. The @upstash/redis package provides the client. The UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables must be set in the Vercel dashboard. The rate limiter utility checks for these variables at module initialisation time and flags whether the Redis client is available.

### In-Memory Fallback

When Upstash credentials are absent — for example, in local development or when the system is first deployed before Redis is configured — the rate limiter utility automatically falls back to an in-memory implementation. The in-memory store uses a Node.js Map where keys are IP-endpoint strings and values are objects containing a request count and an expiry timestamp. On each request, expired entries are evicted and the count is checked against the limit. This fallback is appropriate for development and single-instance deployments only. In a multi-instance Vercel deployment, each function instance has its own memory, so the in-memory limiter does not provide protection equivalent to the Redis-backed implementation. The fallback should log a warning at startup indicating that the Redis-backed rate limiter is not active.

### HTTP Security Headers

Phase 5 adds five security response headers to all application responses. These are configured either in next.config.js using the headers() function or in the middleware layer.

Content-Security-Policy restricts which origins may serve scripts, styles, images, and frames. The policy permits scripts only from the same origin and trusted CDN sources such as the Vercel deployment domain. It disallows inline scripts by default, which will require any inline event handlers introduced in earlier phases to be refactored into external event listener attachments or the policy to include appropriate nonces.

X-Frame-Options is set to DENY, preventing the application from being embedded in iframes on any external origin. This mitigates clickjacking attacks.

X-Content-Type-Options is set to nosniff, preventing browsers from MIME-sniffing responses away from the declared content type. This mitigates content injection via file upload vectors.

Referrer-Policy is set to strict-origin-when-cross-origin, which sends the full referrer URL to same-origin requests but only the origin to cross-origin requests, and nothing when navigating from HTTPS to HTTP.

Permissions-Policy restricts access to browser features that the application does not need. Camera, microphone, and geolocation are all set to empty allow lists, meaning no origin — including the application itself — can access these features.

### Secrets Audit

Phase 5 includes a one-time audit step to verify that no secrets are exposed inappropriately. The audit checklist covers: confirming that DATABASE_URL, NEXTAUTH_SECRET, VERCEL_API_TOKEN, CRON_SECRET, AWS credentials, BLOB_READ_WRITE_TOKEN, UPSTASH credentials, and RESEND_API_KEY are stored exclusively as Vercel environment variables and not present in any source file, .env file committed to the repository, or build output; confirming that no API route logs these values at any log level; confirming that the .gitignore file excludes all .env files; and confirming that the Prisma schema does not hardcode any connection string defaults.

---

## Audit Log Viewer Design

The audit log viewer is located at /dashboard/settings/audit and is accessible to SUPERADMIN users only. It provides a read-only, paginated, filterable interface to the AuditLog collection that has been accumulating entries since Phase 2.

### Table Columns

The primary table displays the following columns: Timestamp (full date and time in the school's configured timezone, with the UTC value shown on hover), User Name (the display name of the acting user, or "System" for cron-triggered actions), User Role (the role badge of the acting user), Action (the action type constant, displayed as a human-readable label), Target (the type and ID of the affected resource, linked where applicable), IP Address (the originating IP of the request), and a Details indicator showing whether a details record is available for the row. Clicking any row opens the detail expansion modal.

### Pagination

The table uses server-side pagination with 50 entries per page. The current page number and total entry count are displayed above the table. Previous and next page buttons are provided, along with direct page number inputs for navigation in large logs. The pagination query passes the current filter state as parameters so that paginating never resets applied filters.

### Filters

Four filter controls are presented above the table. The date range filter provides a from date and a to date input using a date picker component. The user filter is a searchable dropdown populated with all users in the system, allowing filtering by a specific actor. The action type filter is a multi-select dropdown populated with all defined action type constants, allowing filtering by one or more event types. A free text search input performs a case-insensitive substring search against the userEmail and details fields as an additional lookup aid. Filters are applied server-side in the Prisma query using where clause conditions.

### Detail Expansion Modal

Clicking any table row opens a modal dialog showing the complete information for that log entry. In addition to all table column values, the modal displays the full details field, which is a JSON string stored in the AuditLog document. The modal renders this JSON in a formatted, syntax-highlighted view for readability. For operations like mark updates, the details field will typically contain old and new values for each changed field. For errors, it will contain the error message and stack trace excerpt.

### CSV Export

A download button labelled Export CSV applies the current active filters and downloads all matching AuditLog entries as a comma-separated values file. The export endpoint is a separate API route that accepts the same filter parameters as the pagination query but streams the full result set rather than a single page. Column headers in the CSV match the table column names. DateTime values are formatted as ISO 8601 strings. The details JSON field is escaped appropriately for CSV inclusion. This export is intended for compliance reporting, school audits, or offline analysis.

### Append-Only Constraint

The AuditLog collection is append-only by architectural design. There are no edit or delete operations defined for it anywhere in the system. No UI in the audit log viewer exposes edit or delete controls. The API routes for the audit log expose only read and list operations. If a data retention policy requires eventual pruning of old audit logs, this must be done as a separate database administration task outside the application, not through application code.

---

## AuditLog Collection Schema

The AuditLog collection stores one document per auditable event. The fields are as follows.

The id field is a MongoDB ObjectId generated automatically by Prisma on insert.

The timestamp field is a DateTime value set to the UTC time of the event. It is indexed in descending order to support efficient pagination queries sorted by most-recent-first.

The userId field is an ObjectId reference to the User document of the actor. This field may be null for events triggered by the Vercel Cron system rather than an authenticated user session.

The userEmail field is a denormalised string copy of the actor's email address at the time of the event. This ensures that audit records remain meaningful even if the user account is subsequently deleted.

The userRole field stores the Role enum value of the actor at the time of the event.

The action field is a string containing one of the defined action type constants. It is indexed to support efficient filtering by action type.

The targetId field is an optional ObjectId representing the primary resource affected by the action, for example the ID of the student created or the mark record updated.

The targetType field is an optional string describing the type of the target resource, such as Student, User, MarkRecord, Backup, or SystemConfig.

The details field is a string containing a JSON-encoded object with additional context specific to the action. For data mutation events this typically includes the before and after values of changed fields. For error events this includes the error message and relevant context.

The ipAddress field is a string recording the client IP address of the HTTP request that triggered the event, extracted from the request headers. For cron-triggered events this field records the Vercel infrastructure IP or a constant system identifier.

---

## All Action Type Constants

The following action type constant strings are used across all phases of the SchoolMS system when writing to the AuditLog collection. Phase 5 implementors must ensure the audit log viewer filter includes all of these values.

Authentication events: LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_CHANGED, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED.

User management events: USER_CREATED, USER_UPDATED, USER_DELETED, USER_ROLE_CHANGED.

Student management events: STUDENT_CREATED, STUDENT_UPDATED, STUDENT_DELETED, STUDENT_RESTORED.

Class group events: CLASS_GROUP_CREATED, CLASS_GROUP_UPDATED, CLASS_GROUP_DELETED.

Mark management events: MARK_UPDATED, MARK_BATCH_SAVED, MARK_DELETED.

Report events: REPORT_VIEWED, REPORT_DOWNLOADED, PREVIEW_MODE_ACCESSED.

Analytics events: ANALYTICS_VIEWED, ANALYTICS_EXPORTED.

System configuration events: CONFIG_CHANGED.

Backup and restore events: BACKUP_TRIGGERED, BACKUP_COMPLETED, BACKUP_FAILED, BACKUP_DELETED, RESTORE_TRIGGERED, RESTORE_COMPLETED, RESTORE_FAILED.

Security events: RATE_LIMIT_EXCEEDED, UNAUTHORISED_ACCESS_ATTEMPT, SUSPICIOUS_REQUEST_DETECTED.

---

## Testing Strategy Overview

SchoolMS v1.0 implements a four-level testing strategy that provides coverage at different granularities. The strategy is designed to catch regressions, validate business logic correctness, verify integration between components, and confirm critical user journeys work end-to-end in a real browser environment.

The four levels are unit tests using Vitest, integration tests using Vitest with a Prisma mock, end-to-end tests using Playwright, and component tests using React Testing Library.

Vitest is chosen for unit and integration tests due to its fast execution, native TypeScript support, ES module compatibility, and first-class compatibility with the Next.js environment. Playwright is chosen for end-to-end tests due to its cross-browser support, reliable waiting mechanics, and the availability of the axe-core accessibility integration. React Testing Library is chosen for component tests because it encourages testing from the user interaction perspective rather than implementation details.

---

## Unit Test Coverage Plan

Unit tests verify pure functions in complete isolation, with no external dependencies, no network calls, no database access, and no file system access. Every unit test file lives alongside its subject module in a .test.ts file or within a src/__tests__/unit directory.

### W-Rule Utility Functions

The applyWRule, isWMark, and getWSubjects functions from the mark utilities module must be tested exhaustively. Test cases must cover: a mark of 34 (just below the W threshold, not a W mark), a mark of 35 (exactly at the W threshold, is a W mark), a mark of 100 (maximum valid mark, not a W mark), a mark of 0 (minimum valid mark, not a W mark), null input, undefined input, negative values, non-numeric string inputs, and the behaviour of getWSubjects when a student has zero W marks, one W mark, and multiple W marks.

### Backup Serialisation Utilities

Test that the backup meta object is constructed correctly from given SystemConfig and collection count inputs. Test that the backup JSON structure contains the correct top-level keys. Test that serialisation handles empty collections (zero student records). Test that DateTime fields in the exported documents are serialised as ISO strings and not as BSON Date objects.

### Date Formatting Utilities

Test the date-fns wrapper functions used for display throughout the application: formatting a UTC DateTime as a local school date, formatting as a time string, computing relative time labels, and handling null or undefined date inputs gracefully without throwing.

### Analytics Aggregation Pure Functions

Test the subject average computation function against an array of mark records. Test the grade distribution bucketing function with a known set of marks and verify the correct count per grade band. Test the top-five subject extraction function. Test edge cases: no mark records, all marks equal, all marks W marks.

---

## Integration Test Coverage Plan

Integration tests verify that API route handlers behave correctly when interacting with a mocked Prisma client. The Prisma mock is configured using vitest-mock-extended or an equivalent type-safe mocking library that generates mock objects matching the full PrismaClient interface. HTTP requests to route handlers are simulated by calling the handler functions directly with mocked NextRequest objects.

### Authentication and Middleware Tests

Test that the middleware redirects unauthenticated requests to the sign-in page. Test that the middleware allows authenticated requests to proceed. Test that ADMIN-only routes reject STAFF-role sessions. Test that SUPERADMIN-only routes reject ADMIN-role sessions. Test that session expiry returns HTTP 401. Test that the CRON_SECRET header validation in GET /api/backup returns 401 when absent and proceeds when correct.

### Mark Entry Route Tests

Test the batch mark save route with a valid batch of marks, asserting the Prisma mock receives the expected upsert calls. Test the batch save route with a partially invalid batch (some marks below zero, some above 100) and verify only valid marks are saved. Test the batch save route with an empty array body and verify it returns HTTP 400. Test that the W-rule is applied before saving and W marks are stored as expected.

### Student CRUD Route Tests

Test creating a student with all required fields, asserting the Prisma mock's create method was called with correct data and an AuditLog entry was written. Test updating a student's class group. Test soft-deleting a student and verifying the isDeleted flag is set without removing the record. Test reading a student list and verify the response excludes soft-deleted records when the includeDeleted query parameter is false.

### Backup Route Tests

Test the POST /api/backup handler with a valid SUPERADMIN session and a mocked storage upload function that returns success. Verify the Prisma mock receives the expected findMany calls for all five collections and the SystemConfig update call at the end. Test the backup handler with a storage upload that throws an error, and verify that the AuditLog write and Resend email calls are made in the catch block.

---

## End-to-End Test Journey Specifications

End-to-end tests run against a live staging environment deployed on Vercel with a seeded test MongoDB Atlas database. The test database is reset and reseeded before each full test run. Playwright is configured with Chromium as the primary browser, with optional cross-browser runs on Firefox and WebKit in the CI pipeline for regression coverage.

### Journey 1: Staff Mark Entry

Step 1: Navigate to the sign-in page and log in with a STAFF-role test account. Step 2: Verify the dashboard loads and the sidebar shows only Staff-permitted navigation items. Step 3: Navigate to the Mark Entry page. Step 4: Select a class group from the class group dropdown. Step 5: Select a subject from the subject dropdown. Step 6: Enter marks for at least five students in the mark entry grid. Include at least one mark below 35 to trigger W-rule application. Step 7: Click Save. Step 8: Verify the success toast appears. Step 9: Navigate to the View Marks page. Step 10: Filter to the same class group and subject. Step 11: Verify the saved marks appear in the table with the correct values. Step 12: Verify that the mark below 35 is flagged as a W mark in the display.

### Journey 2: Admin Student and Report Workflow

Step 1: Log in as an ADMIN-role test account. Step 2: Navigate to the Student Management page. Step 3: Click Add New Student and complete the form with test data. Step 4: Save the student and verify the success toast appears and the student appears in the student list. Step 5: Navigate to Mark Entry and enter marks across multiple subjects for the new student. Step 6: Navigate to the Progress Reports page. Step 7: Select the new student. Step 8: Click Generate PDF. Step 9: Verify the browser initiates a file download and the downloaded filename corresponds to the student. Step 10: Verify the PDF download completes without error via Playwright's download event listener.

### Journey 3: Superadmin Backup Workflow

Step 1: Log in as a SUPERADMIN-role test account. Step 2: Navigate to /dashboard/backup. Step 3: Verify the backup status banner loads without error. Step 4: Click the Back Up Now button. Step 5: Wait for the loading state to resolve. Step 6: Verify the success toast appears. Step 7: Verify the backup history table updates to show a new entry at the top with today's date. Step 8: Click the Download button on the new entry and verify a file download initiates. Step 9: Verify the downloaded filename matches the expected pattern.

### Journey 4: Analytics Charts Rendering

Step 1: Log in as an ADMIN-role test account. Step 2: Navigate to the Analytics page. Step 3: Verify all six charts are visible in the DOM. Step 4: For each chart, assert that the chart container element is present, has a non-zero height, and does not contain any error message text. Step 5: Interact with the student performance chart by selecting a specific student from the student lookup control. Step 6: Verify the chart updates to show data for the selected student.

### Journey 5: Preview Mode Full Cycle

Step 1: Log in as an ADMIN-role test account. Step 2: Navigate to the Analytics page. Step 3: Activate Preview Mode by clicking the Preview Mode button. Step 4: Verify the preview overlay or dedicated route loads and displays slide 1 of 8. Step 5: Click the Next button seven times to advance through all eight slides, verifying that each slide loads and renders a non-empty content area. Step 6: Click the Previous button once to go back to slide 7. Step 7: Use the toolbar fullscreen toggle if present and verify it activates without error. Step 8: Exit Preview Mode and verify the analytics page returns to its normal state.

### Accessibility Testing

On each page visited during the end-to-end test journeys, an additional axe-core accessibility check is run via the @axe-core/playwright integration. The check is configured to assert zero violations at the critical and serious severity levels for WCAG 2.1 AA criteria. Pages checked include: sign-in, dashboard home, student management list, mark entry, view marks, analytics, preview mode, backup dashboard, and audit log viewer. Any violations are reported as test failures with the full violation list in the test output.

---

## Component Test Coverage Plan

Component tests use React Testing Library and render components in isolation with mocked props and mocked API calls. These tests verify that components render the correct UI for given inputs and respond to user interactions correctly.

### Mark Entry Grid

Render the grid with a set of student rows and subject columns. Verify each cell renders an input. Verify that the save button is initially disabled. Simulate changing a mark value in one cell. Verify the grid enters dirty state and the save button becomes enabled. Simulate entering a value above 100 and verify a validation error message appears. Simulate entering a value below 0 and verify a validation error message appears.

### Sidebar Navigation

Render the sidebar with a STAFF-role user session mock. Verify that only the navigation items permitted for STAFF are visible. Render again with an ADMIN-role mock and verify additional items appear. Render with a SUPERADMIN-role mock and verify all items including Backup and Audit Log are present. Simulate clicking an item and verify the active item receives the correct active styling class.

### Student List Table

Render the table with a known array of student records. Verify the correct number of rows is displayed. Verify that clicking a column header sorts the rows. Verify the filter input narrows displayed rows when text is entered. Verify the pagination controls appear when the record count exceeds the page size. Simulate clicking the next page button and verify the displayed page changes.

### KPI Cards

Render a KPI card component with specific numeric props. Verify the formatted value is displayed. Render a KPI card in loading state (isLoading prop true) and verify a skeleton loader is shown instead of the value. Render a KPI card in error state and verify an error message is displayed instead of the value.

### Backup Status Banner

Render the banner with a successful last-backup props object. Verify the green or success styling is applied. Verify the last backup timestamp is formatted and displayed. Render the banner with a failed last-backup props object including an error message. Verify the red or error styling is applied. Verify the error message is visible. Render the banner with no backup history and verify an appropriate empty state message is shown.

---

## CI/CD Pipeline Design

### Pull Request Workflow

Every pull request targeting the main branch triggers the CI workflow via GitHub Actions. The workflow runs on an ubuntu-latest runner. The steps execute in sequence, and any failure stops the pipeline.

Step 1 — TypeScript type checking: Runs the TypeScript compiler with the noEmit flag to report all type errors without producing output files. This step catches type mismatches, missing type definitions, and incorrect API usage that would not cause runtime errors but indicate code quality issues.

Step 2 — ESLint: Runs next lint which executes ESLint with the Next.js recommended configuration. This step enforces code style, catches common React and Next.js anti-patterns, and flags unused imports or variables.

Step 3 — Unit tests: Runs vitest run which executes all unit tests in watch-off mode. The TEST_DATABASE_URL and NEXTAUTH_SECRET_TEST secrets are injected from GitHub Actions repository secrets for any tests that require them. The step reports test counts, duration, and any failures.

Step 4 — Integration tests: Runs vitest run --project integration which executes the integration test suite in a separate project configuration that sets up the Prisma mock context. This step runs after unit tests to ensure the foundational logic is correct before testing integrations.

Step 5 — Prisma schema validation: Runs prisma validate against the schema.prisma file to confirm no syntax errors, undefined model references, or relation inconsistencies exist. This step prevents schema errors from reaching production.

### Main Branch Deployment Workflow

When a pull request is merged to main, the GitHub Actions workflow for deployment triggers. This workflow relies on the Vercel GitHub integration for the actual deployment step.

The deploy workflow runs the same type checking, lint, and unit test steps as the PR workflow to confirm the merged state is still valid. It then invokes the Vercel deployment via the Vercel CLI or the automatic GitHub integration, using the VERCEL_TOKEN and VERCEL_ORG_ID and VERCEL_PROJECT_ID secrets stored in the repository secrets.

The Vercel build command configured in the Vercel project settings is prisma generate && next build, which ensures the Prisma client is regenerated from the current schema before the Next.js production build runs.

### Preview Deployments

Every open pull request automatically receives a Vercel preview deployment via the Vercel GitHub integration. The preview deployment uses the same environment variables as production but with a TEST_DATABASE_URL pointing to the test Atlas cluster. Vercel posts the preview URL as a comment on the pull request. This allows reviewers to test changes in a live environment before merging.

### Test Environment Variables

The following secrets must be stored in the GitHub Actions repository secrets: TEST_DATABASE_URL (connection string for the test MongoDB Atlas M0 cluster), NEXTAUTH_SECRET_TEST (a separate secret used only in test environments to avoid exposing the production secret), VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID. The integration tests must not use the production DATABASE_URL at any point.

---

## Recommended Task Documents

Given the breadth of Phase 5, the work is best organised into four task documents. Each task is independently implementable in sequence, with each one building on the output of the previous.

### Task 1: Backup System Backend (Complexity: High)

Scope: Implement the entire backup infrastructure backend. This includes creating the storage abstraction utility supporting both AWS S3 and Vercel Blob, implementing the Prisma-based export utility for all five collections, implementing gzip compression, writing the GET /api/backup and POST /api/backup route handlers with full authentication, CRON_SECRET validation, and error alerting via Resend, implementing the retention cleanup logic, writing the GET /api/backup/list, DELETE /api/backup/[fileId], and POST /api/backup/restore routes, and configuring vercel.json with the cron entry. This task produces no UI changes but makes all backup API routes functional.

### Task 2: Backup Dashboard UI and Security Hardening (Complexity: High)

Scope: Build the /dashboard/backup page with all sections described in the Backup Dashboard Design: the status banner, backup history table with all three row actions, configure backup section with cron expression editor and storage provider toggle, manual backup button, and Hobby plan notice. Implement the restore confirmation dialog with the RESTORE typing confirmation. Also in this task: implement the rate limiting middleware utility with Upstash Redis and in-memory fallback, apply rate limiting to the login, password reset, and config routes, add all five HTTP security headers via next.config.js, and perform the secrets audit. Update the AuditLog collection with all new action types introduced in this task.

### Task 3: Audit Log Viewer (Complexity: Medium)

Scope: Build the /dashboard/settings/audit page with the paginated table, all filter controls (date range, user filter, action type filter, free text search), the row detail expansion modal rendering the JSON details field, and the CSV export functionality. Implement the supporting API routes: GET /api/audit-log (paginated and filtered), and GET /api/audit-log/export (full CSV download). Add the audit log viewer link to the SUPERADMIN sidebar navigation. Ensure the page is inaccessible to non-SUPERADMIN roles. This task also includes human-readable display labels for all action type constants.

### Task 4: Testing Suite and CI/CD Pipeline (Complexity: High)

Scope: Set up the Vitest configuration for unit and integration test projects. Write all unit tests for the W-rule utilities, backup serialisation utilities, date formatting utilities, and analytics aggregation functions. Write all integration tests for the backup route, auth middleware, batch mark save route, and student CRUD routes using a Prisma mock. Set up the Playwright configuration targeting the staging environment. Write all five end-to-end user journey tests and the accessibility check integration. Set up React Testing Library and write all five component test files for the mark entry grid, sidebar navigation, student list table, KPI cards, and backup status banner. Write the GitHub Actions workflow YAML files for the PR validation pipeline and main branch deployment pipeline. Configure all required GitHub Actions secrets documentation.

---

## Phase Completion Checklist

The following items must all be verified before Phase 5 is considered complete and SchoolMS v1.0 is ready for production handover.

- vercel.json cron entry is present and validated by Vercel on deployment
- CRON_SECRET environment variable is set in Vercel and validated in the backup route
- GET /api/backup returns 401 when CRON_SECRET header is absent or incorrect
- POST /api/backup returns 403 when called with non-SUPERADMIN session
- Backup artifact is produced as a valid gzipped JSON file matching the defined format
- Backup file is uploaded to AWS S3 when all AWS environment variables are present
- Backup file uploads to Vercel Blob when AWS variables are absent and BLOB_READ_WRITE_TOKEN is present
- An error email is sent via Resend to all SUPERADMIN emails when backup fails
- Retention cleanup removes backups beyond 30 entries
- /dashboard/backup is inaccessible to non-SUPERADMIN users
- Backup status banner correctly reflects last backup success or failure state
- Backup history table renders all available entries with correct metadata
- Download, restore, and delete actions work correctly from the history table
- Restore confirmation dialog requires typing RESTORE before the confirm button is active
- POST /api/backup/restore uses createMany with skipDuplicates and writes an AuditLog entry
- Hobby plan notice appears when automatic cron is not available
- Rate limiting is active on login (5 per 15 min), password reset (3 per hour), and config (5 per hour)
- HTTP 429 is returned when rate limits are exceeded, with Retry-After header
- Upstash Redis rate limiter is active in production; in-memory fallback activates in development
- All five security headers are present in application responses
- No secrets appear in any source file, log output, or build artifact
- /dashboard/settings/audit is inaccessible to non-SUPERADMIN users
- Audit log table renders paginated entries with correct columns
- Date range, user, and action type filters work correctly
- Row detail modal shows formatted JSON details
- CSV export downloads a valid CSV file containing the filtered results
- All Vitest unit tests pass
- All Vitest integration tests pass with Prisma mock
- All five Playwright end-to-end journeys pass on staging
- axe-core accessibility checks report no critical or serious violations
- All React Testing Library component tests pass
- GitHub Actions PR workflow runs all five steps without failure on a test pull request
- Vercel production deployment succeeds on merge to main with prisma generate && next build
- Preview deploy is created and URL posted on an open test pull request
- TEST_DATABASE_URL and other test secrets are stored in GitHub Actions repository secrets

---

## System Completion Summary

With the completion of Phase 5, all five phases of the SchoolMS project are implemented. Phase 1 established the project foundation, database, authentication, and infrastructure. Phase 2 delivered the core dashboard, student management, user management, and settings. Phase 3 implemented the full mark entry workflow, W-rule enforcement, and PDF progress report generation. Phase 4 built the analytics and data visualisation layer with the infographic Preview Mode. Phase 5 secured and hardened the platform with automated backups, rate limiting, security headers, audit visibility, testing coverage, and a production-grade CI/CD pipeline.

The result is SchoolMS v1.0: a complete, deployable, full-stack school management system for secondary schools serving Grades 6 through 11, capable of managing students, staff, marks, reports, analytics, and system health in a single cohesive application.

Items identified as out of scope for v1.0 but recommended for a future roadmap include: two-factor authentication, incremental backup strategies, SAML or OAuth SSO integration, parent portal read-only access, SMS notification delivery, mobile-native wrappers, offline PWA capability, multi-school tenancy, and automated load testing.
