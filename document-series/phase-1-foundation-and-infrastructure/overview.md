# Phase 1 — Foundation and Infrastructure

**Document Version:** 1.0  
**Phase:** 1 of 5  
**Recommended Task Documents: 5**  
**Status:** Ready for Implementation  
**Last Updated:** 2026-03-11

---

## Table of Contents

1. Phase Summary
2. Phase Scope
3. Phase Goals
4. Technology Stack Deep-Dive
5. Project Initialisation and Repository Setup
6. Database Schema Design
7. Authentication System Design
8. Role-Based Access Control Design
9. Middleware Architecture
10. Authentication Flows in Detail
11. Database Configuration Page Design
12. Environment Variables Reference
13. Deployment Setup
14. Security Baseline
15. Recommended Task Documents
16. Phase Completion Checklist
17. Dependencies and Blockers

---

## 1. Phase Summary

Phase 1 establishes every foundational layer that all subsequent phases depend on. It is not about visible features for end users — it is about making the system structurally sound, securely authenticated, and connectably deployable before a single mark is entered or a single report is generated. Every later phase assumes that the work in Phase 1 is complete, correct, and reliable.

This phase covers the full technology setup, the database schema, the complete authentication and authorisation system, the middleware protection layer, the database configuration page (the "zero-setup" onboarding experience), and the deployment pipeline. When Phase 1 is done, a developer should be able to clone the repository, deploy to Vercel, navigate to the /config page, paste a MongoDB Atlas connection string, and immediately have a working secured application with a Superadmin account.

Phase 1 comes first because authentication, database connectivity, and role enforcement are cross-cutting concerns. The dashboard UI, mark entry forms, analytics, and report generation that appear in later phases all depend on a working session system, a populated database schema, and enforced access tiers. Building those later features on an unstable foundation would require significant rework. Phase 1 eliminates that risk entirely.

What Phase 1 delivers, concretely:

- A deployable Next.js 14 project with TypeScript, Tailwind CSS, and shadcn/ui configured.
- A Prisma schema representing all five core data models: User, ClassGroup, Student, MarkRecord, and SystemConfig.
- A NextAuth.js v5 authentication system with credentials-based login, JWT sessions, and role injection.
- Role-based access control with three tiers — Superadmin, Admin, and Staff — enforced at every layer.
- A middleware.ts file that protects all dashboard and API routes.
- A /config database setup page with three distinct states, Vercel env var integration, and rate limiting.
- A CI/CD pipeline via GitHub Actions and Vercel.
- A security baseline covering bcrypt password hashing, secure cookie configuration, and rate limiting.

---

## 2. Phase Scope

The following architecture sections from the SchoolMS Architecture Document are fully covered in Phase 1:

- Project Summary and Architectural Goals
- Full Technology Stack and Dependency Version Matrix
- System Architecture Overview and Request Lifecycle
- Next.js App Router Folder Structure
- Complete Prisma Schema (all five models, all indexes, all enums, all embedded types)
- NextAuth.js v5 Configuration (CredentialsProvider, JWT strategy, session callbacks, role injection)
- All three Role Definitions (Superadmin, Admin, Staff) and their permission boundaries
- Login Flow (full step-by-step)
- Password Reset Flow (full step-by-step)
- Session Architecture (JWT, cookie settings, auto-refresh behaviour)
- Middleware Enforcement (middleware.ts, matchers, /config special logic)
- Database Configuration Page (/config) — all three states and Vercel env var integration
- Environment Variables (all required and optional variables for Phase 1)
- Deployment Setup (Vercel, MongoDB Atlas, GitHub Actions CI/CD)
- Security Baseline (bcrypt, cookie security, CSRF, rate limiting)

Phase 1 does not implement any dashboard UI components, mark entry, analytics, or reporting. Those belong to Phases 2 through 4. Phase 1 also does not implement backup operations or email delivery — those are noted as optional integrations here but are fully specified in Phase 5.

---

## 3. Phase Goals

When Phase 1 is complete, every one of the following statements must be true:

- The Next.js 14 project builds without TypeScript errors in strict mode.
- The Prisma schema has been validated and all five models are present with correct field types, relations, and indexes.
- A MongoDB Atlas cluster is reachable from the deployed application.
- The /config page loads without authentication on first run and transitions correctly through its three states.
- Pasting a valid MongoDB Atlas connection string into /config completes the full initialisation sequence: schema sync, Superadmin seed, DATABASE_URL persisted to Vercel environment variables.
- The /login page accepts a valid Superadmin email and password and issues a JWT session cookie.
- The /dashboard route is inaccessible without a valid session cookie and redirects to /login.
- All /api routes reject unauthenticated requests with HTTP 401.
- Role enforcement is in place: a Staff user cannot reach Superadmin-only endpoints.
- The middleware.ts file correctly handles all three path classes: /config, /dashboard/:path*, and /api/:path*.
- The password reset flow from email submission through token validation to password update works end-to-end.
- GitHub Actions runs TypeScript checking, ESLint, Vitest unit tests, and Prisma schema validation on every pull request.
- Vercel preview deployments are active for all open pull requests.
- All required environment variables are documented and their values are set in Vercel.
- The security baseline is in place: bcrypt rounds ≥ 12, cookie hardening applied, /config rate-limited to 5 attempts per IP per hour.

---

## 4. Technology Stack Deep-Dive

### Next.js 14 (App Router)

Next.js 14 with the App Router is the central framework choice. The App Router unlocks React Server Components as a default rendering model, which means data fetching, authentication checks, and layout composition happen on the server before any JavaScript is sent to the browser. This dramatically reduces the attack surface for sensitive data — student records, marks, and admin settings never need to transit the API boundary unless the client explicitly requests them through a Server Action or fetch. The file-system based routing model provides strict, predictable URL structures that map directly to the application's access control topology.

Version 14.x specifically is required because it includes the stable Partial Prerendering infrastructure and continued compatibility with NextAuth.js v5's middleware approach. Pinning to 14.x prevents accidental upgrades that could break the App Router API surface before the project reaches production maturity.

### TypeScript 5.x (Strict Mode)

TypeScript is non-negotiable for a project of this complexity. Strict mode is enabled, which activates noImplicitAny, strictNullChecks, strictFunctionTypes, and related checks. The database schema models, API payloads, session types, and Prisma-generated types must all be explicitly typed. This is the primary defence against the class of bug where a mark is stored as a string instead of a number, or where a role check silently passes because of a truthy null. AI agents implementing this system must not disable strict mode or introduce any TypeScript suppressions without explicit justification.

### Tailwind CSS 3.x

Tailwind CSS 3 with JIT (Just-In-Time) compilation is the sole styling mechanism. PostCSS integration is required. No custom CSS files, CSS modules, or styled-components are used anywhere in the project. All visual variation is expressed through Tailwind utility classes. The JIT mode ensures that only used classes are included in the production bundle, keeping CSS bundle size minimal. Version 3.x is pinned because the shadcn/ui component library has peer dependency requirements against Tailwind 3 and may not be fully compatible with v4 during the development window of this project.

### shadcn/ui

shadcn/ui is not a traditional npm package installed as an external dependency. Its components are copied directly into the project under components/ui/. This architecture decision is deliberate: it means the team owns the component source code entirely and can modify primitive behaviour without forking an external library. Components are built on Radix UI primitives, which provide accessible, unstyled interactive building blocks (dialogs, dropdowns, tooltips, form inputs). Tailwind classes are applied on top. For Phase 1, the components needed are minimal — primarily form inputs, buttons, badges, and card containers for the /config and /login pages. The full component set expands in Phase 2.

### Prisma ORM 5.x

Prisma serves as the data access layer between Next.js API routes and MongoDB Atlas. It generates a fully type-safe client from the declarative schema in prisma/schema.prisma. Every query returns types that match the schema exactly — there are no untyped database calls anywhere in the codebase. Prisma 5.x is required because it introduced stable MongoDB support for most query operations and improved the prisma db push workflow used during the /config initialisation sequence. The Prisma client is instantiated as a singleton (in lib/prisma.ts) to avoid connection pool exhaustion in the serverless environment, where each function invocation would otherwise create a new client instance.

### MongoDB Atlas

MongoDB Atlas provides the cloud-hosted document database. The M0 free tier is sufficient for development and low-traffic production use. Atlas is chosen for its managed infrastructure, automatic backups, built-in monitoring, and Atlas Search capabilities that may be used in later phases. The document-oriented model aligns well with the nested structure of student records, where MarkRecord marks are an embedded object rather than a separate join table. The standard mongodb+srv:// connection string format is the only supported input for the /config page.

### NextAuth.js v5

NextAuth.js v5 (in beta during development) is the authentication framework. Version 5 is specifically required because it was redesigned for the App Router — it uses route handlers instead of the older API routes pattern, integrates with Next.js middleware natively, and supports the new session() helper in Server Components. The CredentialsProvider is used exclusively, since SchoolMS manages its own user accounts and does not support OAuth or social login. JWT-based sessions are chosen over database sessions because they are stateless, require no additional session store, and are suitable for a serverless deployment where request affinity cannot be guaranteed.

### Zod 3.x

Zod handles input validation for every API route. Every body payload, query parameter, and form submission is parsed against a Zod schema before any database operation begins. This enforces type coercion early in the request lifecycle and provides structured validation error messages that the frontend can display without additional parsing logic. Zod schemas also serve as living documentation of expected API shapes, which is important for AI agents implementing dependent phases.

### Supporting Libraries

Zustand 4.x manages client-side UI state (modal open/close state, transient notifications, sidebar collapse). It is deliberately used only for non-critical UI state — never for authentication state or sensitive data. Date-fns 3.x handles all date formatting and comparison operations. Recharts 2.x and D3.js 7.x are installed in Phase 1 but not used until Phase 4. They are listed here because they must be in package.json from the start to avoid dependency resolution conflicts later.

---

## 5. Project Initialisation and Repository Setup

### Repository Structure

The repository follows the standard Next.js App Router layout with additional top-level directories for Prisma and shared library code. The folder structure is:

The app/ directory contains four sub-directories: (auth)/ for unauthenticated pages (login, register, reset-password), config/ for the database setup page which has its own access rules, dashboard/ for all protected admin UI, and api/ for all serverless route handlers.

The components/ directory is divided by function: ui/ contains shadcn/ui primitive components, dashboard/ contains layout-level components like the sidebar and topbar, charts/ contains Recharts wrapper components, and infographics/ contains D3 visualisation components. This separation ensures that generic UI primitives remain isolated from application-specific layout and visualisation logic.

The lib/ directory contains all shared utility modules: prisma.ts holds the singleton Prisma client, auth.ts holds the NextAuth.js configuration, db-health.ts contains the database connectivity check function, w-rule.ts exports the mark-to-display translation utilities (used across all mark-related features from Phase 3 onward), and backup.ts contains the backup orchestration logic (Phase 5).

The prisma/ directory contains only schema.prisma. No seed files reside here — the Superadmin seed is triggered programmatically from the /config initialisation flow rather than from a Prisma seed script, so that it runs on deployment rather than only in local development.

middleware.ts lives at the root of the project alongside next.config.js and tsconfig.json.

### Configuration Files Required

The following configuration files must be present at project root:

- next.config.js — enables the App Router, sets image domains if needed, configures any experimental flags.
- tsconfig.json — TypeScript 5 configuration with strict mode enabled, path aliases configured (@ maps to the project root for clean imports).
- tailwind.config.ts — Tailwind 3 configuration with content paths covering all .tsx and .ts files in app/, components/, and lib/.
- postcss.config.js — PostCSS configuration pointing to Tailwind CSS and Autoprefixer.
- .eslintrc.json — ESLint configuration extending next/core-web-vitals and TypeScript-aware rules.
- .env.example — A committed (non-secret) template of all required and optional environment variables with placeholder values and comments explaining each.
- .gitignore — Must include .env.local, .env, node_modules/, .next/, and prisma/generated/.

### Tooling Setup

The package.json scripts section must include the following named scripts: dev (starts Next.js development server), build (runs prisma generate then next build), start (serves the production build), lint (runs ESLint across the codebase), type-check (runs tsc --noEmit for CI use), test (runs Vitest), and postinstall (runs prisma generate to ensure the Prisma client is available after npm install in CI environments).

Vitest is the unit test framework. It is configured to handle the TypeScript project setup and to mock the Prisma client in tests. At Phase 1 completion, unit tests must exist for the W-Rule utility functions, the Zod schema validators for the /config page submission, and the bcrypt comparison helper.

---

## 6. Database Schema Design

### Overview

The Prisma schema targets MongoDB Atlas as its data source provider. MongoDB's document model means that some fields which would be foreign-key join tables in a relational database are instead embedded documents or arrays within a parent record. The schema makes deliberate choices about what to embed versus what to reference by ID, based on query access patterns.

### User Model

The User model represents all human actors in the system — Superadmins, Admins, and Staff members. Each user has a unique email address, a hashed password (stored as passwordHash — never as a plaintext password or a reversible cipher), a display name, and a role field that takes one of three enum values: SUPERADMIN, ADMIN, or STAFF.

The role enum is central to the entire access control system. Every API route handler checks the role from the session JWT and compares it against the minimum required role for that operation. The User model also stores createdAt and updatedAt timestamps. A sessions array field may be present to support future session invalidation features (Phase 5), but during Phase 1 the JWT strategy is stateless and this field is not actively used. Password reset tokens (the hashed token and its expiry timestamp) are stored as fields on the User document to avoid a separate PasswordResetToken collection.

The email field carries a unique index, which is enforced at both the Prisma schema level and the MongoDB Atlas level. Attempting to create two users with the same email must fail with a clear error — not a silent duplicate.

### ClassGroup Model

The ClassGroup model represents a single class — a combination of grade (an integer from 6 to 11) and section (a letter from A to F). Each ClassGroup document contains an array of Student references. The grade-section combination effectively functions as the natural key for a class, though Prisma assigns each document a synthetic id. ClassGroup documents are relatively stable — they do not change term-to-term — and they serve as the primary organisational unit by which students and marks are grouped for bulk operations.

### Student Model

The Student model is the central record for an individual student. Each student has a unique indexNumber — a human-readable identifier assigned by the school — and a name. Each student belongs to exactly one ClassGroup via a classId field and a Prisma relation. The classId field carries an index because class-filtered queries are the most common read access pattern in the application (every mark entry form and every class report loads all students in a given class).

The electives field is an embedded document, not a separate collection. It stores three category fields — categoryI, categoryII, and categoryIII — each holding a subject name string. These represent the elective subject choices visible to the student in their marks profile. Embedding electives on the Student document is the correct choice because they are always read together with the student and are never queried independently.

### MarkRecord Model

The MarkRecord model stores one term's marks for one student. The compound of studentId, term (enum: TERM_1, TERM_2, TERM_3), and year (an integer representing the academic year) must be unique — the schema enforces a unique compound index on these three fields. This prevents duplicate mark entry and gives the application a safe upsert pattern: create if not exists, update if present.

The marks field is an embedded document containing one optional integer field per subject: sinhala, buddhism, maths, science, english, history, categoryI, categoryII, and categoryIII. All mark fields are nullable integers, because a student may not have been assessed in every subject in every term. A null mark and a zero mark are distinct values — null means the mark was not entered, zero means the student scored zero.

The updatedBy field records the email or ID of the user who last modified the record. This is the audit trail for Phase 1. Phase 5 will expand this into a full audit log, but even in Phase 1 the field must be written on every mark save operation.

The MarkRecord model also carries a secondary index on term and year together (without studentId) to support term-level aggregation queries used by the analytics system in Phase 4.

### SystemConfig Model

The SystemConfig model is a key-value store for application configuration. It uses a simple structure: each document has a unique key string and a value string, plus an updatedAt timestamp. The key field carries a unique index. This model is used to store operational settings that must persist across deployments and serverless function invocations — settings that cannot be stored in environment variables because they change at runtime.

The keys written during Phase 1 are: db_configured (a boolean-as-string that marks whether the initialisation flow has completed), backup_cron (the cron schedule string, written in Phase 5), backup_storage_type (set in Phase 5), last_backup_at (updated after each backup), and last_backup_status (success or failure string from the last backup run). In Phase 1, only db_configured is actively written and read.

### Relationships and Embedded Types

The schema uses Prisma's MongoDB relation syntax for ClassGroup-to-Student (one-to-many, referenced by classId) and Student-to-MarkRecord (one-to-many, referenced by studentId). Electives and marks are embedded documents, not separate collections. This embedding strategy is appropriate because neither set of fields is ever queried in isolation — they are always retrieved as part of their parent document.

---

## 7. Authentication System Design

### NextAuth.js v5 Configuration

The NextAuth configuration lives entirely in lib/auth.ts and is imported by both the route handler (for the /api/auth/[...nextauth] route) and middleware.ts (for session validation on protected routes). Centralising the configuration in one file ensures that session shape, JWT contents, and provider settings are consistent everywhere the auth system is used.

### CredentialsProvider

The CredentialsProvider is the only authentication provider configured. It accepts two fields: email (string) and password (string). Its authorize callback fetches the User document from MongoDB by email using the Prisma singleton client. If no user is found, it returns null immediately — NextAuth interprets null as a failed authentication and redirects to the error page. If a user is found, bcrypt.compare() is called to validate the submitted password against the stored passwordHash. bcrypt is used with a work factor of 12 rounds for password hashing. If the comparison fails, null is returned. If it succeeds, the callback returns an object containing the user's id, email, name, and role.

### JWT Strategy and Session Contents

The session strategy is set to jwt — no database session records are created. The JWT callback receives the token and the user object from the authorize callback on first sign-in. It writes the user's id, email, name, and role onto the token. The session callback receives the token on every subsequent request and projects the same four fields onto the session object that is available to Server Components and API routes via the auth() helper. This means the session object always contains userId, email, name, and role — nothing more, nothing less.

### Cookie Security Settings

The NextAuth session cookie is configured with the following security settings: httpOnly (inaccessible to JavaScript), secure (only transmitted over HTTPS — this means local development over HTTP must set NEXTAUTH_URL to an http:// URL and accept that the secure flag is not applied in development), sameSite=strict (the cookie is not sent on cross-site requests, providing robust CSRF protection), and maxAge of 8 hours (28800 seconds). The cookie name is set to a non-default value to avoid conflicts in shared hosting scenarios, though on Vercel each project has its own domain so this is a secondary concern.

### JWT Auto-Refresh

If the user is active and the JWT is within 2 hours of expiry, the JWT callback detects this condition and re-mints a fresh token with a new expiry. This prevents active users from being logged out mid-session while also ensuring that abandoned sessions expire naturally within their maximum window.

---

## 8. Role-Based Access Control Design

### Role Overview

The system defines three roles in the ROLE enum: SUPERADMIN, ADMIN, and STAFF. These roles form a strict hierarchy from most privileged to least privileged.

### Superadmin

There is only one Superadmin in production. The Superadmin account is created during the /config initialisation sequence and cannot be created through the normal admin interface. The Superadmin has unrestricted access to every feature in the system. Specifically: they can create and delete Admin and Staff accounts, view all audit logs, access the /config database configuration page at any time (other roles cannot), manage backup settings and trigger manual backups, and perform any operation that Admins and Staff can perform. The Superadmin is the only role that can access backend system configuration.

### Admin

Admins are created by the Superadmin. Admins can create and delete Staff accounts. They have full access to all student records across all classes and grades — they are not restricted to a specific class. They can perform batch mark entry for any class and any subject. They can generate individual progress reports and class-aggregate reports for any student or class. They can view all analytics dashboards. What Admins cannot do: they cannot access the /config page, they cannot change backup settings, they cannot view the full audit log (they may see a limited activity view in Phase 4), and they cannot create or delete other Admin accounts.

### Staff

Staff are created by Admins. Staff have the most restricted access tier. They can view student lists — names, index numbers, and class assignments. They can enter marks for the classes and subjects they are assigned to. They cannot delete any record, cannot create any account, cannot access system settings, cannot view analytics, and cannot generate reports. The concept of "assigned classes" will be formalised in Phase 2 when the Staff assignment data model is extended — in Phase 1, the role boundary is established but class-level assignment filtering is noted as a Phase 2 concern.

### Enforcement Layers

Role enforcement happens at three distinct layers and all three must be implemented:

The first layer is middleware.ts, which runs on every request before the route handler executes. Middleware can reject requests that lack a valid session or lack the minimum required role for a broad path pattern. Middleware is fast and runs on the Vercel Edge, but it operates on the JWT token without database access, so it uses the role stored in the token.

The second layer is the API route handler itself. Each route handler calls the auth() helper to retrieve the session and then checks the role against the specific operation being performed. Route-level role checks are more granular than middleware checks — for example, a PATCH request to update a mark record might be reachable by both Admins and Staff, but within the handler the logic checks whether the staff member's assigned class matches the record being edited.

The third layer is the UI, which uses the session role to conditionally render or hide navigation items, action buttons, and sensitive data displays. UI-level access control is a convenience for users — it does not constitute a security boundary. The real security is at the middleware and handler layers.

---

## 9. Middleware Architecture

### What Middleware Does

The middleware.ts file at the project root is a Next.js Edge Middleware function. It runs on every incoming request before the request reaches any route handler or Server Component. Its job in Phase 1 is to enforce authentication and coarse-grained role access for three categories of paths.

### Matcher Configuration

The middleware matcher covers three path patterns: /dashboard/:path* (all dashboard routes and their children), /api/:path* (all API routes), and /config (the database setup page). The matcher uses an array of path strings in the middleware configuration export.

### Logic for Dashboard Paths

For all /dashboard/:path* requests, middleware validates that a session JWT cookie is present and valid. If the cookie is absent or the JWT is expired or malformed, the request is redirected to /login with a redirect query parameter encoding the originally requested URL, so that after successful login the user is returned to where they were going.

### Logic for API Paths

For all /api/:path* requests, middleware validates that a session JWT cookie is present and valid. If invalid, the middleware returns an HTTP 401 response with a JSON body — it does not redirect, because API consumers expect JSON responses, not HTML redirect pages. A role check is not performed at the middleware level for API paths because individual routes have different role requirements — role enforcement for API routes happens inside each route handler.

### Logic for the /config Path

The /config path has special two-way access logic. The SystemConfig collection is checked for the db_configured key. If db_configured is not set or is false (indicating first run), the /config page is accessible without any authentication — the user has not yet set up the database, so there is no authentication system to validate against. If db_configured is true, the /config page is accessible only if the requester is authenticated with the SUPERADMIN role. Any authenticated non-Superadmin user who navigates to /config is redirected to /dashboard. An unauthenticated user who navigates to /config after the database has been configured is redirected to /login.

The challenge with the /config middleware logic is that checking the SystemConfig collection requires a database call, but the database may not be available. The middleware handles this gracefully: if the database call fails (connection error, timeout), it defaults to treating the database as unconfigured and allows unauthenticated access to /config. This is the correct fallback — it allows recovery if the connection string needs to be updated.

---

## 10. Authentication Flows in Detail

### Login Flow

The login flow begins when a user submits the /login form with their email and password. Next.js calls the NextAuth signIn flow, which invokes the CredentialsProvider's authorize callback. The callback queries MongoDB for a User document matching the submitted email. If no match is found, an error is returned and the UI displays an invalid credentials message — the specific error (wrong email vs wrong password) is deliberately not disclosed to prevent user enumeration.

If a matching user is found, bcrypt.compare() runs the password validation. On failure, the same generic invalid credentials message is shown. On success, the authorize callback returns the user object with id, email, name, and role. NextAuth mints a signed JWT containing these four fields plus iat (issued at) and exp (expires at) timestamps. The JWT is stored as an httpOnly cookie with the security settings described in the authentication system section. The user is then redirected to /dashboard or to the originally requested URL if a redirect parameter was present on the login URL.

### Password Reset Flow

The password reset flow is initiated when a user submits their email address on the "Forgot Password" page. The API generates a cryptographically secure random token using the Node.js crypto module — this raw token is the one sent to the user's email address as part of the reset link. A bcrypt hash of this token is stored on the User document, along with a passwordResetExpiry timestamp set to one hour from the current time. The raw token is never stored to prevent database theft from yielding usable tokens.

The reset email is sent via Resend (primary) or Nodemailer over SMTP (fallback). The reset link contains the raw token as a URL query parameter. When the user clicks the link, the reset page's API handler retrieves the User document by the identifying portion of the token (email is also passed in the URL), hashes the submitted raw token, and compares the hash against the stored hash. If they match and the current time is before passwordResetExpiry, the reset form is shown. If the token is invalid or expired, an error page is shown with a link to request a new reset.

On form submission with a new password, the API hashes the new password with bcrypt (12 rounds), updates the passwordHash on the User document, clears the passwordResetToken and passwordResetExpiry fields, and invalidates all current sessions for that user. Session invalidation for JWT strategies is implemented by storing a sessionInvalidatedAt timestamp on the User document — the JWT callback checks this timestamp on each request and rejects tokens issued before it.

### Session Auto-Refresh

On every authenticated request, the JWT callback evaluates whether the token is within 2 hours (7200 seconds) of its expiry time. If so, and if the request was successful (not a 401 or redirect), the token is re-minted with a fresh 8-hour expiry. This behaviour is transparent to the user — they experience a continuously active session as long as they are using the application within the auto-refresh window. Idle sessions expire naturally after 8 hours without activity.

---

## 11. Database Configuration Page (/config) Design

### Purpose and Access Model

The /config page is the "zero-setup" onboarding experience that fulfils one of the core architectural goals: a fresh deployment works by pasting a single MongoDB connection string, with no other manual provisioning required. The page is also the operational control centre for the database connection once the system is live.

### State A — Database Not Configured

This is the state on first deployment, before any MongoDB connection string has been provided. The page renders a full-screen centred card layout with the SchoolMS logo and product name prominently displayed. A red status badge reads "No Database Configured". Below the badge, the page shows brief, non-technical instructions explaining that a MongoDB Atlas connection string is required. A single text input accepts the connection string. A "Connect and Initialise" button triggers the setup sequence.

The setup sequence runs in the following order: the submitted string is validated against the expected mongodb+srv:// URL format pattern using a Zod regex schema; if validation fails, an inline error is shown. If validation passes, the API attempts a Prisma $connect() call to verify that the Atlas cluster is reachable at the given address. If the connection attempt times out or is refused, an error message explains the likely cause (wrong cluster name, IP whitelist not set) and the user is returned to the input form. If the connection succeeds, Prisma runs a db push operation to synchronise the schema to the Atlas cluster — this creates all collections and indexes defined in schema.prisma if they do not already exist. The API then seeds the initial Superadmin account using the credentials provided in a second step (the page transitions to a Superadmin creation form after db push succeeds). Finally, the DATABASE_URL is persisted, db_configured is written to SystemConfig, and the user is redirected to /login.

### State B — Database Healthy

After successful configuration, or when a Superadmin returns to /config and the database is reachable, the page shows the healthy state. A green "Database Healthy" status badge is shown. The page displays the connected cluster name extracted from the connection string, the MongoDB Atlas region if available from the connection metadata, current roundtrip latency to the database in milliseconds (measured by timing a minimal Prisma query), and document counts for each collection (User, ClassGroup, Student, MarkRecord, SystemConfig). Two action buttons are available: "Run Health Check" refreshes all the displayed metrics, and "Update Connection String" transitions to an edit form pre-populated with the current connection string (obfuscated, showing only the cluster name and username, with the password redacted).

### State C — Database Unreachable

If the Superadmin navigates to /config and the database connection fails, the page shows the unreachable state. A red "Database Unreachable" badge is shown. The raw Prisma error message (with any credentials stripped from it) is displayed for diagnostic purposes. A troubleshooting checklist is shown: check that the Atlas cluster is not paused, verify that 0.0.0.0/0 is in the Atlas Network Access list, confirm that VERCEL_API_TOKEN is valid if the connection string was recently updated, and check the Vercel function logs for more detailed error messages.

### Vercel Environment Variable Integration

When the connection string is submitted and validated, the application must write DATABASE_URL as an environment variable in Vercel so that it persists across redeployments and is available to all future serverless function invocations. This requires the Vercel REST API and a VERCEL_API_TOKEN stored as a Vercel environment variable at project setup time.

The API sequence for persisting the environment variable is: validate the connection string format, test the Prisma connection, call the Vercel REST API endpoint to upsert the DATABASE_URL environment variable for the production environment, write db_configured=true to SystemConfig (the only operation that uses the new database connection to confirm it works end-to-end), and optionally trigger a Vercel redeployment via the Vercel API so that all future builds pick up the new DATABASE_URL from the environment.

If VERCEL_API_TOKEN is not set (which is the expected state in local development), the fallback behaviour is to write DATABASE_URL to .env.local in the project root. This file is read by Next.js in development mode and is excluded from version control by .gitignore. The /config page shows a prominent notice in this fallback mode explaining that the connection string has been written to .env.local and that a Vercel API token will be needed for production deployment.

Connection strings must never appear in application logs, error traces, or HTTP response bodies. Any code path that logs a Prisma error or a request body must strip the DATABASE_URL value before logging. Rate limiting is applied to the /config connection attempt API: a maximum of 5 attempts per IP address per hour. A simple in-memory counter with TTL is acceptable in Phase 1; if UPSTASH_REDIS_REST_URL is available, distributed rate limiting using Upstash is preferred.

---

## 12. Environment Variables Reference

The following table describes all environment variables used in Phase 1.

| Variable | Required | Description |
|---|---|---|
| DATABASE_URL | Required | MongoDB Atlas connection string in mongodb+srv:// format. Written to Vercel env vars through the /config page. |
| NEXTAUTH_SECRET | Required | A cryptographically random 32-byte hex string used to sign and verify JWT session tokens. Generated with openssl rand -hex 32 or equivalent. Must be set in Vercel before first deployment. |
| NEXTAUTH_URL | Required | The canonical base URL of the deployment. In Vercel production this is the primary domain. In development it is typically http://localhost:3000. Used by NextAuth to construct callback URLs. |
| VERCEL_API_TOKEN | Recommended | A Vercel personal access token with permission to write environment variables for the project. Required for the /config page to persist DATABASE_URL to Vercel. Without this, DATABASE_URL is written to .env.local only. |
| VERCEL_PROJECT_ID | Recommended | The Vercel project ID. Required alongside VERCEL_API_TOKEN for the Vercel REST API calls in the /config initialisation flow. |
| CRON_SECRET | Required for Phase 5 | A secret string that Vercel includes as a header on all cron-triggered requests. Route handlers for /api/backup verify this header before executing. Not actively used in Phase 1 but must be set. |
| RESEND_API_KEY | Optional | API key for the Resend email delivery service. Used in the password reset flow to send reset emails. If absent, the SMTP fallback is used. |
| SMTP_HOST | Optional | Hostname of the SMTP relay server for Nodemailer-based email delivery. Fallback if RESEND_API_KEY is absent. |
| SMTP_PORT | Optional | Port number of the SMTP relay (typically 587 for TLS or 465 for SSL). |
| SMTP_USER | Optional | SMTP authentication username. |
| SMTP_PASS | Optional | SMTP authentication password. |
| UPSTASH_REDIS_REST_URL | Optional | REST URL for the Upstash Redis instance used for distributed rate limiting on /config and authentication endpoints. If absent, in-memory rate limiting is used (not suitable for multi-instance production). |
| BLOB_READ_WRITE_TOKEN | Optional (Phase 5) | Vercel Blob storage token for backup file storage. Not used in Phase 1. |
| AWS_ACCESS_KEY_ID | Optional (Phase 5) | AWS credentials for S3 backup storage. Not used in Phase 1. |
| AWS_SECRET_ACCESS_KEY | Optional (Phase 5) | AWS secret key for S3 backup storage. Not used in Phase 1. |
| AWS_S3_BUCKET | Optional (Phase 5) | S3 bucket name for backup storage. Not used in Phase 1. |

---

## 13. Deployment Setup

### MongoDB Atlas Setup

Begin by creating a MongoDB Atlas account if one does not exist. Create a new project within Atlas and then a new cluster. For development, the M0 free tier cluster is sufficient. For production, the M10 or higher dedicated tier is recommended for consistent performance. After the cluster is provisioned (typically 3–5 minutes), navigate to Database Access and create a database user with a strong password. Note both the username and password as they form part of the connection string. Navigate to Network Access and add an IP access list entry for 0.0.0.0/0 to allow connections from Vercel's serverless functions, which do not have fixed IP addresses. Copy the connection string from the Connect button in the Atlas UI, replacing the <password> placeholder with the actual database user password.

### Vercel Setup

Fork or import the SchoolMS repository into a new Vercel project. In the Vercel project settings, navigate to Environment Variables and add NEXTAUTH_SECRET (generate a new random value here), NEXTAUTH_URL (set to the Vercel production URL, e.g., https://schoolms.vercel.app), VERCEL_PROJECT_ID (found in the Vercel project settings URL), and VERCEL_API_TOKEN (generated from the Vercel account tokens page with permissions to read and write environment variables). Do not add DATABASE_URL at this stage — it will be added through the /config onboarding flow. Deploy the project. The initial build will succeed but the application will be in the "not configured" state until the /config flow is completed.

After deployment, navigate to the /config page on the live deployment URL. Paste the MongoDB Atlas connection string and complete the initialisation flow. Once complete, navigate to /login and sign in with the Superadmin credentials created during initialisation.

### GitHub Actions CI/CD

The CI/CD pipeline is defined in a workflow file in .github/workflows/. The workflow triggers on pull_request events targeting the main branch. The pipeline runs four jobs in parallel: TypeScript type checking (runs tsc --noEmit), ESLint linting (runs the lint script), Vitest unit tests (runs the test script), and Prisma schema validation (runs prisma validate). All four jobs must pass before a pull request can be merged.

Merging a pull request to main automatically triggers a Vercel production deployment. Vercel also creates a preview deployment for every open pull request, giving reviewers a live URL to inspect changes before merging. The Vercel build command is set to prisma generate && next build, ensuring the Prisma client is always regenerated from the current schema before the Next.js build runs.

For the CI environment, the GitHub Actions workflow must provide a minimal set of environment variables so that TypeScript checking and Prisma validation can run. DATABASE_URL in CI is set to a dummy mongodb+srv:// string — no actual database connection is made during CI runs. NEXTAUTH_SECRET is set to a static test value in the CI environment.

---

## 14. Security Baseline

### Password Hashing

All passwords are hashed with bcrypt using a cost factor of 12 rounds. This is the minimum recommended setting for 2025-era hardware. bcrypt is chosen specifically because its work factor makes it resistant to GPU-accelerated brute-force attacks — unlike faster algorithms like SHA-256 which are designed for speed and are therefore less suitable for password storage. The passwordHash field is never returned in any API response. Any Prisma query that fetches a User document for display purposes must explicitly exclude the passwordHash field using a select clause.

### Cookie Security

All three hardening attributes — httpOnly, secure, and sameSite=strict — are applied to the session cookie. httpOnly prevents JavaScript running in the browser from reading the cookie, which eliminates session-token theft via XSS. The secure attribute ensures the cookie is only transmitted over HTTPS connections, which prevents interception on unencrypted connections. sameSite=strict prevents the browser from including the cookie on any cross-origin request, which is a strong CSRF defence that makes the need for a separate CSRF token less critical. In development over HTTP, the secure flag cannot be set; developers should accept that the local environment is not production-equivalent and should never test with real credentials in development.

### CSRF Protection

The sameSite=strict cookie setting provides the primary CSRF protection. For Phase 1, no additional CSRF token mechanism is implemented. If a future security review identifies a specific cross-site attack vector that sameSite=strict does not cover, a double-submit CSRF token pattern can be added in a subsequent phase. For now, the combination of sameSite=strict cookies and the use of Authorization headers (rather than cookies) for any third-party integrations provides adequate protection for the Phase 1 threat model.

### Rate Limiting

The /config connection attempt endpoint, the /login endpoint, and the /api/auth/forgot-password endpoint are rate-limited. The limit is 5 attempts per IP address per 60-minute window. If UPSTASH_REDIS_REST_URL is set, rate limit counters are stored in Redis, which means the limit is enforced correctly across all Vercel serverless function instances. If Redis is not available, an in-memory Map with TTL is used as a fallback — this is not safe for high-traffic multi-instance production but is acceptable for low-traffic development deployments.

### Connection String Security

MongoDB Atlas connection strings contain credentials and must be treated as secrets. They must never appear in code, version control, application logs, or HTTP response bodies. The /config page must redact the password portion of the connection string before storing or displaying it anywhere other than temporary in-memory use during the connection test.

---

## 15. Recommended Task Documents

This phase is complex and spans multiple independent implementation concerns. Five task documents are recommended.

### Task 1 — Project Scaffolding and Tooling Setup

**Covers:** Repository initialisation, package.json configuration, TypeScript setup in strict mode, Tailwind CSS and PostCSS configuration, shadcn/ui installation and base component copying, ESLint configuration, Vitest configuration, and the GitHub Actions CI/CD workflow file. This task produces a building Next.js project with no features but a fully configured toolchain. It also creates the top-level folder structure and all configuration files.

**Estimated Complexity:** Medium — primarily configuration work with no logic, but many interdependent configuration files that must be consistent with each other.

### Task 2 — Prisma Schema and Database Layer

**Covers:** Authoring prisma/schema.prisma with all five models (User, ClassGroup, Student, MarkRecord, SystemConfig), all enums (Role, Term), all embedded types (electives, marks), all indexes, and all relations. Creating lib/prisma.ts as the singleton Prisma client. Creating lib/db-health.ts with the connection health check function that returns latency and collection document counts. Writing unit tests for the health check function using a mocked Prisma client.

**Estimated Complexity:** Medium — the schema is well-specified and non-trivial but is primarily declarative. The singleton client pattern requires careful implementation for serverless environments.

### Task 3 — NextAuth.js Authentication System

**Covers:** The complete NextAuth.js v5 configuration in lib/auth.ts — CredentialsProvider, JWT callback, session callback, cookie security settings, auto-refresh logic, and session invalidation support. The /login page UI (email and password form, error display, redirect-after-login). The password reset flow end-to-end: the forgot-password page, the reset-password page, the /api/auth/forgot-password route handler (token generation, email dispatch via Resend/Nodemailer), and the /api/auth/reset-password route handler (token validation, password update, session invalidation). Unit tests for the bcrypt comparison helper and Zod schema validators. Integration of the role injection into the JWT and session callbacks.

**Estimated Complexity:** High — NextAuth.js v5 has a different API surface to earlier versions, the password reset token lifecycle is security-critical, and session invalidation for JWT strategies requires non-obvious coordination between the token and the User document.

### Task 4 — Middleware and Role-Based Access Control

**Covers:** Authoring middleware.ts with the correct matcher configuration and all three path-type handling logics (dashboard redirect, API 401, /config special logic). Implementing the role guard helper function used inside API route handlers. Creating stub API route handlers for the most critical Phase 1 routes (/api/auth/[...nextauth], /api/health, /api/config/connect) to verify that the middleware behaves correctly around them. Writing the three Zod validators for API body payloads (/config connection string, /login credentials, /api/auth/forgot-password email). End-to-end manual test documentation covering: unauthenticated access to /dashboard (redirects to /login), unauthenticated access to /api/students (returns 401), Staff user accessing Superadmin-only endpoint (returns 403), Superadmin accessing /config after configuration (allowed).

**Estimated Complexity:** High — middleware logic is subtle, the /config special case requires coordination with the database, and role enforcement must be correct or it creates security vulnerabilities.

### Task 5 — Database Configuration Page (/config)

**Covers:** The full /config page implementation across all three states (not configured, healthy, unreachable) with the state management logic. The /api/config/connect route handler implementing the full initialisation sequence: Zod format validation, Prisma $connect test, prisma db push, Superadmin seed, Vercel REST API integration, db_configured write to SystemConfig. The /api/config/health route handler that returns current database status, latency, and collection counts. Rate limiting on /api/config/connect (5 attempts per IP per hour). The .env.local fallback for local development when VERCEL_API_TOKEN is absent. The Superadmin account creation form shown after successful db push. Connection string redaction in all logs and response bodies.

**Estimated Complexity:** High — this is the most complex single page in Phase 1, involving multi-step async sequences, error recovery paths, external API calls to Vercel, secure credential handling, and three distinct UI states.

---

## 16. Phase Completion Checklist

The following checklist must be fully satisfied before Phase 2 begins:

**Project Setup**
- Next.js 14 project builds with zero TypeScript errors in strict mode.
- ESLint runs clean with no warnings on any committed file.
- Vitest runs all Phase 1 unit tests and all pass.
- GitHub Actions CI passes on a sample pull request.
- Vercel preview deployment is generated for an open pull request.

**Database Layer**
- prisma/schema.prisma contains all five models with correct fields, types, enums, embedded types, and indexes.
- prisma validate completes without errors.
- lib/prisma.ts exports a singleton Prisma client.
- lib/db-health.ts returns health metadata including latency and collection counts.
- A MongoDB Atlas cluster is connected and all collections exist.

**Authentication**
- /login page loads, accepts credentials, issues a session cookie, and redirects to /dashboard.
- An incorrect password on /login shows a generic error and does not reveal whether the email exists.
- The session cookie has httpOnly, secure, and sameSite=strict attributes set.
- The JWT contains id, email, name, and role fields.
- The password reset flow completes end-to-end: email received, token link works, new password accepted, old session invalidated.
- Session auto-refresh re-mints a token within the 2-hour-before-expiry window.

**Access Control**
- Unauthenticated request to /dashboard redirects to /login.
- Unauthenticated request to /api/students returns HTTP 401 with a JSON body.
- Authenticated Staff user requesting a Superadmin-only API endpoint receives HTTP 403.
- Superadmin can access /config after initialisation.
- Non-Superadmin authenticated user navigating to /config is redirected to /dashboard.

**Database Configuration Page**
- /config in first-run state (db not configured) shows State A without requiring authentication.
- Submitting a malformed connection string shows a Zod validation error without attempting a database connection.
- Submitting a valid connection string to an unreachable cluster shows State C with the error message.
- Full initialisation sequence completes: connection test, schema push, Superadmin creation, DATABASE_URL persisted, db_configured written.
- After initialisation, /config shows State B with live health metrics.
- Rate limiting blocks the 6th connection attempt within a 60-minute window.

**Security**
- Passwords are stored as bcrypt hashes with cost factor ≥ 12.
- No connection string appears in any log output or response body.
- NEXTAUTH_SECRET is set in Vercel and is not the same as the CRON_SECRET.

**Deployment**
- Production deployment on Vercel is live and accessible at NEXTAUTH_URL.
- All required environment variables are set in Vercel production environment.
- Vercel build command runs prisma generate before next build.

---

## 17. Dependencies and Blockers

### What Phase 2 Requires From Phase 1

Phase 2 implements the core dashboard UI and the student management system. It depends on Phase 1 for the following:

- A working session system — the dashboard layout renders user-specific navigation based on the role in the session. If sessions are not working, the dashboard cannot be built.
- The complete Prisma schema — Phase 2 creates, reads, and updates ClassGroup and Student documents. These models must exist and have the correct shape before Phase 2 API routes and forms can be written.
- Middleware and role enforcement — the dashboard routes, the student API endpoints, and the class management endpoints all require the middleware and role guards established in Phase 1.
- The singleton Prisma client — all Phase 2 API routes import from lib/prisma.ts.
- The Superadmin account — manual testing of Phase 2 features requires an authenticated Superadmin session.

### Blockers That Could Stall Phase 1

- Atlas cluster not provisioned or network access not configured globally — the /config page cannot complete initialisation without a reachable Atlas endpoint.
- VERCEL_API_TOKEN absent or lacking env var write permissions — DATABASE_URL cannot be persisted to Vercel, blocking seamless redeployment behaviour.
- NextAuth.js v5 beta API changes — v5 is in beta and its API surface can change between releases. The implementation must pin to a specific v5 beta version tag in package.json and not use a floating "latest" specifier.
- TypeScript errors from Prisma-generated types — Prisma generates types based on the schema; if the schema has errors, the TypeScript build fails entirely. The schema must be validated with prisma validate as part of the CI pipeline before any TypeScript compilation step.
- bcrypt native module compilation — bcrypt requires native Node.js compilation, which can fail in certain CI environments. The bcryptjs (pure JavaScript implementation) alternative should be considered if native compilation proves problematic, with the understanding that it is marginally slower.

### Inter-Phase Data Contracts

Phase 1 establishes the data contracts that all subsequent phases depend on. The shape of the MarkRecord marks embedded document is particularly critical — Phase 3 (mark entry and progress reports) and Phase 4 (analytics) both read and write to this exact structure. Any change to field names or the nullable integer type convention for marks after Phase 1 has been completed will require updates across multiple phases. The schema should be treated as frozen after Phase 1 sign-off.

The session object shape (userId, email, name, role) is used in every Server Component and API route handler written in Phases 2 through 5. Changing the session shape after Phase 1 would be a broad refactor. The four fields must be confirmed correct before Phase 2 begins.

---

*End of Phase 1 Overview Document*
