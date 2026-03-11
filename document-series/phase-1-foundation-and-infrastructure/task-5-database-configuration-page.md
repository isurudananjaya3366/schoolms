# Phase 1 — Foundation and Infrastructure
## Task 5: Database Configuration Page (/config)
**Estimated Complexity:** High
**Phase Reference:** Phase 1, Task 5 of 5
**Depends On:** Tasks 1, 2, 3, and 4

---

## Task Summary

Task 5 produces the "day zero" onboarding experience for SchoolMS. It is the final task of Phase 1 and the mechanism by which a freshly deployed Vercel instance becomes a fully operational school management system. After completing this task, a system administrator can navigate to /config on a brand-new deployment, paste a single MongoDB Atlas connection string, create a Superadmin account, and immediately log in — all without manually touching the Vercel dashboard beyond the two pre-deploy secrets.

This task is the natural culmination of Phase 1 because it depends on every preceding task: the project scaffolding and TypeScript configuration (Task 1), the Prisma schema and all model definitions (Task 2), NextAuth authentication infrastructure (Task 3), and the middleware with its role-based access control and environment-variable-driven routing logic (Task 4). Without any one of those foundations, this task cannot be implemented correctly.

The /config page is architecturally special: it is the only page in the system that is publicly accessible without authentication under specific conditions (when the database is not yet configured), and it is the only page that writes to external infrastructure — specifically, Vercel's environment variable store — as part of its normal operation. Its three rendering states, multi-step setup flow, and dual-path persistence strategy (Vercel API vs .env.local) make it the most complex single page in Phase 1.

Upon completion of this task, Phase 1 as a whole is complete. Phase 2 may begin.

---

## Prerequisites

Before beginning implementation, confirm the following conditions are met:

- Task 1 is complete: the Next.js 14 App Router project is scaffolded, TypeScript strict mode is active, ESLint and Prettier are configured, Vitest is configured, shadcn/ui is installed, and .env.local is listed in .gitignore.
- Task 2 is complete: the Prisma schema contains the User, Student, ClassGroup, MarkRecord, Enrollment, SubjectAssignment, AcademicYear, and SystemConfig models. The Prisma client singleton (lib/prisma.ts) is in place. The checkDatabaseHealth() function exists in lib/db-health.ts and returns a typed health object.
- Task 3 is complete: NextAuth is configured with the Credentials provider, session strategy is JWT, the User model includes passwordHash and role fields, and /api/auth/[...nextauth] is functional.
- Task 4 is complete: the middleware.ts at the project root reads NEXT_PUBLIC_DB_CONFIGURED and applies the correct routing logic. The /config route is listed in the public path set when the database is unconfigured. The SUPERADMIN role check redirects all other authenticated roles away from /config.
- The following environment variables are set in the Vercel project before first deployment: NEXTAUTH_SECRET (a 32-character random string) and NEXTAUTH_URL (the full deployment URL, e.g., https://yourproject.vercel.app). These two variables are the only ones the administrator needs to set manually.
- Optional but recommended: VERCEL_API_TOKEN (a Vercel personal access token with write access to the project's environment variables) and VERCEL_PROJECT_ID (the project's Vercel project ID) are set. Without these, the system falls back to writing to .env.local.

---

## Task Scope

### In Scope
- The /config page (app/config/page.tsx) as a Server Component that determines rendering state and passes it to a Client Component
- The ConfigClient component (app/config/ConfigClient.tsx) handling all interactive UI across all three states
- POST /api/config/connect (app/api/config/connect/route.ts) implementing the full 8-step initialisation sequence
- POST /api/config/superadmin (app/api/config/superadmin/route.ts) implementing Superadmin account creation
- GET /api/config/health (app/api/config/health/route.ts) returning live database health data
- The Vercel environment variable write-back logic (lib/vercel-env.ts)
- The .env.local fallback write logic (within lib/vercel-env.ts or a dedicated lib/local-env.ts)
- In-memory rate limiter for /api/config/connect with optional Upstash Redis upgrade
- Integration tests in app/config/__tests__/config.integration.test.ts covering all 9 test cases
- NEXT_PUBLIC_DB_CONFIGURED upsert in SystemConfig during initialisation

### Out of Scope
- SMTP email delivery for the Superadmin welcome email (Phase 2)
- Full Settings page or school profile configuration (Phase 2)
- Multi-tenant configuration (single-school deployment only)
- OAuth providers for Superadmin (Credentials only in Phase 1)
- Vercel redeployment trigger (optional, documented as a manual step)
- Rate limiting for the /api/config/health or /api/config/superadmin endpoints

---

## Acceptance Criteria

1. Navigating to /config on a deployment where NEXT_PUBLIC_DB_CONFIGURED is not set to "true" renders State A (Not Configured) without requiring authentication.
2. Navigating to /config when NEXT_PUBLIC_DB_CONFIGURED is "true" and the user is unauthenticated redirects to /login (handled by middleware from Task 4).
3. Navigating to /config when NEXT_PUBLIC_DB_CONFIGURED is "true" and the user is authenticated as a non-SUPERADMIN role redirects to /dashboard (handled by middleware from Task 4).
4. Submitting a malformed connection string to POST /api/config/connect returns HTTP 400 with a descriptive error message that does not contain the submitted string.
5. Submitting a valid but unreachable connection string returns HTTP 500 with a sanitised error message — no credentials, no connection string fragment in the response body.
6. Submitting a valid, reachable connection string triggers the full initialisation sequence: temporary Prisma test, db push, Vercel env var write (or .env.local fallback), SystemConfig upsert, and returns { connected: true, needsSuperadmin: true } when no SUPERADMIN yet exists.
7. Submitting the Superadmin creation form with matching passwords and a unique email creates a User document with role SUPERADMIN and a bcrypt-hashed password.
8. After Superadmin creation, the client redirects to /login?setup=complete.
9. GET /api/config/health returns { status: "healthy" | "unreachable" | "unconfigured", latencyMs, collectionCounts, errorMessage, clusterName } without any database credentials in the response.
10. State B (Healthy) displays the cluster hostname, latency in milliseconds, and a collection document counts table.
11. State C (Unreachable) displays a sanitised error message and a troubleshooting checklist.
12. The "Update Connection String" flow in State B and State C runs the same connection test and Vercel/local write sequence as initial setup, but skips the Superadmin seed step.
13. Exceeding 5 connection attempts in a 60-minute window from the same IP returns HTTP 429.
14. The DATABASE_URL string never appears in any server-side log output, any HTTP response body, or any error payload returned to the client.
15. All 9 integration test cases pass.
16. SystemConfig contains db_configured = "true" and academic_year = current calendar year after successful initialisation.

---

## Implementation Guide

### Step 1: Page Architecture Decision

The /config page must be a Next.js Server Component (the default in the App Router) so that state determination logic, which involves environment variable reads and a database health check, runs on the server before the page is sent to the client. The Server Component reads NEXT_PUBLIC_DB_CONFIGURED from environment variables and calls checkDatabaseHealth() if needed, constructs a typed ConfigPageState value, and passes it as a prop to a Client Component named ConfigClient.

The reason for the Server/Client split is simple: the Server Component cannot use React hooks, event handlers, or browser APIs, but the three UI states all require interactive behaviour (form inputs, button click handlers, accordion expand/collapse). The ConfigClient component receives the pre-determined state and handles all rendering logic using useState and useTransition on the client side.

The ConfigPageState type should be a discriminated union with three variants: { type: "unconfigured" }, { type: "healthy", health: DatabaseHealthResult }, and { type: "unreachable", health: DatabaseHealthResult }. This makes it impossible for ConfigClient to accidentally render the wrong state.

Do not perform the health check on every page load when the database is unconfigured — it is unnecessary and would always fail. The health check should only be invoked when NEXT_PUBLIC_DB_CONFIGURED is "true", at which point the result determines whether to render State B or State C.

### Step 2: State Determination Logic

The Server Component page.tsx determines state as follows. First, it reads the NEXT_PUBLIC_DB_CONFIGURED environment variable from process.env. If this value is not the literal string "true", the state is immediately set to { type: "unconfigured" } and no database call is made. Second, if the variable is "true", the Server Component imports and calls checkDatabaseHealth() from lib/db-health.ts. If checkDatabaseHealth() returns a result with status "healthy", the state is { type: "healthy", health: result }. If it returns "unreachable" or throws, the state is { type: "unreachable", health: result }.

The health check in lib/db-health.ts (established in Task 2) must return a consistent typed object regardless of success or failure — it must never throw to the caller. The page can therefore safely await it without a try/catch, relying on the health object's status field.

One important nuance: NEXT_PUBLIC_DB_CONFIGURED is a build-time environment variable in Next.js when used with the NEXT_PUBLIC_ prefix. This means that after the Vercel env var is written, the value is available in server-side code via process.env immediately, but the client-side bundle would only reflect the new value after a redeployment. This is an acceptable limitation: the /config page is a server-rendered page that re-evaluates on each request, so server-side state determination is always current. The middleware also reads this variable server-side, so access control is always current. Only hardcoded client-side checks would be stale — avoid them.

### Step 3: State A — Not Configured UI Design

State A renders a full-viewport centred layout. Use a flex container with min-height 100vh, horizontal and vertical centering. The content sits inside a Card component (shadcn/ui Card) of constrained width (max-w-md is appropriate).

At the top of the card, render the SchoolMS logo as styled text — a heading element with bold weight, a school-appropriate colour (deep blue is recommended), and "SchoolMS" as the text content. No external image is required.

Below the logo, render the main heading "Connect Your Database" in a large semibold font. Immediately below, render the subtext paragraph: "To get started, paste your MongoDB Atlas connection string below."

Below the subtext, render a step indicator showing the current step in the two-step setup process. This is a small subdued text element reading "Step 1 of 2 — Connect Database". When the connection step completes successfully, this updates to "Step 2 of 2 — Create Superadmin". Use local React state (useState) to track the current step (1 or 2) inside ConfigClient.

Below the step indicator, render a Badge component (shadcn/ui Badge) with destructive/red variant and the text "No Database Configured".

Below the badge, render a text input (shadcn/ui Input) for the connection string. The input should be full-width, with placeholder text "mongodb+srv://username:password@cluster.mongodb.net/dbname". Below the input, render helper text in a small subdued font: "Format: mongodb+srv://username:password@cluster.mongodb.net/dbname".

Below the helper text, render the "Connect & Initialise" Button (shadcn/ui Button, default/primary variant, full-width). When clicked, the button should enter a loading state (disabled, with a spinner or loading text "Connecting...") while the POST /api/config/connect request is in flight.

If the API returns an error, render an Alert component (shadcn/ui Alert, destructive variant) below the button showing the error message. The error message must never include the submitted connection string.

Below everything, render an Accordion component (shadcn/ui Accordion) with a single item labelled "Help — How to get a MongoDB Atlas connection string". When expanded, it shows numbered prose steps: create a free Atlas cluster, create a database user, allow network access from 0.0.0.0/0, navigate to "Connect" in Atlas, choose "Drivers", and copy the connection string shown. No code blocks — plain prose instructions.

When the API returns { connected: true, needsSuperadmin: true }, transition the UI to Step 2 by updating the React step state. The connection string input and its button should be replaced by the Superadmin creation form (described in Step 6).

### Step 4: State B — Healthy UI Design

State B renders within the same Card container style as State A, but without the step indicator or connection string input. It is only accessible to authenticated SUPERADMIN users (enforced by middleware).

At the top, render a Badge with a success/green variant reading "Database Healthy".

Below the badge, render a description section with two rows: the connected cluster name (extracted from the DATABASE_URL environment variable on the server side by parsing the hostname portion — e.g., "cluster0.mongodb.net") and the latency from the health check result as "XX ms (roundtrip)".

Below the description, render a table (standard HTML table with Tailwind utility classes) showing collection document counts. The table has two columns: "Collection" and "Document Count". Rows correspond to the five primary collections: Users, Class Groups, Students, Mark Records, and System Config. The counts come from the health object passed as a prop from the Server Component.

Below the table, render two buttons: "Run Health Check" (outline variant) and "Update Connection String" (ghost or secondary variant). "Run Health Check" calls GET /api/config/health, updates the displayed latency and counts without a full page reload, using a fetch call in a React transition. "Update Connection String" toggles the visibility of an inline update form.

The update form contains a single Input field. Its placeholder shows the obfuscated current connection string: the username and cluster name are visible but the password segment is replaced with asterisks in the placeholder text. The actual input value is empty — the user must type the full new connection string. A "Update & Reconnect" Button submits to the same POST /api/config/connect endpoint. On success, render an Alert with an informational variant showing: "Connection updated successfully. A redeployment may be required for all Vercel functions to use the new value."

### Step 5: State C — Unreachable UI Design

State C renders within the same Card layout. Only authenticated SUPERADMIN users can reach this state (middleware handles the auth check).

At the top, render a Badge with a destructive/red variant reading "Database Unreachable".

Below the badge, render an Alert component (destructive variant) showing the sanitised error message from the health check result. The sanitised message must have all credential patterns stripped — specifically, anything matching the pattern of a MongoDB credentials segment in a URI (user:password@) should be replaced with [credentials redacted] before rendering.

Below the error alert, render the troubleshooting checklist as a bulleted unordered list. The five checklist items are:
- "Verify your MongoDB Atlas cluster is not paused. Atlas automatically pauses M0 (free tier) clusters after 60 days of inactivity. Log into Atlas and click Resume on your cluster."
- "Confirm that 0.0.0.0/0 is added to your Atlas Network Access allow list. Under Network Access in Atlas, add an entry for IP address 0.0.0.0/0 to allow connections from Vercel's dynamic IP range."
- "Check that NEXTAUTH_SECRET and NEXTAUTH_URL are correctly set in your Vercel project's environment variables."
- "Review the Vercel function logs for detailed error output. Navigate to the Vercel dashboard, select your project, and open the Functions tab."
- "If the connection string was recently updated, a Vercel redeployment is required before the new value takes effect."

Below the checklist, render the same "Update Connection String" button that appears in State B. When clicked, it toggles an identical update form. The form behaves identically to the State B update form.

### Step 6: Superadmin Creation Form (Step 2 of Setup)

This form is displayed in State A after a successful Step 1 API response. It replaces the connection string form in the card without a page reload.

Render an updated heading "Create Superadmin Account" and subtext "This account will have full administrative access to SchoolMS."

The form contains four inputs in order: Full Name (text, placeholder "Jane Smith"), Email Address (email, placeholder "admin@school.edu"), Password (password, placeholder "Minimum 8 characters"), and Confirm Password (password, placeholder "Re-enter password"). All four are full-width.

Client-side validation before submission: confirm that the password field is at least 8 characters, and confirm that the password and confirm password fields match. If validation fails, show inline error text below the relevant field before making any network request.

The "Create Account" Button is full-width primary variant. On click, it enters loading state while the POST /api/config/superadmin request is in flight.

On API success (HTTP 200 with { success: true }), use the Next.js router or window.location to redirect the user to /login?setup=complete. The login page (established in Task 3) should detect the setup=complete query parameter and render a success toast or banner welcoming the administrator.

On API error, render a destructive Alert below the form showing the error message. Common errors to handle and display distinctly: passwords do not match (though this should be caught client-side first), email already exists, and generic server error.

### Step 7: POST /api/config/connect — Full Initialisation Sequence

This route handler lives at app/api/config/connect/route.ts and exports an async POST function. The implementation follows eight sequential steps, each of which can terminate the sequence early with an error response.

**Step 7.1 — Zod Validation:** Parse the request body with Next.js' request.json() and validate it against a Zod schema. The schema requires a single field connectionString of type string. Apply a regex refinement ensuring the value starts with "mongodb+srv://" and contains the expected URI structural elements (the @ separator, at least one dot in the hostname). If parsing or refinement fails, return a 400 JSON response with { error: "Invalid connection string format", details: "The string must begin with mongodb+srv://" }. The details field must not echo back the submitted string.

**Step 7.2 — Rate Limiting:** Before any expensive operations, check the rate limiter. Extract the IP address from the request headers (the x-forwarded-for header in Vercel deployments). Apply the in-memory limiter: maintain a Map keyed by IP storing { count: number, windowStart: number }. If the current time exceeds windowStart + 60 minutes, reset the entry. If count exceeds 5, return 429 with { error: "Too many attempts. Please wait before trying again." }. If UPSTASH_REDIS_REST_URL is present in the environment, use the @upstash/ratelimit library instead of the in-memory map. Increment the counter only after the rate limit check passes (use an atomic increment in Redis; in-memory increment immediately before proceeding).

**Step 7.3 — Temporary Prisma Client Test:** Import PrismaClient from @prisma/client (not the singleton from lib/prisma.ts). Instantiate a new PrismaClient with a datasource override providing the submitted connection string as the URL. Call $connect(). If $connect() throws or rejects, catch the error, run $disconnect() in a finally block, sanitise the error message by removing any substring matching credential patterns, and return 500 with { error: "Connection failed", details: sanitisedMessage }. If $connect() succeeds, run a lightweight query (e.g., systemConfig.count()) to confirm read access. Disconnect the temporary client in a finally block after the query.

**Step 7.4 — Schema Push:** Execute prisma db push against the validated connection string. This creates all collections and indexes defined in schema.prisma. In a Vercel serverless environment, prisma db push cannot be run via child_process because the Prisma CLI is not available at runtime. Therefore, schema push must either be run as part of the build/deploy step (added to the build command as prisma db push) or executed programmatically using Prisma Migrate's engine APIs. The recommended approach for this task: add DATABASE_URL to the Vercel environment first (Step 7.6), then trigger a redeployment which runs prisma db push in the build step. Document this limitation clearly in the API response. Alternatively, for local development and initial setup, run prisma db push manually or via a post-deploy hook. If schema push is deferred to the build step, the API response at this stage should indicate that the schema push will occur on the next deployment, and the UI should show a corresponding informational message.

**Step 7.5 — Superadmin Existence Check:** Using the temporary Prisma client (or the singleton if schema push has completed), query for any existing User document with role SUPERADMIN. If one exists, this is an "Update Connection String" request; proceed directly to Step 7.6. If none exists, set a local flag needsSuperadmin = true. This flag determines the response shape at Step 7.8.

**Step 7.6 — Vercel Environment Variable Write:** Call the writeVercelEnvVar(connectionString) function from lib/vercel-env.ts (implemented in Step 10). Pass the validated connection string. If both VERCEL_API_TOKEN and VERCEL_PROJECT_ID are present in process.env, execute the Vercel REST API call sequence. If either is absent, fall back to writing to .env.local (implemented in Step 11). If the write fails (Vercel API error or fs write error), log the failure using a sanitised message (no connection string in the log) and continue — do not abort the initialisation. Include a warning flag in the response if the write failed.

**Step 7.7 — SystemConfig Upsert:** Using the Prisma singleton (or the temporary client if the singleton is not yet functional — after schema push the singleton should work), perform three upsert operations on the SystemConfig model. Upsert the key "db_configured" with value "true". Upsert the key "academic_year" with value equal to the current calendar year as a string (new Date().getFullYear().toString()). Upsert the key "school_name" with value "SchoolMS" (only if not already present, using upsert's create/update distinction: create sets it to "SchoolMS", update leaves the existing value unchanged). SystemConfig upsert uses key as the unique identifier.

**Step 7.8 — Return:** If the initialisation succeeded and needsSuperadmin is true, return HTTP 200 with { connected: true, needsSuperadmin: true }. If the initialisation succeeded and a Superadmin already exists (update flow), return HTTP 200 with { success: true, message: "Database connection updated successfully." }. Include an optional envWriteWarning field if Step 7.6 produced a non-fatal failure.

### Step 8: POST /api/config/superadmin Route

This route lives at app/api/config/superadmin/route.ts. It is the Step 2 endpoint in the setup flow and is only invoked after a successful Step 1.

Parse and validate the request body against a Zod schema requiring name (string, min 2 characters), email (string, email format), password (string, min 8 characters), and confirmPassword (string). Apply a superRefine or a .refine at the object level to verify password === confirmPassword. If validation fails for any field, return 400 with { error: "Validation failed", details: zodError.flatten() }.

Before creating the user, run a race condition check: query for any user with role SUPERADMIN. If one already exists, return 400 with { error: "A Superadmin account already exists." }. This prevents duplicate submissions.

Check if any user exists with the submitted email regardless of role. If one does exist, return 400 with { error: "An account with this email address already exists." }.

Hash the password using bcrypt from the bcryptjs package. Use 12 salt rounds. Do not log the plain-text password at any point.

Create the User document with the following fields: name, email, passwordHash (the bcrypt hash), role set to the SUPERADMIN enum value, createdAt set to new Date(), and updatedAt set to new Date(). If the Prisma create call throws, catch the error, check for a duplicate key error code (P2002 in Prisma), and return 400 with { error: "An account with this email address already exists." }. For all other errors, return 500 with { error: "Account creation failed. Please try again." }.

On success, return 200 with { success: true, message: "Superadmin account created successfully." }. Do not include the created user's data in the response.

### Step 9: GET /api/config/health Route

This route lives at app/api/config/health/route.ts. It must be accessible without authentication at all times. Ensure it is listed in the public paths array in middleware.ts (this should already be the case from Task 4, but verify).

The handler imports checkDatabaseHealth() from lib/db-health.ts and awaits its result. It immediately returns the full health object as a JSON response with HTTP 200 (even when the database is unreachable — the status field in the response body conveys the health condition; HTTP 200 just means the API route itself responded).

The only transformation required before returning is to ensure the errorMessage field, if present, has any credential patterns stripped. The DATABASE_URL must never appear in this response, not even partially. The checkDatabaseHealth() function in lib/db-health.ts (established in Task 2) should already sanitise its error messages — add a final sanitisation pass in the route handler as a defence-in-depth measure.

The response shape is: status ("healthy", "unreachable", or "unconfigured"), latencyMs (number of milliseconds for the health-check round trip, or null if the check failed), collectionCounts (an object with keys users, classGroups, students, markRecords, and systemConfigs — each holding the count from a Prisma count query, or null if unavailable), errorMessage (sanitised error string or null), and clusterName (the hostname portion of DATABASE_URL with credentials stripped, or null if DATABASE_URL is not set).

The route handler should not add caching headers that would allow a CDN to cache a stale health result. Set Cache-Control: no-store.

### Step 10: Vercel Environment Variable Integration

Create the file lib/vercel-env.ts. This module exports a single async function writeVercelEnvVar(key: string, value: string): Promise<VercelEnvWriteResult>, where VercelEnvWriteResult is a typed object containing success (boolean), method ("vercel-api" | "local-file" | "none"), and an optional warning string.

The function first checks whether VERCEL_API_TOKEN and VERCEL_PROJECT_ID are both present in process.env. If either is absent, it falls through to the .env.local fallback (Step 11).

If both tokens are present, the Vercel API write sequence proceeds as follows. First, send a GET request to https://api.vercel.com/v10/projects/{VERCEL_PROJECT_ID}/env with the Authorization: Bearer {VERCEL_API_TOKEN} header. Parse the response to find whether a variable with the matching key (e.g., DATABASE_URL) already exists. This GET call returns an array of env var objects, each containing an id field.

If the variable already exists, send a PATCH request to https://api.vercel.com/v10/projects/{VERCEL_PROJECT_ID}/env/{existingEnvVarId} with the Authorization header and a JSON body containing the new value, the target array (["production", "preview"]), and the type "encrypted". The "encrypted" type ensures Vercel stores the value securely and it does not appear in plaintext in deployment logs.

If the variable does not exist, send a POST request to https://api.vercel.com/v10/projects/{VERCEL_PROJECT_ID}/env with the Authorization header and a JSON body containing key, value, target (["production", "preview"]), and type "encrypted".

If the Vercel API returns a non-2xx status, parse the error response, log a sanitised version (no value, only the key and the HTTP status code), and return { success: false, method: "none", warning: "Failed to persist DATABASE_URL to Vercel. Manual configuration may be required." }.

The optional redeployment trigger (POST to https://api.vercel.com/v13/deployments) is explicitly out of scope for this task's required implementation. Document it as a known enhancement: after the env var write succeeds, the administrator should trigger a manual redeployment from the Vercel dashboard for the new value to take effect across all serverless function instances. The /config page State B update success message already communicates this requirement.

### Step 11: .env.local Fallback Implementation

Within lib/vercel-env.ts, implement the fallback branch that activates when VERCEL_API_TOKEN or VERCEL_PROJECT_ID is absent.

Use Node.js's fs module with the synchronous appendFileSync (or writeFileSync with read-modify-write logic) to write the key-value pair to .env.local at the project root. The project root is resolved using process.cwd() at runtime. The write format must be: KEY="VALUE" followed by a newline, matching the standard .env file format.

Before writing, check whether the key already exists in .env.local using fs.readFileSync. If it does, replace the existing line rather than appending a duplicate. Parse the file content line by line, replace any line beginning with KEY= with the new key-value line, and rewrite the entire file using fs.writeFileSync. If the file does not exist, create it with just the new line.

After a successful write, return { success: true, method: "local-file", warning: "Connection saved to .env.local. For production deployment, set DATABASE_URL in Vercel using a VERCEL_API_TOKEN." }.

The UI must surface this warning. In the ConfigClient component, when the API response contains an envWriteWarning field, render an Alert component with an informational (blue/default) variant below the success message. The warning text should match the string returned by the API.

Confirm that .env.local is listed in .gitignore (established in Task 1). Never read .env.local back and return its contents to the client.

### Step 12: Credential Security Measures

The connection string submitted to POST /api/config/connect contains plaintext database credentials. It must be handled with the following security measures throughout its lifecycle.

In the route handler, extract the connection string from the validated Zod parse result immediately. Never assign it to a variable with a name that might be accidentally included in a spread or serialisation operation. Pass it explicitly and only to the functions that require it (temporary Prisma client constructor, writeVercelEnvVar).

The string must never appear in any console.log, console.error, or console.warn call. When logging errors related to the connection, log only a sanitised version. The sanitisation function should use a regular expression to detect the mongodb+srv://username:password@ pattern and replace the credentials segment with [credentials redacted].

The string must never be included in any HTTP response body, including error responses. Error messages must describe what went wrong (e.g., "Authentication failed", "Host not found") without echoing any part of the input.

After the Step 7.3 temporary Prisma client test and Step 7.6 Vercel env var write, the in-memory reference to the connection string should not be referenced again. Do not store it in module-level scope or any persistent data structure.

In .env.local, the written value is as secure as the file system allows. The combination of .gitignore (preventing accidental commit) and the file's location at the project root (outside the web server's public directory) provides adequate local-development security. Warn the developer in the UI that .env.local should not be committed.

### Step 13: Rate Limiting Implementation

Implement rate limiting for POST /api/config/connect to prevent brute-force submission of connection strings from automated tools.

For the in-memory implementation: create a module lib/rate-limiter.ts. Export a function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: Date }. Internally maintain a Map keyed by IP address. Each entry stores a count integer and a windowStart timestamp (milliseconds since epoch). On each call, if the current time is beyond windowStart + 3,600,000 (one hour), reset the entry. If count is 5 or greater, return { allowed: false, remaining: 0, resetAt: new Date(windowStart + 3600000) }. Otherwise, increment count and return { allowed: true, remaining: 5 - count, resetAt: ... }.

The in-memory approach has a known limitation in serverless environments: each Vercel function instance has its own memory, so rate limit state is not shared across instances. This means a determined attacker could exceed the limit by routing requests to multiple instances. Document this limitation clearly in code comments. The in-memory approach is adequate for the M0 Atlas tier deployment scenario (low sustained traffic, rate limit is an abuse deterrent rather than a hard security boundary).

For the Upstash Redis upgrade: check whether UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in process.env. If both are present, import @upstash/ratelimit and @upstash/redis, create a Ratelimit instance with a sliding window of 5 requests per 3600 seconds, and use the caller's IP as the identifier. This approach provides globally consistent rate limiting across all serverless instances. The implementation should be conditional: if Upstash credentials are present, use the Redis limiter; otherwise fall back to the in-memory limiter.

Return HTTP 429 with JSON body { error: "Too many connection attempts. Please wait 60 minutes before trying again.", retryAfter: iso8601ResetTimestamp } when the limit is exceeded.

### Step 14: NEXT_PUBLIC_DB_CONFIGURED Environment Variable

The NEXT_PUBLIC_DB_CONFIGURED variable serves as the fast-path signal to the middleware and the /config page Server Component. Setting it to "true" changes the behaviour of the entire application: the middleware begins enforcing SUPERADMIN-only access to /config, and the Server Component switches from rendering State A to running a health check.

During the initialisation sequence in Step 7.7, the SystemConfig record for "db_configured" is upserted to "true". However, SystemConfig is a database record — the environment variable is separate. The NEXT_PUBLIC_DB_CONFIGURED environment variable must be written to Vercel (or .env.local) alongside DATABASE_URL using the same writeVercelEnvVar mechanism. Add a second call to writeVercelEnvVar("NEXT_PUBLIC_DB_CONFIGURED", "true") in Step 7.6.

The known limitation of NEXT_PUBLIC_ variables: in Next.js, environment variables prefixed with NEXT_PUBLIC_ are inlined into the client-side JavaScript bundle at build time. This means the Vercel environment variable update only takes effect after the next redeployment. In server-side code (Server Components, API routes, middleware), the variable is read from process.env at runtime, so it is always current without a redeployment. This asymmetry is acceptable for the /config page because it is entirely server-rendered (the state determination is in the Server Component, not client-side code).

The middleware (from Task 4) reads NEXT_PUBLIC_DB_CONFIGURED from process.env at the time each request is processed. Because middleware runs in the Edge Runtime in Vercel, it reads the current environment variable value from the deployment's runtime configuration. After writing the variable via the Vercel API, a redeployment is required for the Edge Runtime to pick up the new value. Document this requirement in the UI: the "Update Connection String" success message explicitly mentions that a redeployment may be required.

### Step 15: Integration Tests

Create the test file app/config/__tests__/config.integration.test.ts. Use Vitest as the test runner (configured in Task 1). Mock the Prisma client using vi.mock("@/lib/prisma"). Mock the global fetch function to intercept Vercel API calls. Mock the fs module to intercept .env.local writes.

**Test 1 — Valid connection string, DB not configured, no existing Superadmin:** Mock the temporary PrismaClient constructor to succeed on $connect() and return 0 on systemConfig.count(). Mock the Vercel API fetch calls to return success. Mock prisma.systemConfig.upsert to succeed. Mock prisma.user.findFirst to return null (no Superadmin). Assert the response is HTTP 200 with body { connected: true, needsSuperadmin: true }.

**Test 2 — Invalid connection string format:** Submit a string that does not begin with "mongodb+srv://". Assert the response is HTTP 400 with error field containing "Invalid connection string format". Assert the submitted string does not appear in the response body.

**Test 3 — Rate limit exceeded:** Call the endpoint 6 times from the same mock IP within the rate limit window. Assert the 6th call returns HTTP 429.

**Test 4 — Prisma $connect() throws:** Mock the temporary PrismaClient $connect() to throw an error containing a mock credential string "testuser:testpassword@". Assert the response is HTTP 500, the response body does not contain "testuser" or "testpassword", and the response body contains a sanitised error description.

**Test 5 — Valid Superadmin creation:** Mock prisma.user.findFirst to return null for both the SUPERADMIN role check and the email existence check. Mock prisma.user.create to return a mock user object. Assert the response is HTTP 200 with { success: true }.

**Test 6 — Passwords do not match:** Submit mismatched password and confirmPassword values to POST /api/config/superadmin. Assert the response is HTTP 400 with a validation error.

**Test 7 — Email already exists:** Mock prisma.user.findFirst to return a mock user object when checking by email. Assert the response is HTTP 400 with { error: "An account with this email address already exists." }.

**Test 8 — GET /api/config/health, DB healthy:** Mock checkDatabaseHealth() to return { status: "healthy", latencyMs: 42, collectionCounts: { users: 3, classGroups: 12, students: 124, markRecords: 1056, systemConfigs: 5 }, errorMessage: null, clusterName: "cluster0.mongodb.net" }. Assert the response body matches this shape exactly and DATABASE_URL does not appear in the response.

**Test 9 — GET /api/config/health, DB unreachable:** Mock checkDatabaseHealth() to return { status: "unreachable", latencyMs: null, collectionCounts: null, errorMessage: "Authentication failed", clusterName: null }. Assert the response body has status "unreachable" and errorMessage does not contain any credential strings.

---

## UI Component Reference

| Component | shadcn/ui Name | Used In |
|---|---|---|
| Page container card | Card, CardHeader, CardContent | All three states |
| Status indicator | Badge | All three states (different variants) |
| Connection string field | Input | State A (Step 1), Update form (States B and C) |
| Submit button | Button | All states |
| Error/warning alerts | Alert, AlertDescription | All states |
| Help instructions | Accordion, AccordionItem | State A |
| Health stat rows | (Tailwind table) | State B |
| Superadmin form fields | Input, Label | State A Step 2 |
| Loading spinner | (Lucide Loader2 icon, animated) | All form submissions |

---

## API Routes Summary Table

| Method | Path | Auth Required | Purpose |
|---|---|---|---|
| POST | /api/config/connect | None (if DB unconfigured) / SUPERADMIN (if configured) | Full initialisation sequence: validate, test, push, persist |
| POST | /api/config/superadmin | None (called immediately after connect, no session yet) | Create the first Superadmin account |
| GET | /api/config/health | None (always public) | Return live database health, latency, and collection counts |

---

## Sequence Diagram Description

The following prose describes the complete flow from first Vercel deployment to first successful login. This represents the "happy path" with VERCEL_API_TOKEN configured.

An administrator deploys the Next.js application to Vercel with NEXTAUTH_SECRET and NEXTAUTH_URL set as environment variables. NEXT_PUBLIC_DB_CONFIGURED is absent. The first request to any page is handled by middleware, which detects that the database is not configured and redirects the request to /config.

The /config Server Component reads NEXT_PUBLIC_DB_CONFIGURED from process.env, finds it absent, and passes the { type: "unconfigured" } state to ConfigClient. The browser renders State A.

The administrator copies the MongoDB Atlas connection string and pastes it into the connection string input, then clicks "Connect & Initialise". ConfigClient sends POST /api/config/connect with the connection string in the request body.

The route handler validates the format with Zod, passes the rate limit check, instantiates a temporary PrismaClient with the submitted URL, calls $connect(), runs a count query to confirm access, then disconnects the temporary client. The handler calls writeVercelEnvVar for DATABASE_URL and NEXT_PUBLIC_DB_CONFIGURED, updating both variables in the Vercel project via the REST API. It upserts the three SystemConfig records. It queries for existing SUPERADMIN users and finds none. It returns { connected: true, needsSuperadmin: true }.

ConfigClient receives the success response and transitions the UI to Step 2. The connection string input is replaced by the Superadmin creation form. The step indicator updates to "Step 2 of 2 — Create Superadmin".

The administrator fills in their name, email, and password, then clicks "Create Account". ConfigClient validates locally (passwords match, minimum length), then sends POST /api/config/superadmin.

The superadmin route handler validates the body, confirms no SUPERADMIN exists, confirms the email is unused, hashes the password with bcrypt at 12 rounds, creates the User document, and returns { success: true }.

ConfigClient redirects the browser to /login?setup=complete. The login page detects the query parameter and shows a welcome banner. The administrator enters their credentials, NextAuth verifies them against the new SUPERADMIN user record, and issues a session token. The middleware detects the authenticated SUPERADMIN session and permits access to /dashboard.

Phase 1 setup is complete. Phase 2 begins from an operational system.

---

## File Inventory

The following files are created or modified by this task:

| File Path | Action | Description |
|---|---|---|
| app/config/page.tsx | Create | Server Component; determines state (unconfigured/healthy/unreachable) and renders ConfigClient |
| app/config/ConfigClient.tsx | Create | Client Component; handles all interactive UI for all three states and the two-step setup flow |
| app/api/config/connect/route.ts | Create | POST handler; full 8-step initialisation sequence |
| app/api/config/superadmin/route.ts | Create | POST handler; Superadmin account creation |
| app/api/config/health/route.ts | Create | GET handler; returns live database health object |
| lib/vercel-env.ts | Create | Writes environment variables to Vercel API or .env.local fallback |
| lib/rate-limiter.ts | Create | In-memory rate limiter with optional Upstash Redis integration |
| app/config/__tests__/config.integration.test.ts | Create | All 9 integration test cases |

---

## Integration Points

### What This Task Completes
- The /config page exists and renders all three states correctly
- POST /api/config/connect executes the full initialisation sequence
- POST /api/config/superadmin creates the first authenticated user
- GET /api/config/health provides observable database status
- DATABASE_URL and NEXT_PUBLIC_DB_CONFIGURED are persisted to Vercel or .env.local
- The SystemConfig model is populated with foundational configuration keys
- The SUPERADMIN user can authenticate via the NextAuth Credentials provider

### What Phase 2 Depends On
Phase 2 (Core Dashboard and Student Management) may be implemented only after this task because it requires:
- An authenticated SUPERADMIN session to access /dashboard and all administrative routes
- A functional database connection (DATABASE_URL set and verified)
- SystemConfig records for academic_year and school_name (used to contextualise data in the dashboard)
- The User model and its role field (Student and Teacher user creation in Phase 2 builds on the same model)
- The NextAuth session shape established in Task 3 (the role claim in the JWT is read by all Phase 2 page components)

---

## Common Pitfalls

**Prisma db push in a serverless runtime:** The prisma db push CLI command cannot be executed in a Vercel serverless function because the Prisma CLI binary is not bundled in the production build. The recommended mitigation is to run prisma db push as part of the Vercel build command (add it to the "build" script in package.json as a preceding step). This means the schema is pushed on every deployment, which is safe for idempotent operations like index creation. Document this clearly so the implementing agent does not attempt child_process.exec at runtime.

**Temporary PrismaClient not disconnected:** Every instantiation of a new PrismaClient (not the singleton) must be followed by a $disconnect() call. In the temporary connection test in Step 7.3, use a try/finally block to ensure $disconnect() is always called, even if the count query throws. Failing to disconnect will leak database connections and may exhaust the Atlas M0 tier's connection limit.

**VERCEL_API_TOKEN scope requirements:** The Vercel personal access token used for DATABASE_URL writes must have the "Environment Variables" write permission for the target project. A read-only token or a token scoped to a different team will produce a 403 response from the Vercel API. Document the required token scope in the UI's help text and in the deployment instructions.

**db_configured vs NEXT_PUBLIC_DB_CONFIGURED sync issues:** The SystemConfig database record "db_configured" = "true" and the environment variable NEXT_PUBLIC_DB_CONFIGURED = "true" serve different purposes and are written at different times. The environment variable controls middleware routing before any database call is made; the SystemConfig record is a persistent application-level flag. After the Vercel env var is written, a redeployment is required before the middleware reads the new value. During the window between the env var write and the redeployment, the middleware will still treat the database as unconfigured, allowing unauthenticated access to /config. This window should be documented and is acceptable for the single-admin setup scenario.

**Connection string in logs:** The most likely accidental credential exposure is an unguarded catch block: catch (error) { console.error(error) }. Because the submitted connection string may appear in the error message of a failed PrismaClient instantiation (e.g., "Failed to parse connection string: mongodb+srv://user:password@..."), a raw error log will expose credentials. Always sanitise error messages before logging. Implement a sanitiseMongoUri(message: string): string utility function in lib/utils.ts that replaces the credentials segment of any MongoDB URI in the string with "[credentials redacted]".

**Race condition on simultaneous Superadmin creation:** If two browser tabs both complete Step 1 successfully and simultaneously submit POST /api/config/superadmin, both may pass the "no SUPERADMIN exists" check before either creates the record. Mitigate this by relying on the User model's unique index on email (established in Task 2) to reject the duplicate insert at the database level. Return a graceful 400 error when Prisma throws a unique constraint violation (error code P2002) rather than a 500 error.

---

## Phase 1 Completion

With Task 5 complete, all five tasks of Phase 1 — Foundation and Infrastructure — are implemented:

- **Task 1** established the project scaffolding, tooling, and developer environment
- **Task 2** defined the database schema, Prisma models, and the db-health utility
- **Task 3** implemented the NextAuth authentication system with the Credentials provider
- **Task 4** implemented the middleware with role-based access control and environment-variable-driven routing
- **Task 5** implemented the /config page, the initialisation API routes, the Vercel environment variable integration, and the Superadmin seed

Together, these five tasks produce a deployable, operational SchoolMS instance. A fresh deployment can be fully configured and have a working Superadmin account within minutes of going live, with no manual database setup steps beyond what is documented in the deployment guide.

Phase 2 — Core Dashboard and Student Management — may now begin. It builds upon a fully authenticated, database-connected application with a known user model, session shape, and access control system. Phase 2 implementers can assume that DATABASE_URL is set, the Prisma schema is applied, NextAuth is operational, the SUPERADMIN user exists, and all Phase 1 infrastructure is stable.
