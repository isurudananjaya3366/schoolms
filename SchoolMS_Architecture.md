# SchoolMS — System Architecture & Technical Specification

> **Document Version:** 1.0.0 — Initial Release
> **Status:** Draft — For Review
> **Target Platform:** Vercel (Next.js) + MongoDB Atlas
> **Scope:** Grades 6–11, Full-Stack Web Application

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Database Schema (Prisma + MongoDB)](#4-database-schema-prisma--mongodb)
5. [Authentication & Authorisation System](#5-authentication--authorisation-system)
6. [Admin Dashboard](#6-admin-dashboard)
7. [Database Configuration Page (`/config`)](#7-database-configuration-page-config)
8. [Automated Daily Backup System](#8-automated-daily-backup-system)
9. [Infographics & Data Visualisation](#9-infographics--data-visualisation)
10. [Preview Mode](#10-preview-mode)
11. [API Routes Reference](#11-api-routes-reference)
12. [Progress Report & W-Rule Implementation](#12-progress-report--w-rule-implementation)
13. [Security Architecture](#13-security-architecture)
14. [Deployment & DevOps](#14-deployment--devops)
15. [Testing Strategy](#15-testing-strategy)
16. [Future Roadmap & Extensibility](#16-future-roadmap--extensibility)

---

## 1. Executive Summary

SchoolMS is a full-stack, cloud-hosted web application designed to digitize the academic record-keeping, mark analysis, and progress reporting workflows for secondary schools serving Grades 6 through 11. The system replaces paper-based term-test ledgers with a structured relational model, automated grading rules, dynamic data visualizations, and printable PDF progress reports.

This Architecture Document covers every layer of the system: from the public-facing authentication surface, through the multi-role administrative dashboard, down to the database schema, backup strategy, infographic engine, and the deployment pipeline on Vercel. Engineers, product managers, and infrastructure administrators should all find their relevant concerns addressed in dedicated sections below.

### Key Architectural Goals

| # | Goal | Description |
|---|------|-------------|
| 1 | **Zero-Dependency Setup** | A fresh deployment should work by pasting a single MongoDB connection string — no other manual provisioning required. |
| 2 | **Role-Based Security** | Three distinct access tiers (Superadmin, Admin, Staff) enforce least-privilege access across every API route and UI component. |
| 3 | **Serverless-First** | All API routes are Next.js serverless functions, keeping operational overhead near zero on Vercel. |
| 4 | **Offline-Tolerant UI** | The dashboard degrades gracefully when the database is unreachable, showing clear status indicators rather than blank pages. |
| 5 | **Data Integrity** | The "W Rule" (mark < 35 → display "W") is enforced both on the backend and in every export/print path, never just in the UI layer. |
| 6 | **Observability** | Daily backup logs, audit trails for mark edits, and a health endpoint give administrators full visibility into system state. |

---

## 2. Technology Stack

The technology stack was selected to maximize developer productivity, minimise infrastructure cost, and ensure long-term maintainability. Every layer is TypeScript-first, enabling end-to-end type safety from the database model through to the React component props.

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend Framework** | Next.js 14 (App Router) | File-system routing, React Server Components, built-in API routes, and seamless Vercel deployment. The App Router enables granular streaming and per-route caching. |
| **Styling** | Tailwind CSS v3 | Utility-first CSS eliminates context switching. JIT compilation keeps the production bundle minimal. Dark-mode and responsive breakpoints are trivial to implement. |
| **Component Library** | shadcn/ui | Accessible, unstyled Radix UI primitives styled with Tailwind. Components are copied into the project (no runtime dependency), making customisation straightforward. |
| **ORM / Data Layer** | Prisma ORM | Type-safe database client generated from a declarative schema. Migrations, seeding, and introspection are handled automatically. Works with MongoDB via the MongoDB Prisma connector. |
| **Database** | MongoDB Atlas (Cloud) | Document-oriented storage fits the flexible subject/elective model. Atlas provides automated snapshots, global distribution, and a generous free tier. Connected via a standard connection string. |
| **Authentication** | NextAuth.js v5 | Battle-tested session management with JWT support. Supports credentials, OAuth providers, and custom callbacks for role injection. Middleware protection of all dashboard routes. |
| **Charts / Infographics** | Recharts + D3.js | Recharts provides React-native bar/line/area charts for progress reports. D3 is used for bespoke SVG infographics (grade-distribution heatmaps, cohort scatter plots). |
| **PDF Generation** | `@react-pdf/renderer` | Server-side PDF rendering using a React component tree. Allows the progress report layout to be maintained as a single source of truth for both screen and print. |
| **Deployment** | Vercel | Zero-config deployment from GitHub. Edge network, preview URLs per PR, environment variable management, serverless function logs, and cron job support (Vercel Cron) for backups. |
| **Backup Storage** | AWS S3 / Vercel Blob | Daily backup files (BSON dumps or JSON exports) are uploaded to an object store with lifecycle rules. Vercel Blob is used if AWS credentials are not configured. |
| **Email (Alerts)** | Resend / Nodemailer | Backup failure alerts and password-reset emails are sent via Resend (preferred) or Nodemailer with any SMTP relay. |

### 2.1 Dependency Version Matrix

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 14.x | App Router required; Pages Router not used |
| `react` / `react-dom` | 18.x | Concurrent features enabled |
| `typescript` | 5.x | Strict mode enabled in `tsconfig.json` |
| `tailwindcss` | 3.x | PostCSS integration; JIT mode |
| `@prisma/client` | 5.x | Generated types from `schema.prisma` |
| `prisma` | 5.x | Dev dependency for migrations & generate |
| `next-auth` | 5.x (beta) | App Router compatible version |
| `@radix-ui/*` | latest | Peer deps of shadcn/ui; installed per component |
| `recharts` | 2.x | `ResponsiveContainer` used for all charts |
| `d3` | 7.x | Used only for bespoke SVG infographics |
| `@react-pdf/renderer` | 3.x | Server-side PDF generation |
| `zod` | 3.x | Schema validation for all API inputs |
| `zustand` | 4.x | Lightweight global state (UI only, not auth) |
| `date-fns` | 3.x | Date formatting and manipulation |

---

## 3. System Architecture Overview

SchoolMS follows a layered, serverless architecture. The diagram below depicts the high-level request flow and component relationships.

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE OVERVIEW                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [ Browser / Client ]                                       │
│         │  HTTPS                                            │
│  [ Vercel Edge Network ]  (CDN + WAF)                       │
│         │                                                   │
│  [ Next.js Application ]  (App Router)                      │
│     ├── /app/(auth)/**        ← Login, Register, Reset      │
│     ├── /app/dashboard/**     ← Protected Admin UI          │
│     ├── /app/config           ← DB Setup Page               │
│     └── /app/api/**           ← Serverless API Routes       │
│         │                                                   │
│  [ Prisma ORM ]  ← Type-safe query builder                  │
│         │  mongodb+srv://                                   │
│  [ MongoDB Atlas ]  ← Cloud Database (Primary)              │
│                                                             │
│  Side channels:                                             │
│  [ Vercel Cron ] → /api/backup → [ S3 / Vercel Blob ]       │
│  [ Resend / SMTP ] ← Backup alerts, password reset          │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Request Lifecycle

1. Browser sends HTTPS request to Vercel edge.
2. Vercel routes to the appropriate serverless function (Next.js route handler or Server Component).
3. NextAuth.js middleware validates the session JWT on all `/dashboard/**` and `/api/**` paths.
4. Role guard checks the user's role against the route's required permission tier.
5. The route handler calls Prisma, which resolves `DATABASE_URL` from environment variables.
6. Prisma translates the query to MongoDB wire protocol and executes against Atlas.
7. The response is serialised (JSON for API routes, RSC payload for Server Components) and returned.
8. React hydrates the client components; charts and interactive widgets attach their event listeners.

### 3.2 Folder Structure (Next.js App Router)

```
schoolms/
├── app/
│   ├── (auth)/
│   │   ├── login/            page.tsx
│   │   ├── register/         page.tsx
│   │   └── reset-password/   page.tsx
│   ├── config/               page.tsx   ← Database setup (no auth guard)
│   ├── dashboard/
│   │   ├── layout.tsx        ← Sidebar + session provider
│   │   ├── page.tsx          ← Overview / home
│   │   ├── students/
│   │   ├── marks/
│   │   ├── reports/
│   │   ├── analytics/
│   │   ├── backup/
│   │   └── settings/
│   ├── preview/[reportId]/   page.tsx   ← Presentation preview (new tab)
│   └── api/
│       ├── auth/[...nextauth]/  route.ts
│       ├── config/              route.ts
│       ├── students/            route.ts
│       ├── marks/               route.ts
│       ├── reports/             route.ts
│       └── backup/              route.ts
├── components/
│   ├── ui/                   ← shadcn/ui copies
│   ├── dashboard/            ← layout, sidebar, topbar
│   ├── charts/               ← Recharts wrappers
│   └── infographics/         ← D3 visualisations
├── lib/
│   ├── prisma.ts             ← Singleton Prisma client
│   ├── auth.ts               ← NextAuth config
│   ├── db-health.ts          ← Connection health check
│   ├── w-rule.ts             ← W-Rule utility functions
│   └── backup.ts             ← Backup orchestration
├── prisma/
│   └── schema.prisma
└── middleware.ts             ← NextAuth session + role enforcement
```

---

## 4. Database Schema (Prisma + MongoDB)

All models are defined in `prisma/schema.prisma` and compiled into a fully-typed Prisma Client. Because the connector is MongoDB, relations are expressed as embedded documents or manual references rather than SQL foreign-key joins.

### 4.1 Core Models

#### User

```prisma
model User {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(STAFF)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     Session[]
}

enum Role { SUPERADMIN ADMIN STAFF }
```

#### ClassGroup

```prisma
model ClassGroup {
  id       String  @id @default(auto()) @map("_id") @db.ObjectId
  grade    Int     // 6 to 11
  section  String  // A to F
  students Student[]
}
```

#### Student

```prisma
model Student {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  indexNumber String     @unique
  classId     String     @db.ObjectId
  class       ClassGroup @relation(fields: [classId], references: [id])
  electives   Electives  // Embedded document
  markRecords MarkRecord[]
  createdAt   DateTime   @default(now())
}

type Electives {
  categoryI   String   // e.g. "Geography"
  categoryII  String   // e.g. "Music"
  categoryIII String   // e.g. "ICT"
}
```

#### MarkRecord

```prisma
model MarkRecord {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  studentId String   @db.ObjectId
  student   Student  @relation(fields: [studentId], references: [id])
  term      Term     // TERM_1 | TERM_2 | TERM_3
  year      Int      // Academic year, e.g. 2024
  marks     Marks    // Embedded sub-document
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  updatedBy String   @db.ObjectId  // Audit: User who last edited
}

enum Term { TERM_1 TERM_2 TERM_3 }

type Marks {
  sinhala     Int?
  buddhism    Int?
  maths       Int?
  science     Int?
  english     Int?
  history     Int?
  categoryI   Int?
  categoryII  Int?
  categoryIII Int?
}
```

#### SystemConfig

A single-document collection that stores runtime configuration, including the database connection status flag and backup schedule.

```prisma
model SystemConfig {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt
}
```

> **Key records:** `db_configured` (boolean), `backup_cron` (cron expression), `backup_storage_type` (s3|vercel_blob), `last_backup_at` (ISO timestamp), `last_backup_status` (success|failed).

### 4.2 Indexes

| Collection | Index | Purpose |
|------------|-------|---------|
| `Student` | `indexNumber` (unique) | Fast lookup by student ID during mark entry |
| `Student` | `classId` | List all students in a class efficiently |
| `MarkRecord` | `studentId + term + year` | Unique compound — prevents duplicate term entries |
| `MarkRecord` | `term + year` | Batch queries for class-wide mark entry view |
| `User` | `email` (unique) | NextAuth login lookup |
| `SystemConfig` | `key` (unique) | O(1) config value retrieval |

---

## 5. Authentication & Authorisation System

Authentication is handled end-to-end by NextAuth.js v5, configured for the App Router. Every page under `/dashboard/**` and every API route under `/api/**` (except `/api/auth/**` and `/api/config/health`) is protected by middleware that validates the session JWT and enforces role-based access control (RBAC).

### 5.1 Role Definitions

| Role | Permissions |
|------|-------------|
| `SUPERADMIN` | Full unrestricted access. Can create/delete Admin and Staff accounts, view audit logs, access the database config page, manage backup settings, and perform system-wide operations. Only one Superadmin should exist in production. |
| `ADMIN` | Can create/delete Staff accounts, manage all student records, perform batch mark entry for any class, generate reports for any student, and view all analytics. Cannot access database config or backup settings. |
| `STAFF` | Read-only access to student lists. Can enter marks only for their assigned classes and subjects. Cannot delete records, create accounts, or access system settings. |

### 5.2 Authentication Flows

#### 5.2.1 Login Flow

1. User navigates to `/login`.
2. Enters email + password into the credentials form.
3. NextAuth `CredentialsProvider` calls `signIn` callback.
4. Callback queries MongoDB for the `User` document by email.
5. `bcrypt.compare()` validates the submitted password against `passwordHash`.
6. On success, NextAuth mints a signed JWT containing `{ id, email, role, name }`.
7. The JWT is stored as an `httpOnly`, `secure`, `sameSite=strict` cookie.
8. User is redirected to `/dashboard` (or the originally requested protected URL).

#### 5.2.2 Middleware Enforcement

The file `middleware.ts` runs on every request before any route handler or page render:

```ts
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/config'],
}

// For /config:    allow only if no DB is configured OR user is SUPERADMIN
// For /dashboard: require valid session
// For /api:       require valid session + role check per endpoint
```

> **Note:** The `/config` page is intentionally accessible without authentication when no database is yet configured, so the initial setup can be completed. After configuration, only `SUPERADMIN` can access it.

#### 5.2.3 Password Reset Flow

1. User clicks "Forgot Password" on the login page and submits their email address.
2. API generates a time-limited (1-hour) cryptographically signed reset token.
3. Token is stored (hashed) in the `User` document; reset email is sent via Resend.
4. User clicks the link in the email, which includes the raw token.
5. API validates the token, checks expiry, and renders the reset form.
6. On form submission, API hashes the new password, updates `passwordHash`, and invalidates the token.
7. All existing sessions for that user are invalidated.

### 5.3 Session Architecture

- **Strategy:** JWT (stateless) — no database session store required.
- **Cookie:** `httpOnly`, `secure`, `sameSite=strict`, `maxAge=8h`.
- **Session contains:** `userId`, `email`, `role`, `name`, `iat`, `exp`.
- **Role re-validation:** Role is re-validated on sensitive write operations (not just read from cookie) to prevent privilege escalation after a role change mid-session.
- **Auto-refresh:** If the JWT is within 2 hours of expiry and the user is active, it is silently re-minted.

---

## 6. Admin Dashboard

The dashboard is the primary interface for all three user roles. It is structured around a persistent side navigation menu, a top header bar, and a main content area that renders the active page. The layout is implemented as a React Server Component (`app/dashboard/layout.tsx`) wrapping all child routes.

### 6.1 Side Navigation Menu

The sidebar is always visible on desktop (`>= lg` breakpoint) and collapses to an off-canvas drawer on mobile, implemented using the shadcn/ui `Sheet` component.

| Icon | Nav Item | Route | Description | Min Role |
|------|----------|-------|-------------|----------|
| 🏠 | Overview | `/dashboard` | KPI cards: total students, marks entered, pending entries, recent activity feed. | ALL |
| 👥 | Students | `/dashboard/students` | Searchable, paginated table of all students. Filter by grade and class. | ALL |
| ➕ | Add Student | `/dashboard/students/new` | Form to create a new student profile and assign to a class. | ADMIN |
| ✏️ | Enter Marks | `/dashboard/marks/entry` | Batch mark entry: select grade, class, term, subject → data grid. | ALL |
| 📊 | View Marks | `/dashboard/marks/view` | Read-only marks browser. Filter by student, term, subject. | ALL |
| 📄 | Progress Reports | `/dashboard/reports` | Generate, preview, and download individual student PDF progress reports. | ALL |
| 📈 | Analytics | `/dashboard/analytics` | Cohort-level analytics: grade distribution, subject averages, W-rate per subject. | ADMIN |
| 🗄️ | Backup & Restore | `/dashboard/backup` | View backup history, trigger manual backup, configure schedule. | SUPERADMIN |
| ⚙️ | Settings | `/dashboard/settings` | School name, academic year, elective subject configuration. | ADMIN |
| 👤 | User Management | `/dashboard/settings/users` | Create, edit, and deactivate user accounts. Assign roles. | ADMIN |
| 🔒 | Audit Log | `/dashboard/settings/audit` | Chronological log of all mark edits, user logins, and configuration changes. | SUPERADMIN |

### 6.2 Dashboard Overview Page

The `/dashboard` home page provides an at-a-glance operational summary. It is rendered as a Server Component and streams data from parallel Prisma queries.

**KPI Cards (Top Row)**
- Total Students Enrolled (with delta vs. previous year)
- Mark Records This Term (count of `MarkRecord` entries for current term/year)
- Pending Mark Entry (students with zero mark records this term)
- W-Rate This Term (percentage of mark fields displaying W across all students)

**Recent Activity Feed**
- Last 20 audit log entries, formatted as human-readable sentences (e.g., *"Admin John updated Maths marks for Samith Dilmeth, Grade 10A"*).

**Quick Actions**
- Button: Enter Marks → `/dashboard/marks/entry`
- Button: Add Student → `/dashboard/students/new`
- Button: Generate Report → opens a student search dialog

### 6.3 Student Management Pages

#### 6.3.1 Student List (`/dashboard/students`)

- Server-side paginated table (20 rows/page) using Prisma `skip`/`take`.
- Filters: Grade (6–11), Class (A–F), Search by name or index number.
- Table columns: Index No. | Name | Grade | Class | Electives | Actions (View / Edit / Delete).
- Bulk select with CSV export action.

#### 6.3.2 Student Profile (`/dashboard/students/[id]`)

- Header: Student Name, Index Number, Grade, Class, Elective subjects.
- Edit Profile button (Admin only).
- Marks Table: terms as rows, subjects as columns. W-rule applied in display.
- W-Note: auto-generated note below table listing subjects below 35.
- Performance Bar Chart: clustered Recharts `BarChart` (see Section 9).
- Generate PDF Report button.
- **Preview Mode button** — opens `/preview/[studentId]` in a new tab.

### 6.4 Mark Entry Page (`/dashboard/marks/entry`)

This page is the most frequently used interface for day-to-day operations.

1. Select **Grade** from dropdown (6–11).
2. Select **Class** from dropdown (A–F), filtered dynamically.
3. Select **Term** (I, II, or III).
4. Select **Subject** from the compiled list (6 core + 3 elective categories).
5. A data grid renders: one row per student, one input field per row.
6. Input fields accept integers 0–100. Invalid input is highlighted red.
7. Values < 35 trigger a yellow warning indicator in the cell (actual W display is only on the report).
8. **Save** button: batch `PATCH /api/marks` with all changed values.
9. Unsaved changes: browser `beforeunload` warning.

> **Note:** The W-rule conversion is never applied at input time. Raw marks are always stored. The W display is only applied at report/view render time.

---

## 7. Database Configuration Page (`/config`)

The `/config` page serves a dual purpose: it is the initial setup wizard for a fresh deployment, and it is the ongoing health monitor for Superadmins. It is the only privileged page that may be accessed without an active session (when no database is configured).

### 7.1 Access Control Logic

```ts
// Pseudocode — middleware.ts
if (request.pathname === '/config') {
  const dbConfigured = await checkDbFlag(); // reads NEXT_PUBLIC_DB_CONFIGURED env
  if (!dbConfigured) return NextResponse.next(); // allow unauthenticated

  const session = await getServerSession();
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.redirect('/dashboard');
  }
  return NextResponse.next();
}
```

### 7.2 Page States

#### State A — Database Not Configured (first run)

- Full-page centred card with SchoolMS logo.
- Status badge: **"No Database Configured"** (red).
- Instructions: *"Paste your MongoDB Atlas connection string below to initialise the system."*
- Text area for the connection string (`mongodb+srv://...`).
- **"Connect & Initialise"** button.
- On submit: validates the string format → attempts a Prisma `$connect()` → runs `db push` to sync schema → seeds the initial Superadmin account (prompted in a second step) → writes the `DATABASE_URL` to Vercel environment variables via the Vercel API.

#### State B — Database Healthy (configured and reachable)

- Status badge: **"Database Healthy"** (green).
- Displays: Connected cluster name, MongoDB Atlas region, latency (ms), document counts per collection.
- **"Run Health Check"** button to re-ping the database.
- **"Update Connection String"** button (destructive, requires confirmation).
- Link to MongoDB Atlas console.

#### State C — Database Unreachable (configured but offline)

- Status badge: **"Database Unreachable"** (red).
- Error message from Prisma (timeout, auth failure, etc.).
- Troubleshooting checklist: IP whitelist, Atlas cluster paused, connection string rotation.
- **"Retry Connection"** button.
- **"Update Connection String"** button.

### 7.3 Vercel Environment Variable Integration

> ⚠️ **Warning:** Writing to Vercel environment variables from a running deployment requires the Vercel REST API and a Vercel API Token with `write` permissions. This token must be supplied as a build-time secret (`VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID`).

When the user submits a new connection string, the following sequence executes server-side:

1. Validate the submitted string (regex: `/^mongodb(\+srv)?:\/\/.+/`).
2. Attempt a test connection via a temporary Prisma Client instance.
3. On success, call the Vercel API to upsert the `DATABASE_URL` environment variable:

```http
PATCH https://api.vercel.com/v9/projects/{projectId}/env/{envId}
Authorization: Bearer {VERCEL_API_TOKEN}
Content-Type: application/json

{
  "key": "DATABASE_URL",
  "value": "<connectionString>",
  "target": ["production", "preview"]
}
```

4. Store a confirmation flag (`db_configured = true`) in the `SystemConfig` collection.
5. Trigger a Vercel redeployment (optional, via Vercel Deploy Hook) so all serverless functions pick up the new `DATABASE_URL` without a cold-start mismatch.
6. Redirect to the Superadmin account creation step.

> ✅ **Tip:** If `VERCEL_API_TOKEN` is not present (e.g., local development), the system falls back to writing the connection string to a local `.env.local` file, and displays a notice to manually redeploy.

> ℹ️ **Note:** MongoDB Atlas connection strings contain credentials. The API route that accepts the string must be rate-limited (max 5 attempts per IP per hour) and the string must never be logged in plaintext.

---

## 8. Automated Daily Backup System

Data integrity is paramount in an academic context. The backup system provides daily automatic snapshots, configurable retention policies, and email alerts on failure. It is built on Vercel Cron Jobs and stores backup artifacts in either AWS S3 or Vercel Blob Storage.

### 8.1 Architecture

| Component | Description |
|-----------|-------------|
| **Vercel Cron Job** | Triggers `GET /api/backup` at a configurable cron expression (default: `0 2 * * *` — daily at 2:00 AM UTC). Configured in `vercel.json`. |
| **Backup API Route** | `/api/backup/route.ts` — validates the `CRON_SECRET` header, orchestrates the backup, uploads the artifact, and updates `SystemConfig`. |
| **Export Strategy** | Uses Prisma to read all collections and serialises them to a structured JSON file. Each collection is a top-level key with an array of documents. |
| **Compression** | The JSON file is gzipped using Node's `zlib.gzip()` before upload, reducing storage by ~60–70%. |
| **Storage** | Primary: AWS S3 (if `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` env vars are set). Fallback: Vercel Blob Storage. |
| **Retention Policy** | Keeps the last 30 daily snapshots. Older files are deleted automatically by the cleanup step in the backup route. |
| **Alert on Failure** | If any step throws, the error is caught, logged to the audit collection, and an email is sent via Resend to all `SUPERADMIN` email addresses. |
| **Manual Trigger** | SUPERADMIN can trigger an immediate backup from `/dashboard/backup` by calling `POST /api/backup` with a valid session. |
| **Restore** | A restore endpoint (`POST /api/backup/restore`) accepts a backup file ID, downloads the artifact, decompresses it, and uses Prisma `createMany()` to reinstate all documents. Existing documents are preserved; conflicts are skipped. |

### 8.2 Backup File Format

```json
// backup-2024-07-15T02-00-00.json.gz (after decompression)
{
  "meta": {
    "version": "1.0",
    "timestamp": "2024-07-15T02:00:00.000Z",
    "schoolName": "XYZ National School",
    "totalStudents": 342,
    "totalMarkRecords": 1026
  },
  "users": [ ... ],
  "classGroups": [ ... ],
  "students": [ ... ],
  "markRecords": [ ... ],
  "systemConfig": [ ... ]
}
```

### 8.3 Vercel Cron Configuration (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/backup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

> ℹ️ **Note:** Vercel Cron Jobs are only available on **Pro and Enterprise** plans. On the free Hobby plan, the cron will not execute automatically. Superadmins should trigger manual backups on the Hobby plan.

### 8.4 Backup Dashboard (`/dashboard/backup`)

- Table of all backup artifacts: date, size, status (success/failed), storage location.
- Download button per backup.
- Restore button per backup (requires confirmation dialog with "type `RESTORE` to confirm" safeguard).
- Delete button per backup (SUPERADMIN only).
- Configure Backup section: adjust cron schedule, toggle storage provider, set alert email.
- **Manual Backup Now** button.

---

## 9. Infographics & Data Visualisation

The system provides three tiers of visual output: (1) individual student progress charts embedded in the student profile page, (2) cohort-level analytics on the Analytics page, and (3) a presentation-grade Preview Mode. All charts are responsive and rendered as client components.

### 9.1 Individual Student — Performance Bar Chart

| Property | Specification |
|----------|---------------|
| **Chart Type** | Recharts `<BarChart>` in `"grouped"` (clustered) layout mode. |
| **X-Axis** | Three groups: Term I, Term II, Term III. |
| **Y-Axis** | Marks 0–100 with gridlines at 20, 35 (red dashed "W line"), 50, 75, 100. |
| **Bars per Group** | 9 bars — one per subject (6 core + 3 elective categories). |
| **Bar Colours** | Unique colour per subject (persistent palette using subject name as key). Bars for marks < 35 are rendered in a red/pink hue regardless of subject colour. |
| **Data Labels** | Values ≥ 35: show the numeric score above the bar. Values < 35: show `"W"` above the bar in red bold. |
| **Tooltip** | On hover: shows subject name, raw mark, and W status. |
| **Legend** | Horizontal legend below chart mapping colour to subject name. |
| **Missing Terms** | If Term II or III have no data, those groups render as empty (no bars). A "No data" label is shown. |
| **Responsiveness** | Wrapped in `<ResponsiveContainer width="100%" height={380}>` — chart reflows on window resize. |

### 9.2 Analytics Page — Cohort Infographics (`/dashboard/analytics`)

The Analytics page provides aggregate visualisations for Admins and Superadmins. Data is fetched server-side via React Server Components and passed to client chart components as serialised props.

#### 9.2.1 Grade Distribution Heatmap

- A D3-rendered SVG grid: rows = subjects, columns = mark ranges (0–34, 35–49, 50–64, 65–79, 80–100).
- Each cell is colour-coded by the percentage of students in that range for that subject, using a blue-to-red diverging scale.
- Hovering a cell shows: *"Subject: Maths | Range: 0–34 | Count: 12 students | 14.6%"*.

#### 9.2.2 Subject Average Bar Chart (All Classes)

- A horizontal bar chart showing average mark per subject across the entire grade.
- Bars below 35 are coloured red; 35–50 are amber; above 50 are green.
- Filter controls: Grade selector (6–11), Term selector (I/II/III), Year selector.

#### 9.2.3 W-Rate Tracker (Line Chart Over Terms)

- A multi-line Recharts `LineChart` where each line represents a subject.
- Y-axis: percentage of students with W in that subject. X-axis: Terms.
- Allows teachers to identify subjects where the Warning rate is increasing over time.

#### 9.2.4 Student Performance Scatter Plot

- D3 scatter plot: X-axis = total marks (sum of 9 subjects), Y-axis = student index (ordered alphabetically).
- Points are coloured by the number of W grades (0 = green, 1–2 = amber, 3+ = red).
- Clicking a point navigates to the student's profile page.

#### 9.2.5 Top/Bottom Performers Table

- Two side-by-side tables: Top 10 and Bottom 10 students by total marks this term.
- Links to individual student profiles.

#### 9.2.6 Class Comparison Radar Chart

- Recharts `RadarChart` comparing average marks per subject across parallel classes (e.g., 10A vs 10B vs 10C).
- Each class is a separate coloured polygon.

### 9.3 Export of Infographics

- All chart components expose a **"Download PNG"** button implemented using `html2canvas`.
- The Analytics page has a **"Download Full Analytics Report (PDF)"** button that renders all infographics into a PDF using `@react-pdf/renderer` with embedded SVG/canvas snapshots.

---

## 10. Preview Mode

Preview Mode is a distraction-free, full-screen presentation environment for a student's progress report. It is accessed by clicking **"Preview Mode"** on any student profile page, which opens `/preview/[studentId]` in a new browser tab.

### 10.1 Purpose & Use Cases

- **Parent-teacher consultation:** present a student's progress visually on a shared screen.
- **Staff meetings:** walk through a cohort's performance without leaving the browser.
- **Printing:** the preview mode is styled with `@media print` rules for clean single-page output.

### 10.2 Preview Page Structure

#### Canvas Layout

The preview page occupies `100vw × 100vh` with a dark-mode background. Content is centred in a "slide" canvas of fixed aspect ratio (16:9 or A4, user-selectable). Navigation arrows at the left and right edges allow cycling between slides.

#### Slide Deck

| Slide | Title | Content |
|-------|-------|---------|
| 1 | **Student Overview** | Large student name, index number, grade/class badge, academic year. School logo (if configured in Settings). |
| 2 | **Term I Marks** | Full-width styled table showing all 9 subjects for Term I. W values highlighted in red. Non-entered subjects shown as `—`. |
| 3 | **Term II Marks** | Same layout as Slide 2 for Term II. |
| 4 | **Term III Marks** | Same layout as Slide 2 for Term III. |
| 5 | **Performance Chart** | Full-width clustered bar chart (the same Recharts component used in the student profile, scaled up to fill the slide canvas). Animated entrance on slide load. |
| 6 | **Subject Highlights** | Two-column layout: left = strongest subject (highest average across all terms), right = weakest subject (lowest average / most W grades). Animated number count-up. |
| 7 | **W Summary** | If any marks are W: list of subjects with W and the term in which they occurred, with a recommendation note. If no W grades: a full-slide congratulations card. |
| 8 | **Overall Summary** | Total marks (sum of all entered marks), class rank (if enabled in Settings), and a qualitative descriptor (Excellent / Good / Needs Improvement / Critical). |

### 10.3 Presenter Toolbar

A floating toolbar at the bottom of the preview window provides:

- **Slide counter:** `3 / 8`
- **Previous / Next** slide arrows (keyboard: `←` `→`)
- **Jump to slide:** clicking the counter opens a thumbnail strip
- **Font size control:** increase/decrease text scale (accessibility / projector distance)
- **Theme toggle:** Light slide / Dark slide
- **Aspect ratio toggle:** 16:9 (projector) / A4 (print)
- **Print button:** triggers `window.print()` with current or all slides
- **Download PDF:** generates a multi-page PDF via `@react-pdf` with one slide per page
- **Fullscreen button:** toggles `document.documentElement.requestFullscreen()`
- **Close button:** `window.close()`

> ℹ️ **Note:** The preview page fetches student data server-side (no additional API call from the client) and passes it as serialised JSON to the client component. Slide transitions use Framer Motion `AnimatePresence`.

---

## 11. API Routes Reference

All API routes are Next.js Route Handlers in `/app/api/**`. They accept and return JSON. Authentication is enforced by middleware; role checks are performed inside each handler.

| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| `POST` | `/api/auth/[...nextauth]` | Public | NextAuth.js handler — login, logout, session. |
| `GET` | `/api/config/health` | Public | Returns DB connection status (200 = healthy, 503 = unreachable). No credentials exposed. |
| `POST` | `/api/config` | Superadmin | Accepts new `DATABASE_URL`, validates, writes to Vercel env, seeds DB. |
| `GET` | `/api/students` | All | List students. Query params: `grade`, `classId`, `search`, `page`, `limit`. |
| `POST` | `/api/students` | Admin+ | Create a new student. Body: `{ name, indexNumber, classId, electives }`. |
| `GET` | `/api/students/[id]` | All | Get a single student with full marks history. |
| `PATCH` | `/api/students/[id]` | Admin+ | Update student profile fields. |
| `DELETE` | `/api/students/[id]` | Admin+ | Soft-delete a student (marks preserved, student hidden). |
| `GET` | `/api/marks` | All | Query marks. Params: `studentId`, `term`, `year`, `classId`, `subject`. |
| `POST` | `/api/marks` | All | Create/update marks for a student+term. Idempotent upsert. |
| `PATCH` | `/api/marks/batch` | All | Batch upsert marks for an entire class. Body: `{ classId, term, year, subject, entries: [{studentId, mark}] }`. |
| `GET` | `/api/reports/[studentId]` | All | Returns full report data (marks + student info) for PDF generation. |
| `GET` | `/api/analytics/summary` | Admin+ | Returns aggregated analytics: subject averages, W-rates, class comparisons. |
| `GET` | `/api/backup` | Cron / Superadmin | Triggers backup. Requires `CRON_SECRET` header (Vercel) or Superadmin session. |
| `POST` | `/api/backup/restore` | Superadmin | Initiates a restore from a backup file ID. |
| `GET` | `/api/users` | Admin+ | List all user accounts. |
| `POST` | `/api/users` | Admin+ | Create a user account. Body: `{ name, email, password, role }`. |
| `PATCH` | `/api/users/[id]` | Admin+ | Update a user's name, email, or role. |
| `DELETE` | `/api/users/[id]` | Superadmin | Deactivate a user account. |

---

## 12. Progress Report & W-Rule Implementation

The W-Rule is a core business rule: any raw mark strictly less than 35 must be displayed as `"W"` on all reports and student-facing views. The raw numeric value is always stored and used for calculations.

### 12.1 W-Rule Application Points

| Context | Applies W? | Notes |
|---------|-----------|-------|
| Database storage | ❌ No — raw int stored | Always store exact integer 0–100. |
| Mark Entry input UI | ❌ No — raw int shown | Yellow warning indicator if < 35, but not converted. |
| Student Profile marks table | ✅ Yes — W displayed | `applyWRule(mark)` utility function. |
| PDF Progress Report | ✅ Yes — W displayed | Same utility; PDF rendered server-side. |
| Preview Mode slides | ✅ Yes — W displayed | Same utility in shared `lib/w-rule.ts`. |
| Analytics average calculations | ❌ No — raw int used | W-rule never applied to calculations. |
| Batch export CSV | ⚙️ Configurable | Column header suffix (raw/display) selectable at export time. |

### 12.2 W-Rule Utility (`lib/w-rule.ts`)

```ts
export const W_THRESHOLD = 35;

export function applyWRule(mark: number | null | undefined): string {
  if (mark === null || mark === undefined) return '—';
  return mark < W_THRESHOLD ? 'W' : String(mark);
}

export function isWMark(mark: number | null | undefined): boolean {
  if (mark === null || mark === undefined) return false;
  return mark < W_THRESHOLD;
}

export function getWSubjects(marks: Marks, electives: Electives): string[] {
  // Returns list of subject names where mark < W_THRESHOLD
  // Used to generate the auto-note on the progress report
}
```

---

## 13. Security Architecture

### 13.1 Defence-in-Depth

| Layer | Controls |
|-------|----------|
| **Transport** | HTTPS enforced by Vercel (automatic TLS). HSTS headers enabled. No HTTP fallback. |
| **Authentication** | `bcrypt` (rounds=12) for password hashing. `httpOnly` cookies prevent XSS theft. CSRF protection via NextAuth double-submit cookie pattern. |
| **Authorisation** | Middleware enforces authentication. Each route handler verifies role. Prisma queries are scoped to the requesting user's accessible data where applicable. |
| **Input Validation** | Zod schemas validate all API request bodies and query parameters before any database operation. Invalid inputs return 400 with structured error messages. |
| **Injection** | Prisma's parameterised queries prevent NoSQL injection. All user-supplied strings are treated as data, never as query operators. |
| **Rate Limiting** | Upstash Redis (or in-memory fallback) limits login attempts (5/15 min), password reset requests (3/hour), and `/api/config` submissions (5/hour). |
| **Secrets** | `DATABASE_URL`, `NEXTAUTH_SECRET`, `VERCEL_API_TOKEN`, `CRON_SECRET` — all stored as Vercel environment variables. Never committed to source control. Never logged. |
| **Audit Logging** | Every mark edit, login, logout, configuration change, and backup event is written to the `AuditLog` collection with timestamp, `userId`, and IP address. |

---

## 14. Deployment & DevOps

### 14.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | MongoDB Atlas connection string (`mongodb+srv://...`). |
| `NEXTAUTH_SECRET` | ✅ Yes | Random 32-byte hex string for JWT signing. |
| `NEXTAUTH_URL` | ✅ Yes | Canonical URL of the deployment (e.g., `https://schoolms.example.com`). |
| `VERCEL_API_TOKEN` | ⚠️ Recommended | Vercel personal access token for writing env vars from `/config`. |
| `VERCEL_PROJECT_ID` | ⚠️ Recommended | Vercel project ID (visible in Project Settings). |
| `CRON_SECRET` | ✅ Yes | Secret header value Vercel sends with cron requests. |
| `AWS_ACCESS_KEY_ID` | Optional | AWS credentials for S3 backup storage. |
| `AWS_SECRET_ACCESS_KEY` | Optional | AWS credentials for S3 backup storage. |
| `AWS_S3_BUCKET` | Optional | S3 bucket name for backups. |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob token (fallback if S3 not configured). |
| `RESEND_API_KEY` | Optional | Resend API key for email alerts. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | Optional | SMTP credentials for Nodemailer fallback. |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis URL for distributed rate limiting. |

### 14.2 Initial Setup Checklist

1. Create a MongoDB Atlas account and cluster (M0 free tier is sufficient for development).
2. Whitelist `0.0.0.0/0` in Atlas Network Access (or Vercel's egress IPs for production).
3. Copy the connection string from Atlas (`mongodb+srv://...`).
4. Fork the SchoolMS repository and import to Vercel.
5. Set `NEXTAUTH_SECRET` and `NEXTAUTH_URL` in Vercel environment variables.
6. Deploy the project. Navigate to `https://your-project.vercel.app/config`.
7. Paste the MongoDB connection string and click **"Connect & Initialise"**.
8. Create the Superadmin account when prompted.
9. Login at `/login` with the Superadmin credentials.
10. Configure school name, academic year, and elective subjects in **Settings**.
11. Create Admin and Staff accounts from **User Management**.
12. Begin adding student records.

### 14.3 CI/CD Pipeline

- **GitHub Actions** runs on every pull request: TypeScript type checking, ESLint, unit tests (Vitest), Prisma schema validation.
- Merging to `main` triggers a Vercel **production deployment**.
- **Preview deployments** are created for every open PR automatically.
- Vercel build command: `prisma generate && next build`.

---

## 15. Testing Strategy

| Level | Tool | Scope |
|-------|------|-------|
| **Unit** | Vitest | Pure utility functions: `applyWRule`, `getWSubjects`, backup serialisation, date formatting. |
| **Integration** | Vitest + Prisma Mock | API route handlers tested against an in-memory Prisma mock. Auth middleware logic. |
| **End-to-End** | Playwright | Critical user journeys: login → enter marks → view report → download PDF. Run against a staging environment. |
| **Component** | React Testing Library | Dashboard UI components: mark entry grid, bar chart data binding, sidebar navigation. |
| **Accessibility** | axe-core (via Playwright) | WCAG 2.1 AA compliance checks on all pages. |

---

## 16. Future Roadmap & Extensibility

| Phase | Feature | Description |
|-------|---------|-------------|
| **v1.1** | Parent Portal | Read-only view for parents to see their child's progress report. Login via a shared access code (no email required). |
| **v1.1** | SMS / WhatsApp Alerts | Notify parents when term marks are published, using Twilio or WhatsApp Business API. |
| **v1.2** | Attendance Module | Track daily attendance per student and correlate with academic performance in analytics. |
| **v1.2** | Timetable Integration | Import subject-teacher assignments so marks can only be entered by the teacher assigned to a subject. |
| **v2.0** | Multi-School Support | Tenant isolation allowing multiple schools on one deployment, each with their own data namespace. |
| **v2.0** | AI Performance Insights | LLM-generated narrative summaries: *"Samith shows consistent improvement in English but needs support in Maths."* |
| **v2.1** | Offline PWA | Service worker caching for mark entry offline; sync on reconnection. |
| **v2.1** | Mobile App (React Native) | A companion app for teachers to enter marks from their phones. |

---

*End of Architecture Document — SchoolMS v1.0*

*This document is confidential and intended solely for the development team and authorised stakeholders.*
