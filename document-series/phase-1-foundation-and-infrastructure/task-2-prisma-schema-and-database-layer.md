# Task 2: Prisma Schema and Database Layer

**Phase:** Phase 1 — Foundation and Infrastructure
**Task Number:** 2 of 5
**Title:** Prisma Schema and Database Layer
**Estimated Complexity:** Medium
**Depends On:** Task 1 (Project Scaffolding and Tooling)

---

## Task Summary

This task establishes the complete data layer for SchoolMS. It covers authoring the Prisma schema with all models, enums, embedded types, and indexes; implementing the singleton Prisma client for safe usage in a serverless environment; creating the database health check module; and implementing the W-Rule utility functions alongside their complete unit test suites. By the end of this task, the database schema is fully defined, validated, and pushed to MongoDB Atlas, and all pure utility logic that subsequent phases depend on is tested and confirmed correct.

This task does not build any API routes or UI. Its output is a stable, well-structured data layer that all subsequent tasks in Phases 1 through 5 import and rely upon.

---

## Prerequisites

- Task 1 is complete. The Next.js 14 App Router project exists at the repository root with TypeScript 5.x strict mode enabled, Prisma ORM 5.x installed, Vitest configured, and all path aliases set up.
- A MongoDB Atlas cluster is provisioned and a connection string is available. The `DATABASE_URL` environment variable is set in `.env` to the full `mongodb+srv://` connection string for that cluster.
- Node.js 20 LTS is active in the shell.
- The `prisma` CLI is available as a dev dependency (installed in Task 1). All commands in this task are run via `npx prisma` or through the `package.json` scripts defined in Task 1.

---

## Task Scope

### In Scope

- Writing `prisma/schema.prisma` with datasource, generator, all enums, all embedded types, and all five models including full field definitions and indexes.
- Running `npx prisma validate` to confirm the schema is syntactically correct.
- Running `npx prisma db push` to synchronise the schema with MongoDB Atlas and trigger Prisma Client generation.
- Implementing `lib/prisma.ts` as the global-cached singleton Prisma Client.
- Implementing `lib/db-health.ts` with the `checkDatabaseHealth()` async function.
- Implementing `lib/w-rule.ts` with the `W_THRESHOLD` constant and three exported utility functions.
- Writing `lib/__tests__/w-rule.test.ts` with all specified unit tests.
- Writing `lib/__tests__/db-health.test.ts` with all specified unit tests using a mocked Prisma client.
- Confirming the TypeScript build remains error-free after all files are added.

### Out of Scope

- Building any API routes, middleware, or UI components.
- Seeding the database with data.
- Implementing authentication logic (covered in Task 3).
- Any file not explicitly listed in the File Inventory section of this document.

---

## Acceptance Criteria

1. `prisma/schema.prisma` contains exactly two enums (`Role`, `Term`), two embedded types (`Electives`, `Marks`), and five models (`User`, `ClassGroup`, `Student`, `MarkRecord`, `SystemConfig`).
2. Running `npx prisma validate` exits with code 0 and reports no errors or warnings.
3. Running `npx prisma db push` successfully pushes the schema to MongoDB Atlas and generates the Prisma Client without errors.
4. `lib/prisma.ts` exports a single `PrismaClient` instance. In development, the instance is cached on the Node.js global object. In production, it is a module-level constant. No credentials are logged or exposed.
5. `lib/db-health.ts` exports `checkDatabaseHealth()`, which returns an object typed with `status`, `latencyMs`, `collectionCounts`, `errorMessage`, and `clusterName` fields. All five return states (healthy, unreachable, unconfigured due to missing URL, unconfigured due to `db_configured` flag) are handled.
6. `lib/w-rule.ts` exports `W_THRESHOLD` (value `35`), `applyWRule`, `isWMark`, and `getWSubjects`.
7. All tests in `lib/__tests__/w-rule.test.ts` pass when running `npx vitest run`.
8. All tests in `lib/__tests__/db-health.test.ts` pass when running `npx vitest run`.
9. The TypeScript compiler reports zero errors when running `npx tsc --noEmit`.
10. The `Marks` embedded type's nullable integer fields correctly represent "mark not entered" as `null`, distinct from a score of zero.

---

## Implementation Guide

### Step 1: Prisma Schema File Setup

The file `prisma/schema.prisma` is the single source of truth for the entire database structure. It is a plain text file using Prisma's PSL (Prisma Schema Language). If the file already exists from `prisma init` (run in Task 1), clear its contents and write the definitions described in this task from scratch.

The file begins with two top-level blocks: the datasource block and the generator block.

The **datasource block** is named `db`. Its `provider` field must be set to the string `"mongodb"`. Its `url` field must be set using the `env()` function reading from `"DATABASE_URL"`. This means the database connection string is never hardcoded in source control — it is always read from the environment at runtime. The datasource block must not contain any other fields.

The **generator block** is named `client`. Its `provider` field is set to `"prisma-client-js"`. No `output` field is needed — the default output location (`node_modules/.prisma/client`) is correct for this project. Do not add an `engineType` field; the default engine is appropriate.

After the datasource and generator blocks, the file continues with enum definitions, then type definitions, then model definitions — in that order. This ordering is a convention for readability; Prisma does not require a specific order, but maintaining this convention makes the schema easier to review.

### Step 2: Defining Enums

Prisma enums for MongoDB are declared with the `enum` keyword. Unlike relational databases, MongoDB does not enforce enum values at the database level — enforcement happens at the Prisma Client level. The schema must declare two enums.

**The `Role` enum** has three members: `SUPERADMIN`, `ADMIN`, and `STAFF`. `SUPERADMIN` represents the single system owner account created during the one-time setup flow. `ADMIN` represents school administrators with broad data access. `STAFF` represents teachers with access limited to mark entry. This enum is used exclusively in the `User` model's `role` field. The default value for a new user is `STAFF`.

**The `Term` enum** has three members: `TERM_1`, `TERM_2`, and `TERM_3`, corresponding to the three academic terms in the Sri Lankan secondary school calendar. This enum is used exclusively in the `MarkRecord` model's `term` field. There is no default value for term — the application must always supply an explicit term when creating a mark record.

### Step 3: Defining Embedded Types

Prisma's `type` keyword declares an embedded document — a structured object stored inline within a parent document, not as a separate MongoDB collection. This project uses two embedded types.

**The `Electives` type** stores the three elective subject assignments for a student. It has three non-nullable `String` fields: `categoryI`, `categoryII`, and `categoryIII`. These hold human-readable subject labels (for example, "Geography", "Music", "ICT"). All three fields are required — every student in the system must have all three elective categories assigned before their records are created. There is no default value for any of these fields; the application must supply them during student creation. The `Electives` type is embedded inside the `Student` model as a single required field, not as a relation.

**The `Marks` type** stores the nine subject marks for a single term's assessment. Every field in this type is a nullable integer (`Int?`). The nine fields, in canonical display order, are: `sinhala`, `buddhism`, `maths`, `science`, `english`, `history`, `categoryI`, `categoryII`, `categoryIII`. The `categoryI`, `categoryII`, and `categoryIII` fields correspond to the student's three elective subjects as defined in the `Electives` type embedded in the same `Student` document.

The nullable integer design is a deliberate semantic choice. A `null` value means the mark was never entered for that subject in that term. A value of `0` means the student sat the assessment and scored zero. These are two distinct states with different display behaviour: a `null` is rendered as "—" in the UI, while `0` is passed through the W-Rule and renders as "W" (since zero is below the 35-point threshold). Any implementation that conflates null with zero will introduce silent data corruption. All code that reads `Marks` fields must check for null before applying any arithmetic or display logic.

### Step 4: User Model

The `User` model represents all system accounts. It maps to the `users` collection in MongoDB.

The `id` field is a `String` with `@id`, `@map("_id")`, and `@default(auto())` combined with `@db.ObjectId`. This is the standard pattern for MongoDB ObjectId primary keys in Prisma — the Prisma field is a `String` but the underlying BSON type is an ObjectId.

The `name` field is a required `String`. The `email` field is a required `String` with `@unique`, which creates a unique index in MongoDB. The `passwordHash` field is a required `String` that stores the bcrypt-hashed password. The raw plaintext password must never be stored; the hash is computed in the authentication layer (Task 3) and written here.

The `role` field is of type `Role` (the enum defined earlier) with a default of `STAFF`. The `createdAt` field is a `DateTime` with `@default(now())`. The `updatedAt` field is a `DateTime` with `@updatedAt`, which instructs Prisma to automatically update this field on every write operation.

Three security-sensitive fields are nullable: `passwordResetToken` (`String?`) stores the bcrypt hash of a password reset token (not the raw token — the raw token is sent to the user's email and immediately discarded from server memory). `passwordResetExpiry` (`DateTime?`) stores when that reset token expires. `sessionInvalidatedAt` (`DateTime?`) stores a timestamp — if set, any JWT issued before this timestamp is treated as invalid, which allows force-logout without maintaining a server-side session store.

**Critical security rule:** Any Prisma query that loads `User` documents for display (user list, profile views, audit logs) must use a `select` clause that explicitly omits `passwordHash`, `passwordResetToken`, and `sessionInvalidatedAt`. These fields must never appear in any API response body. This rule is enforced by convention in this codebase — there is no automatic sanitisation. Every developer and every AI agent touching user queries must apply it manually.

### Step 5: ClassGroup Model

The `ClassGroup` model represents a single class (e.g., Grade 8 – Section B). It maps to the `classGroups` collection.

The `id` field follows the same ObjectId string pattern as `User`. The `grade` field is a required `Int` representing the school grade, with valid values from 6 to 11 inclusive. The `section` field is a required `String` representing the class section, with valid values from "A" to "F". Prisma does not enforce these ranges — the application layer must validate them before writing.

No unique index on the `grade`+`section` combination is defined at the Prisma level for MongoDB, because Prisma's compound unique constraints behave differently across MongoDB versions and may not create the underlying index reliably. Instead, the application logic (in the class creation route, built in Task 4) must query for an existing `ClassGroup` with the same `grade` and `section` before inserting, and return a conflict error if one is found.

The `students` field is a Prisma relation field (not stored in the database) that represents the one-to-many relationship to the `Student` model. It is declared as `Student[]` with the appropriate `@relation` decorator referencing the `classId` field on the `Student` side. This field enables Prisma's relational query syntax for fetching a class with all its enrolled students.

### Step 6: Student Model

The `Student` model represents an individual enrolled student. It maps to the `students` collection.

The `id` field follows the ObjectId string pattern. The `name` field is a required `String` for the student's full name. The `indexNumber` field is a required `String` with `@unique` — this is the school-assigned identifier (e.g., a national student registration number) and must be unique across all students. It carries a unique index and is used as the primary lookup key during mark entry.

The `classId` field is a required `String` with `@db.ObjectId`, storing the ObjectId of the student's current `ClassGroup`. The `class` field is the corresponding Prisma relation field pointing to `ClassGroup`, joined via `classId` referencing `ClassGroup.id`. This is a many-to-one relationship: many students belong to one class group.

The `electives` field is of type `Electives` — the embedded type defined earlier. It is required (non-nullable). When a student is created, all three elective category labels must be supplied.

The `markRecords` field is a Prisma relation field (a virtual one-to-many back-reference) pointing to `MarkRecord[]`, joined via the `studentId` field on the `MarkRecord` side. This enables queries that fetch a student together with all their associated term records.

The `createdAt` field is a `DateTime` with `@default(now())`.

The `isDeleted` field is a `Boolean` with `@default(false)`. This is the soft-delete flag. When set to `true`, the student is excluded from all list views and mark entry lookups, but their `MarkRecord` documents remain in the database. This preserves historical data while hiding the student from the active school roster. All queries against the `Student` collection (except admin recovery operations) must include a `where: { isDeleted: false }` filter.

**Indexes on Student:** The `indexNumber` field carries `@unique`, which implicitly creates a unique index. The `classId` field carries `@@index([classId])` at the model level to create a non-unique index supporting fast retrieval of all students in a given class — this query runs on every page load of the Student List and during class-wide mark entry.

### Step 7: MarkRecord Model

The `MarkRecord` model stores one term's marks for one student in one academic year. It maps to the `markRecords` collection.

The `id` field follows the ObjectId string pattern. The `studentId` field is a required `String` with `@db.ObjectId`, the foreign key to `Student`. The `student` field is the corresponding Prisma relation field. The `term` field is of type `Term` (the enum). The `year` field is a required `Int` representing the academic year as a four-digit integer (e.g., 2024).

The `marks` field is of type `Marks` — the embedded type. It stores the nine nullable integer mark values for this term.

The `createdAt` field is a `DateTime` with `@default(now())`. The `updatedAt` field is a `DateTime` with `@updatedAt`. The `updatedBy` field is a required `String` with `@db.ObjectId` — it stores the `id` of the `User` who last saved this mark record. This is an audit trail field: it identifies which staff member entered or last modified the marks. It is written on every mark save operation. It is not a Prisma relation field — it stores the ObjectId string directly without a Prisma-level join, because the health and read performance of mark queries must not be coupled to the `User` collection.

**Indexes on MarkRecord:** Two compound indexes are defined at the model level using `@@index` and `@@unique`.

The first is a **unique compound index** on `[studentId, term, year]` declared with `@@unique`. This is the primary uniqueness constraint for mark records: a given student can have at most one `MarkRecord` per term per academic year. When the mark entry route creates or upserts a record, this constraint prevents duplicate entries. Any attempt to insert a duplicate will cause Prisma to throw a unique constraint violation error.

The second is a **non-unique compound index** on `[term, year]` declared with `@@index`. This index supports two access patterns: batch mark loading for a class (fetch all mark records for a given term and year, then filter by the class's student IDs in application code) and analytics aggregations that operate across all students for a given term and year. Without this index, those queries would perform full collection scans on what will become the largest collection in the database.

### Step 8: SystemConfig Model

The `SystemConfig` model implements an application-level key-value store for runtime configuration settings. It maps to the `systemConfigs` collection.

The `id` field follows the ObjectId string pattern. The `key` field is a required `String` with `@unique` — creating a unique index for O(1) lookup by config key. The `value` field is a required `String` that stores the setting's value as a JSON-serialisable string (even numeric and boolean values are stored as their string representations). The `updatedAt` field is a `DateTime` with `@updatedAt`.

Three keys are written in Phase 1:

- `"db_configured"` — set to `"true"` after the database initialisation sequence completes (the Superadmin creation step in Task 3 sets this). Middleware reads this key to decide whether to redirect the user to `/config`. Until this key is `"true"`, every request is redirected to `/config`.
- `"school_name"` — set to the school's name string during Superadmin creation. If not set, the application defaults to `"SchoolMS"` wherever the school name is displayed.
- `"academic_year"` — set to the current calendar year as a string (e.g., `"2024"`) during initialisation. This value seeds the year selector on the mark entry forms.

No other keys are written in Phase 1. Subsequent phases may add keys, but they must follow the same pattern: store values as strings, never store credentials or secrets in this collection.

### Step 9: Running Prisma Validate and DB Push

After writing the complete `schema.prisma` file, run two commands in sequence.

**`npx prisma validate`** parses the schema file and checks for structural errors — missing required fields, invalid type references, malformed relation declarations, and directive syntax errors. It does not connect to the database. If it exits with code 0 and produces no error output, the schema is syntactically correct. If it reports errors, fix them before proceeding. Common issues at this stage are mismatched relation field names, forgotten `@db.ObjectId` annotations on ObjectId foreign key fields, and incorrect `type` vs `model` keyword usage for embedded documents.

**`npx prisma db push`** connects to the MongoDB Atlas cluster using `DATABASE_URL`, synchronises the schema (primarily by creating indexes), and generates the Prisma Client in `node_modules/.prisma/client`. For MongoDB, `db push` does not create collections — MongoDB creates collections lazily on first document insert. However, it does create all indexes defined in the schema. Expected output includes lines confirming that the Prisma schema has been pushed and that the Prisma Client has been generated. If the command fails with a connection error, verify that `DATABASE_URL` is correct in `.env`, that the Atlas cluster's IP allowlist includes the development machine, and that the database user has read/write permissions.

After `db push` completes, the generated Prisma Client types are available for import from `@prisma/client`. TypeScript will be able to resolve `PrismaClient`, all model types (`User`, `Student`, etc.), and all enum types (`Role`, `Term`).

### Step 10: lib/prisma.ts Implementation

This file exports the singleton `PrismaClient` instance that all other modules import. Its sole responsibility is ensuring that exactly one client instance exists during the module's lifetime.

**Why a singleton is necessary in serverless:** Vercel's serverless runtime can execute many concurrent function invocations. If every invocation naively constructs `new PrismaClient()`, each establishes its own connection to MongoDB Atlas. The Atlas free tier and lower paid tiers have strict connection limits. Under moderate load, this pattern exhausts the pool and causes connection errors. The singleton ensures that a given runtime instance reuses one client across all invocations handled by the same process.

**The global dev cache:** In development, Next.js uses hot module replacement (HMR). Each time a source file changes, Next.js re-evaluates many modules, including any module that imports `lib/prisma.ts`. Without precautions, every HMR cycle would construct a new `PrismaClient` instance — within minutes of development, you would have dozens of open connections. The solution is to store the client instance on the Node.js `global` object, which is not subject to HMR. On each module evaluation, the code checks whether the global already holds a client; if so, it reuses that instance. This check is guarded by `process.env.NODE_ENV !== "production"` — in production, there is no HMR, so the check is unnecessary overhead.

**Production behaviour:** In production, the module is evaluated once per serverless worker lifecycle. The client is assigned to a module-level constant on first evaluation and remains alive until the worker is recycled. No global caching is needed.

**Credential safety:** The `lib/prisma.ts` file must not log or print the `DATABASE_URL` value. It must not call `console.log` with any database-related information. If the Prisma Client emits query logs, they are controlled via the `log` option passed to the `PrismaClient` constructor — the implementation should omit the `log` option entirely (defaulting to no logging) unless the project-wide logging configuration explicitly requires it.

### Step 11: lib/db-health.ts Implementation

This file exports a single async function, `checkDatabaseHealth()`. It has no parameters. Its return type is a plain object (not a Prisma model type) with the following fields: `status` (a discriminated string union of `"healthy"`, `"unreachable"`, and `"unconfigured"`), `latencyMs` (a `number` or `null`), `collectionCounts` (an object with five keys or `null` when unreachable), `errorMessage` (a `string` or `null`), and `clusterName` (a `string` or `null`).

The function follows this decision tree:

**Unconfigured — missing URL:** If `process.env.DATABASE_URL` is falsy (empty string or not set at all), return immediately with `status: "unconfigured"`, all other fields null, without attempting any database operation.

**Unconfigured — flag check:** If `DATABASE_URL` is present, attempt to read the `db_configured` key from the `SystemConfig` collection. If this read itself fails, fall through to the unreachable case. If the key does not exist or its value is not `"true"`, return `status: "unconfigured"` with all other fields null. This guard prevents misleading "healthy" responses when the database exists but has not been initialised by the setup flow.

**Latency measurement:** Record `Date.now()` before the first Prisma query. Issue a `prisma.user.count()` call. Record `Date.now()` after the call resolves. The difference is `latencyMs`. This measures the roundtrip time of a minimal read operation against the real Atlas cluster.

**Healthy path:** After the latency measurement query succeeds, run count queries for all five collections: `prisma.user.count()`, `prisma.classGroup.count()`, `prisma.student.count()`, `prisma.markRecord.count()`, `prisma.systemConfig.count()`. These can be run concurrently using `Promise.all`. Return `status: "healthy"` with `latencyMs` and `collectionCounts` populated. Both `errorMessage` and `clusterName` are derived: `errorMessage` is `null` on the healthy path, and `clusterName` is extracted from the hostname portion of `DATABASE_URL`.

**Cluster name extraction:** Parse `DATABASE_URL` to extract only the hostname (the `@hostname` portion of the connection string). Do not include the username, password, or any other component. This gives the consumer a human-readable cluster identifier for display in the health dashboard without exposing credentials.

**Unreachable path:** Wrap the entire query block in a try/catch. If any Prisma query throws, catch the error object. Extract the error message string. Apply a regex substitution to remove the credentials embedded in any `mongodb+srv://` URL that may appear in the error message — Prisma's error messages often include the connection string when reporting connection failures. The regex must replace the scheme, username, password, and host from any `mongodb+srv://user:password@hostname` pattern with a redacted placeholder. Set `status: "unreachable"`, `latencyMs: null`, `collectionCounts: null`, `errorMessage` to the sanitised string, and `clusterName` to whatever could be extracted from the environment variable (which did not change just because the query failed).

### Step 12: lib/w-rule.ts Implementation

This file contains pure utility functions. It has no imports from other project files and no side effects. It exports three functions and one constant.

**`W_THRESHOLD`** is exported as a constant with the value `35`. This is the minimum mark required to avoid a W-grade. It must be a named export so that consumers can reference the threshold value in their own conditional logic without hardcoding the number.

**`applyWRule(mark: number | null | undefined): string`** transforms a raw mark value into its display string. The logic has exactly three branches:
- If `mark` is `null` or `undefined`, return the string `"—"` (a Unicode em dash, U+2014, not a hyphen). This represents a mark that was not entered.
- If `mark` is a number and is strictly less than `W_THRESHOLD` (i.e., less than 35), return the string `"W"`. This applies to any mark from 0 to 34 inclusive.
- Otherwise (mark is a number greater than or equal to 35), return `String(mark)`. This converts the number to its decimal string representation.

The null and undefined check must use a loose equality check (`== null`) or explicit checks for both — TypeScript's type system does not protect against runtime `undefined` values that come from Prisma's nullable fields, so both must be handled.

**`isWMark(mark: number | null | undefined): boolean`** is a predicate version of the W-Rule. It returns `false` for `null` or `undefined` (a missing mark is not a W-mark — it has no display state to flag). It returns `true` if `mark` is a number strictly less than `W_THRESHOLD`. It returns `false` for marks of 35 or higher. This function drives conditional styling in the mark entry table (red cells for W-marks) and is used in count calculations on the progress report (e.g., "number of W grades this term").

**`getWSubjects(marks: Marks, electives: Electives): string[]`** takes the `Marks` embedded document and the `Electives` object for the same student and returns an array of human-readable subject name strings for every subject where the student has an entered mark below the threshold. Null marks (not entered) are excluded — only marks that are non-null and below `W_THRESHOLD` are included.

The subject name mapping is fixed and must be applied in canonical display order:

| Marks field | Subject name returned |
|---|---|
| `marks.sinhala` | `"Sinhala"` |
| `marks.buddhism` | `"Buddhism"` |
| `marks.maths` | `"Maths"` |
| `marks.science` | `"Science"` |
| `marks.english` | `"English"` |
| `marks.history` | `"History"` |
| `marks.categoryI` | `electives.categoryI` (the student's own label) |
| `marks.categoryII` | `electives.categoryII` |
| `marks.categoryIII` | `electives.categoryIII` |

The elective category names are taken directly from the `Electives` object, not from a fixed list. This is intentional: different students in different class groups may have different elective assignments, and the returned subject name must reflect the specific student's assignment. The result is used in the W-Note section of progress reports to render a sentence such as "Below passing mark in: Geography, ICT."

### Step 13: Writing Unit Tests

Tests are written using Vitest. Both test files live in `lib/__tests__/`. The test runner is invoked with `npx vitest run` (single-pass, no watch mode) or `npx vitest` (watch mode during development).

**`lib/__tests__/w-rule.test.ts`**

This file tests all three exported functions. No mocking is needed — all functions are pure.

For `applyWRule`: test that `null` → `"—"`, `undefined` → `"—"`, `0` → `"W"`, `34` → `"W"`, `35` → `"35"`, `50` → `"50"`, `100` → `"100"`. The boundary cases at 34 and 35 are the most critical: 34 must return `"W"` and 35 must return `"35"`, confirming the threshold is exclusive on the lower side and inclusive on the upper side.

For `isWMark`: test that `null` → `false`, `undefined` → `false`, `0` → `true`, `34` → `true`, `35` → `false`, `100` → `false`. Again, the 34/35 boundary is the critical case.

For `getWSubjects`: test at least four cases. First, all-null marks must return an empty array — no subjects are reported when nothing has been entered. Second, a marks object where `maths` is 34 and `sinhala` is 35 must return `["Maths"]` — confirming that 34 is below threshold and 35 is not, and confirming that only the failing subject is returned. Third, a marks object where `categoryI` is 20 with an `Electives` object where `categoryI` is `"Geography"` must return `["Geography"]` — confirming that the elective label from the `Electives` object is used, not a hardcoded name. Fourth, a marks object with multiple failing subjects (for example, `sinhala: 10`, `buddhism: 20`, `maths: 30`, `english: 35`) must return all three failing subjects in canonical order: `["Sinhala", "Buddhism", "Maths"]`.

**`lib/__tests__/db-health.test.ts`**

This file tests `checkDatabaseHealth`. The Prisma client must be mocked using `vi.mock` at the top of the file, replacing the entire `lib/prisma` module with a mock object whose methods return controlled values.

For the **unconfigured state** test: set `process.env.DATABASE_URL` to an empty string before calling the function. Assert that the returned object has `status: "unconfigured"`, `latencyMs: null`, `collectionCounts: null`, `errorMessage: null`. Restore the environment variable after the test.

For the **healthy state** test: set `DATABASE_URL` to a valid-looking (but fake) `mongodb+srv://` URL. Configure the mock `prisma.systemConfig.findFirst` to resolve with an object whose `value` is `"true"`. Configure mock `prisma.user.count` and all other count methods to resolve with arbitrary numeric values (e.g., `5`, `3`, `10`, `25`, `2`). Call `checkDatabaseHealth()` and assert: `status` is `"healthy"`, `latencyMs` is a non-negative number, `collectionCounts` is an object with all five keys populated with the mock values, `errorMessage` is `null`.

For the **unreachable state** test: configure the mock `prisma.user.count` to throw an error whose message contains a fake `mongodb+srv://secretuser:secretpassword@cluster0.example.mongodb.net` URL. Call `checkDatabaseHealth()` and assert: `status` is `"unreachable"`, `latencyMs` is `null`, `errorMessage` is a non-null string, and — critically — `errorMessage` does NOT contain the substring `"secretpassword"`. This last assertion directly validates the credential-stripping behaviour.

---

## Security Considerations

**Passwords and hashes:** The `passwordHash` field on `User` stores only a bcrypt hash. The plaintext password must never be persisted anywhere — not in logs, not in API responses, not in the database. All Prisma queries that fetch users must explicitly omit `passwordHash` using a `select` clause. This convention is established here in Task 2 and must be enforced in every subsequent task.

**Reset token security:** The `passwordResetToken` field stores a bcrypt hash of the reset token, not the token itself. The raw token is generated in the authentication layer, sent to the user's email, and then immediately hashed before storage. This ensures that a database breach does not expose usable reset tokens.

**Credential stripping in health checks:** The `checkDatabaseHealth()` function must never return the database connection string, username, or password in any field of its response object. The `errorMessage` field must be sanitised with a regex before being included in the return value. The regex pattern must match the full `mongodb+srv://username:password@host` segment of any URL and replace it with a non-sensitive placeholder. The `clusterName` field may include the hostname but must never include the username or password components.

**No credential logging:** Neither `lib/prisma.ts` nor `lib/db-health.ts` may call `console.log`, `console.error`, or any logging utility with any value derived from `DATABASE_URL`. Credential leakage through logs is a common operational security failure.

---

## TypeScript Type Considerations

After running `npx prisma db push` (or `npx prisma generate`), the Prisma Client generator produces TypeScript types for all models, enums, and input types. These types are importable from the `@prisma/client` package.

The core model types (`User`, `Student`, `ClassGroup`, `MarkRecord`, `SystemConfig`) represent the shape of a full database document as returned by a Prisma query with no explicit `select`. Consumers should import these types for function parameters and return type annotations throughout the codebase.

The embedded types `Electives` and `Marks` are also generated as TypeScript types and must be imported from `@prisma/client` wherever they appear in function signatures — including the `getWSubjects` function in `lib/w-rule.ts`. Do not redeclare these types manually in the project; always use the generated types to keep the schema and the TypeScript types in sync.

The enum types `Role` and `Term` are generated as TypeScript enums (or string literal union types, depending on the Prisma version). Import them from `@prisma/client` and use them in all places where role or term values are compared or constructed.

The input types (such as `Prisma.UserCreateInput`, `Prisma.MarkRecordWhereUniqueInput`) are available under the `Prisma` namespace import. These are useful for typing the parameters of data access functions and should be used in preference to inline object type literals.

When writing the `lib/db-health.ts` return type, define a local TypeScript interface or type alias in that file for the return object shape. This type should not be a Prisma-generated type — it is the shape of a health API response, not a database document.

---

## File Inventory

The following files are created or modified by this task:

| File path | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Create / overwrite | Full Prisma schema definition |
| `lib/prisma.ts` | Create | Singleton Prisma Client export |
| `lib/db-health.ts` | Create | `checkDatabaseHealth()` function |
| `lib/w-rule.ts` | Create | W-Rule utility functions and constant |
| `lib/__tests__/w-rule.test.ts` | Create | Unit tests for W-Rule utilities |
| `lib/__tests__/db-health.test.ts` | Create | Unit tests for health check function |

No other files are created or modified. In particular, no API routes, UI components, middleware files, or environment configuration files are touched in this task.

---

## Integration Points

The following tasks in later phases directly depend on work delivered by Task 2:

| Consuming task | What it uses from Task 2 |
|---|---|
| Task 3 — Auth and Superadmin Setup | `lib/prisma.ts` for all user queries; `User` model to create the Superadmin account; `SystemConfig` model to write `db_configured`, `school_name`, and `academic_year` |
| Task 4 — Student and Class Management APIs | `lib/prisma.ts`; `Student`, `ClassGroup` models; `isDeleted` soft-delete pattern |
| Task 5 — Health and Config API Routes | `lib/db-health.ts` (`checkDatabaseHealth()` is called directly by the health endpoint) |
| Phase 3 — Marks Entry | `MarkRecord` model with compound unique index; `lib/w-rule.ts` (`applyWRule`, `isWMark`, `getWSubjects`) |
| Phase 4 — Analytics and Reports | `MarkRecord` secondary index on `[term, year]`; `lib/w-rule.ts` (`getWSubjects` for W-Note generation) |

---

## Common Pitfalls

**Nullable vs optional in Prisma with MongoDB:** In Prisma's PSL, `String?` means the field is nullable (it can be stored as BSON null). This is different from a field being absent from the document entirely. Prisma's MongoDB adapter generally treats these the same in reads, but when writing, explicitly passing `null` and omitting the field produce different BSON. Always pass `null` explicitly when setting a nullable field to a null state (e.g., clearing `passwordResetToken` after a successful reset) rather than omitting it from the update payload.

**Embedded type vs model:** The `Electives` and `Marks` constructs use the `type` keyword, not the `model` keyword. Using `model` for these would tell Prisma they are separate collections, which is incorrect — they are inline subdocuments within `Student` and `MarkRecord` respectively. Mixing up `type` and `model` for embedded documents is one of the most common schema authoring errors in Prisma + MongoDB projects.

**`@db.ObjectId` on foreign key fields:** Every field that stores a MongoDB ObjectId — including the `id` primary key fields and all foreign key fields like `classId`, `studentId`, and `updatedBy` — must carry the `@db.ObjectId` attribute. Without it, Prisma treats the field as a plain string and BSON type mismatches will cause queries to silently return no results. The `@db.ObjectId` annotation tells Prisma to serialise/deserialise the field as a BSON ObjectId.

**Singleton pattern in serverless:** The global dev cache pattern is specifically for development. In production, do not attempt to extend it — the standard module-level constant is the correct approach. Adding the global cache logic in production introduces unnecessary complexity and can cause subtle issues if the global object is reset by the runtime between invocations (which some serverless platforms do).

**`@@unique` vs `@@index` for compound constraints:** The unique compound index on `MarkRecord [studentId, term, year]` must be declared with `@@unique`, not `@@index`. Using `@@index` would create a regular index without the uniqueness constraint, which means Prisma's upsert logic using that combination as the `where` clause would not work correctly, and duplicate records could be inserted.

**The `isDeleted` filter:** Because MongoDB does not support Prisma's global query middleware for soft deletes in the same way relational databases do, the `isDeleted: false` filter must be added manually to every `findMany` and `findFirst` query on the `Student` model. There is no global soft-delete interceptor in this codebase. Omitting the filter on any query will silently return deleted students.
