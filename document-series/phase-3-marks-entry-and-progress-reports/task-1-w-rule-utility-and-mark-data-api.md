# Phase 3 — Task 1: W-Rule Utility and Mark Data API

## Overview

This task establishes two foundational pillars of Phase 3: the W-Rule business logic utility and the three API routes responsible for reading and writing mark data. These components form the data backbone that every subsequent Phase 3 feature — the marks entry table, the progress report, and the PDF export — depends upon. Getting both the utility functions and API contracts right at this stage prevents rework in later tasks.

Before writing a single line of implementation, developers must understand that the W-Rule is a display and classification concern, not a storage concern. Raw numeric marks (or nulls) are always stored in MongoDB. The W-Rule is applied at render time, either in the UI layer or during PDF generation. The API routes in this task return raw values exclusively. This separation of concerns is intentional and must be preserved throughout the codebase.

---

## Dependencies and Prerequisites

The following tasks must be completed in full before beginning this task. Attempting to implement any part of this task without these prerequisites will result in missing types, missing Prisma models, and missing infrastructure.

### Phase 1 — Task 2: Prisma Schema and Database Layer

The Prisma schema must define the `MarkRecord` model with all nine subject fields. Each subject field must be typed as an optional integer (nullable in Prisma terms), meaning the field accepts a numeric value or null. The nine subject fields are: `english`, `mathematics`, `science`, `history`, `geography`, `it`, `elective1`, `elective2`, and `elective3`. The model must also carry `studentId`, `classId`, `year`, and `term` as required fields, and a composite unique index across the four-field combination of `studentId`, `classId`, `year`, and `term`. This composite unique key is what makes Prisma upserts deterministic and conflict-free. Without this index, the POST and PATCH endpoints cannot function correctly.

### Phase 1 — Task 1: Project Scaffolding and Tooling

TypeScript 5 strict mode must be enabled and the project structure must be in place. The `lib/` directory must exist, and the path aliases configured in `tsconfig.json` must resolve the `@/lib/` prefix correctly. Vitest must be installed and configured so that unit tests for the W-Rule utility can be run in isolation.

### Phase 2 — Task 4: User Management, Settings, and Supporting APIs

The `SystemConfig` Prisma model must be fully implemented and the `electiveLabels` field must be accessible. The `electiveLabels` field is a string array of exactly three elements storing the display names for elective subjects as configured by the administrator. Additionally, `lib/audit-actions.ts` must already exist with at least one action constant defined, so that adding the `MARK_UPDATED` constant in this task is a modification rather than a creation from scratch.

### W_THRESHOLD Decision: Hardcoded vs. System Configuration

A conscious architectural decision must be made before implementation: should the W-Rule threshold of 35 live in the `SystemConfig` database document or be hardcoded as a constant in `lib/w-rule.ts`?

The recommendation is to hardcode it as the integer 35 inside `lib/w-rule.ts`. The reasoning is that the W-Rule threshold is a pedagogical business rule defined by the school's assessment policy, not a parameter that an administrator should change through a settings UI. Exposing it as a configurable value would introduce risk: if an admin accidentally changes it to 0 or 100, the entire grading logic breaks silently. A hardcoded constant makes the rule explicit, auditable in version control, and protected from accidental mutation. Document this decision in code with a brief comment explaining why it is not derived from SystemConfig. This decision should be reviewed with the school administration before going live, but hardcoding is the correct starting assumption.

---

## W-Rule Utility — `lib/w-rule.ts`

This file is a pure TypeScript module with zero external dependencies and zero side effects. It exports three symbols: the `W_THRESHOLD` constant, and the functions `applyWRule`, `isWMark`, and `getWSubjects`. Because this module has no imports beyond TypeScript types, it is trivially testable with Vitest.

### The `W_THRESHOLD` Constant

`W_THRESHOLD` is exported as an integer literal with the value 35. It serves as the single source of truth for the warning threshold across the entire application. Every part of the codebase that needs to know the threshold — whether it is the UI rendering logic, the PDF generator, or a test assertion — must import this constant from `lib/w-rule.ts` rather than hardcoding the number 35 elsewhere. This discipline ensures that if the threshold ever needs to change, there is exactly one place to update.

### The `applyWRule` Function

`applyWRule` accepts a single argument typed as `number | null | undefined` and returns a `string`. This function is the display contract for every mark cell in the system. It defines three output cases depending on the input value.

The first case handles the absence of a value. If the argument is `null` or `undefined`, the function returns the string consisting of a single em dash character. In the UI, this renders as a dash indicating that no mark has been entered yet. This is distinct from a score of zero, which is a legitimate recorded mark. The em dash is a semantic signal to the user that the teacher has not yet submitted a mark for this student in this subject.

The second case handles the warning condition. If the argument is a number and that number is strictly less than `W_THRESHOLD` (that is, strictly less than 35), the function returns the string `"W"`. A mark of 34 returns `"W"`. A mark of 0 returns `"W"`. A mark of 1 returns `"W"`. The cutoff is strict: 34 is a warning, 35 is not.

The third case handles the passing condition. If the argument is a number and is greater than or equal to 35, the function returns the number converted to a string using standard JavaScript number-to-string conversion. A mark of 35 returns `"35"`. A mark of 100 returns `"100"`. There is no rounding or formatting applied beyond basic string conversion, since all stored marks are integers.

`applyWRule` is called in two distinct rendering contexts: the marks entry table in the browser, and the PDF progress report generator. Both contexts consume the same string output from this function. The invariant is that `applyWRule` is always applied to the raw stored value before it reaches the user's eyes. It is never applied before storage or inside the API layer.

### The `isWMark` Function

`isWMark` accepts the same union type as `applyWRule` — a value typed as `number | null | undefined` — and returns a boolean. It returns `true` only when two conditions are simultaneously satisfied: the value is a number (not null or undefined), and that number is strictly less than `W_THRESHOLD`. For all other inputs — null, undefined, or any number greater than or equal to 35 — it returns `false`.

This function is used in two contexts. The first is inside `getWSubjects`, where it acts as the filter predicate to identify which subject keys have warning marks. The second is in the UI layer for conditional styling: when `isWMark` returns `true` for a cell, the cell background and text may be styled with a warning color (such as a light red or amber) to visually alert the teacher or admin scanning the table. `isWMark` is a structural simplification — it could be inlined as a ternary everywhere it is used, but having a named function makes the intent clear and keeps the logic DRY.

### The `getWSubjects` Function

`getWSubjects` is the most complex function in this file. It accepts two arguments. The first is a marks object typed as a `Record` mapping each of the nine subject keys to either a number or null. The second is `electiveLabels`, typed as a string array with exactly three elements, sourced from `SystemConfig.electiveLabels` in the caller.

The function iterates over all nine subject keys in a defined order: `english`, `mathematics`, `science`, `history`, `geography`, `it`, `elective1`, `elective2`, and `elective3`. For each key, it calls `isWMark` with the corresponding value from the marks object. If `isWMark` returns `true`, the subject's human-readable display name is added to the output array.

For the six core subjects, the mapping from key to display name is fixed and hardcoded within the function:

- `english` maps to the display name "English"
- `mathematics` maps to the display name "Mathematics"
- `science` maps to the display name "Science"
- `history` maps to the display name "History"
- `geography` maps to the display name "Geography"
- `it` maps to the display name "Information Technology"

For the three elective subjects, the display name is derived from the `electiveLabels` array by index: `elective1` uses `electiveLabels[0]`, `elective2` uses `electiveLabels[1]`, and `elective3` uses `electiveLabels[2]`. However, the function must defend against cases where `electiveLabels` is empty, undefined, or has fewer than three elements. If `electiveLabels[0]` is absent or falsy, the fallback display name for `elective1` is `"Elective 1"`. Similarly, `elective2` falls back to `"Elective 2"` and `elective3` falls back to `"Elective 3"`.

The function returns an array of strings, each being a human-readable subject display name. If no subjects have warning marks, the array is empty. The caller — typically the progress report component or the student profile summary — renders this list as a warning section informing the student or parent of subjects at risk.

### Why Pure Functions Matter Here

All three functions in this module are pure: given the same inputs, they always return the same output, and they produce no observable side effects such as database calls, network requests, API calls, or mutations of external state. This purity is not accidental — it is a deliberate design choice that enables two important properties.

First, pure functions are trivially unit-testable. The Vitest tests for this module can import the functions directly and call them with any input without needing to set up a database, mock an HTTP server, or configure a test environment. The tests are fast, deterministic, and isolated.

Second, pure functions can be safely called on both the server and the client. `applyWRule` and `isWMark` are called in React Server Components during PDF generation and in Client Components during table rendering. Because they have no side effects, there is no risk of accidentally importing server-only logic into a client bundle or vice versa.

---

## Zod Schemas — `lib/validators/marks.ts`

All incoming data to the three API routes is validated using Zod schemas defined in a dedicated file. This file is new and must be created as part of this task.

### The `markValueSchema`

`markValueSchema` validates a single mark value. Valid inputs are either `null` or an integer in the inclusive range 0 to 100. The schema uses a Zod `.nullable()` combined with a `.refine()` call to enforce the integer constraint. A mark of 0 is valid (a student can score zero). A mark of 100 is valid (perfect score). A mark of 101 is invalid. A floating-point number like 45.5 is invalid because Zod's `.int()` constraint rejects non-integers. The `null` value is explicitly allowed because a teacher may clear a previously entered mark, and the system must support that workflow without a validation rejection.

### The `singleMarkBodySchema`

`singleMarkBodySchema` validates the request body for the POST `/api/marks` endpoint. It is a Zod object schema with the following required fields: `studentId` as a non-empty string, `classId` as a non-empty string, `year` as an integer (representing the academic year, for example 2025), `term` as a Zod enum accepting the three string values `"I"`, `"II"`, and `"III"`, and `marks` as a Zod object where each of the nine subject keys is validated against `markValueSchema`. All nine subject keys in the `marks` nested object must be present, but each can be `null` or a valid integer. Omitting a subject key entirely is a validation failure — the caller must explicitly send `null` for unrecorded subjects rather than simply omitting the field. This strictness prevents silent partial overwrites.

### The `batchUpsertBodySchema`

`batchUpsertBodySchema` validates the request body for the PATCH `/api/marks/batch` endpoint. This is the most complex schema. It is a Zod object with the following fields: `classId` as a non-empty string, `term` as the same enum used above, `year` as an integer, `subject` as a Zod enum of the nine valid subject key strings (i.e., `"english"`, `"mathematics"`, `"science"`, `"history"`, `"geography"`, `"it"`, `"elective1"`, `"elective2"`, `"elective3"`), and `entries` as a Zod array. Each element of the `entries` array is a Zod object containing `studentId` as a non-empty string and `markValue` validated against `markValueSchema`. The `entries` array must contain at least one element — an empty batch is a client error. The `entries` array should also have a maximum size enforced by Zod (for example, a maximum of 100 entries) to protect against abuse.

### The `queryParamsSchema`

`queryParamsSchema` validates the URL query parameters for the GET `/api/marks` endpoint. Query parameters arrive as strings from the URL, so this schema must coerce types where necessary. `studentId` is an optional string. `classId` is an optional string. `term` is an optional string that must match one of `"I"`, `"II"`, `"III"`. `year` is an optional string that Zod coerces to an integer before validation. `subject` is an optional string that must match one of the nine valid subject key strings. The schema uses Zod's `.optional()` on all fields because none are individually required at the schema level — the cross-field requirement that at least one of `studentId` or `classId` is present is enforced in the route handler code after Zod parsing, not in the schema itself.

---

## GET `/api/marks`

### Purpose and Authentication

This endpoint retrieves stored `MarkRecord` documents from the database. It is read-only and can be consumed by any authenticated role: Admin, Teacher, and Student alike. Authentication is enforced using NextAuth's `getServerSession` in the route handler. If the session is absent, the handler returns HTTP 401 with an error payload. There is no role-based restriction on reading marks, because a student reading their own marks is a legitimate use case. However, in a future hardening pass, the Student role may be restricted to only querying their own `studentId`.

### Query Parameters

The endpoint accepts up to five query parameters: `studentId`, `classId`, `term`, `year`, and `subject`. These are extracted from the `NextRequest` URL and parsed using `queryParamsSchema` from `lib/validators/marks.ts`.

`studentId` filters results to a single student's records. When provided, the Prisma `where` clause includes `studentId` as an equality filter.

`classId` filters results to all students enrolled in a specific class. When provided without `studentId`, the returned array will contain records from multiple students.

`term` narrows results to a specific term. When omitted, records across all three terms may be returned, depending on what exists in the database.

`year` narrows results to a specific academic year. When omitted, the handler sources the current academic year from `SystemConfig.currentYear`. The developer must query SystemConfig within the handler to obtain this default value.

`subject` is a filter that is only meaningful for analytical endpoints and is not used to filter the returned document fields — it filters which MarkRecord documents are returned. This parameter is optional and, in most usage scenarios for Phase 3, will be omitted.

### Required Parameter Validation

After parsing query parameters with Zod, the handler checks whether at least one of `studentId` or `classId` is present. If neither is provided, the handler returns HTTP 400 with a JSON error body explaining that one of the two parameters is required. This prevents the endpoint from being called without any scope, which would return every MarkRecord in the database — an unintended and potentially expensive query.

### Prisma Query

The handler constructs a Prisma `findMany` call on the `markRecord` collection with a `where` clause assembled from whichever query parameters were provided. If both `studentId` and `classId` are supplied, both are included in the `where` clause for maximum specificity. The `term` and `year` filters are added only when those parameters are present in the parsed query. There is no `select` clause — the full document is returned, which includes all nine subject fields (each as a number or null), `studentId`, `classId`, `year`, `term`, `createdAt`, and `updatedAt`.

### Response Shape and Status

On success, the handler returns HTTP 200 with a JSON array of `MarkRecord` objects. The array may be empty if no records match the filters, and that is a valid successful response — it means no marks have been entered yet for that scope. The raw numeric values are returned as-is. The W-Rule is not applied. The response body is the direct output of the Prisma query, serialized to JSON.

### Performance Considerations

The largest realistic query for this endpoint occurs when a teacher loads the marks entry table for an entire class across all three terms. Assuming a class size of 30 students with records for three terms, the query could return up to 90 `MarkRecord` documents. Each document contains nine subject fields plus metadata. This is a compact payload that MongoDB and Prisma can resolve efficiently with the composite index in place. For class sizes up to 50 students, this endpoint performs well without pagination. If SchoolMS is ever extended to support significantly larger class sizes, pagination with a `skip` and `take` strategy would become necessary, but that is explicitly out of scope for Phase 3.

---

## POST `/api/marks`

### Purpose and Authentication

This endpoint creates or updates a single student's `MarkRecord` for a specific term and year. It uses an upsert strategy, meaning if a record already exists for the composite key of `(studentId, classId, year, term)`, it is updated; otherwise, a new record is created. The endpoint requires an authenticated session, and the role must be either Admin or Teacher. If the session belongs to a Student, the handler returns HTTP 403 Forbidden with a JSON error payload. This restriction is enforced by checking `session.user.role` against an allowed roles array after verifying the session exists.

### Request Body

The request body is a JSON object validated against `singleMarkBodySchema`. The required fields are `studentId`, `classId`, `year`, `term`, and `marks`. The `marks` field is a nested object containing all nine subject keys, each mapped to either a valid integer (0–100) or `null`. Sending a body with any subject key absent from the `marks` object will fail Zod validation and result in a HTTP 422 response with a structured error detailing which fields failed validation.

If Zod parsing fails for any reason — malformed JSON, missing required fields, type mismatches, or out-of-range mark values — the handler returns HTTP 422 Unprocessable Entity with the Zod error formatted as a flat list of field paths and their respective error messages. This detailed error format is deliberately chosen over a generic 400 so that the client can surface exactly which mark field caused the rejection.

### Prisma Upsert Logic

The handler calls `prisma.markRecord.upsert` with a `where` clause targeting the composite unique key of `(studentId, classId, year, term)`. The `create` block sets all nine subject fields from the validated `marks` object, along with `studentId`, `classId`, `year`, and `term`. The `update` block sets the nine subject fields from the validated `marks` object. Both `createdAt` and `updatedAt` are managed automatically by Prisma's timestamp defaults where configured; otherwise the handler sets them explicitly using `new Date()`.

On a successful create operation, the handler returns HTTP 201 Created with the newly created `MarkRecord` document. On a successful update operation, the handler returns HTTP 200 OK with the updated `MarkRecord` document. Distinguishing between create and update is done by examining the Prisma upsert return value alongside a pre-check: before the upsert, perform a `prisma.markRecord.findUnique` using the same composite key. If it returns null, the following upsert is a create; if it returns a document, the following upsert is an update. Store the result of this pre-check as the `oldRecord` variable for use in audit logging.

### Audit Logging

After a successful upsert, the handler writes a `MARK_UPDATED` audit log entry. The audit entry is created using the audit log writing utility established in Phase 2 Task 4. The `action` field is the `MARK_UPDATED` string constant imported from `lib/audit-actions.ts`. The `performedBy` field is the `id` of the user from the NextAuth session. The `targetType` field is the string `"Student"`. The `targetId` field is the `studentId` from the request body. The `metadata` object contains `subject` set to the string `"marks"` (since this endpoint affects all nine fields simultaneously), `term`, `year`, `classId`, `oldValue` set to the prior nine-field marks object from the pre-check query (or `null` if this was a create), and `newValue` set to the full nine-field marks object from the response.

---

## PATCH `/api/marks/batch`

### Purpose and Context

This is the most operationally critical and architecturally complex endpoint in Phase 3. It exists to support the primary workflow of the marks entry table: a teacher opens a class's marks table, selects a subject column, enters numeric values for each student in that column, and presses Save. That single Save action triggers one PATCH to this endpoint — covering all students in the class for one subject in one term. The batch design is critical to performance; if the UI instead sent one POST per student, a class of 30 students would require 30 sequential or parallel HTTP requests.

### Authentication and Authorization

Session authentication is required. The role check is identical to POST `/api/marks`: Admin and Teacher are permitted; Student is rejected with HTTP 403.

### Request Body Structure

The request body is validated against `batchUpsertBodySchema`. The top-level fields are `classId` (identifying the class being updated), `term` (the term being updated), `year` (the academic year), `subject` (the exact one subject key being updated in this batch), and `entries` (the array of per-student values).

Each entry in the `entries` array contains `studentId` and `markValue`. The `markValue` is validated by `markValueSchema`, meaning it must be either null or an integer 0–100. The batch can contain between 1 and 100 entries. If the `entries` array is empty, Zod rejects the body with a 422 response.

### The Critical Design Constraint: Field-Level Targeted Updates

The central challenge of this endpoint is that it must update only the one subject field specified by the `subject` parameter, without disturbing the other eight subject fields in each student's `MarkRecord`. This constraint exists because a school may have multiple teachers, each responsible for a different subject column. Teacher A enters English marks; Teacher B enters Mathematics marks. If the endpoint blindly overwrote the entire `marks` object with only the one field from the batch, Teacher A's save would erase Teacher B's previously entered data.

The solution is a field-level targeted update. When building the Prisma `update` payload for each student, the handler constructs the update path dynamically using dot notation. For MongoDB, Prisma supports updates using keys in the form `"marks.english"` or `"marks.mathematics"` in the `update` clause. The subject key received in the validated body is used directly to construct this path at runtime. For example, if `subject` is `"mathematics"`, the update payload is an object with a single key `"marks.mathematics"` mapped to the `markValue` from that student's entry. No other fields in the `marks` embedded object are touched by this operation.

This technique — sometimes called a partial embedded document update — is a first-class feature of MongoDB and Prisma's MongoDB adapter. The developer implementing this task must verify that the version of Prisma in use (Prisma 5) supports dot-notation keys in the `update` clause for embedded documents, which it does from Prisma version 4.10 onward.

### Pre-Fetch for Audit Comparison

Before writing any upserts, the handler performs a bulk read to fetch existing MarkRecord documents for all `studentId` values in the batch, filtered by `classId`, `term`, and `year`. This lookup uses `prisma.markRecord.findMany` with an `in` filter on `studentId`. The results are indexed into a Map keyed by `studentId` for O(1) lookup during the per-student loop.

This pre-fetch is essential for meaningful audit logging. For each student entry in the batch, the handler extracts the prior value of the specific subject field from the pre-fetched record (if it exists), then compares it to the incoming `markValue`. An audit entry is only written when `oldValue !== newValue`. This comparison prevents flooding the audit log when a teacher saves a column that has not changed since the last save — a common occurrence if the teacher opens the table, makes no edits, and presses Save anyway.

### Transaction Strategy

The batch involves up to 30 Prisma upsert operations. These operations are wrapped in a Prisma `$transaction()` call. The transaction provides atomicity: either all upserts succeed or none are committed to the database. This consistency guarantee is important because a partially committed batch could result in a class where some students have updated marks and others do not, which would corrupt the coherence of the marks table as seen by the teacher.

The trade-off is latency. A transaction spanning 30 upserts takes longer than 30 independent writes in certain database configurations, because MongoDB must hold a write intent lock during the transaction. For MongoDB Atlas with a replica set (which Atlas always provides), write transactions are supported at the collection level. The expected latency increase for 30 upserts in a single transaction versus non-transactional writes is modest — typically an additional 10 to 30 milliseconds on a well-provisioned Atlas cluster. This cost is acceptable given the consistency benefit.

The recommendation is to use `prisma.$transaction()` with an array of upsert promises built by mapping over the validated `entries` array. Each element in the transaction array is a `prisma.markRecord.upsert` call, constructed with the composite unique key in the `where` clause and the targeted field-level update in the `update` clause.

### Partial Failure Handling

Even with a transaction, individual entries in the batch can fail for reasons outside database connectivity, such as a `studentId` value in the `entries` array that does not correspond to any student document in the Student collection, or a `studentId` that belongs to a different class than the provided `classId`. These are validation failures that the Zod schema cannot catch because they require cross-collection business logic checks.

To handle these cases, the handler iterates over the `entries` array and validates each one before constructing the transaction. For each `studentId`, the handler checks whether that studentId belongs to the given `classId` using a pre-fetched class membership list. Entries that fail this check are excluded from the transaction and recorded in a local `failed` array with the reason `"studentId not found in class"`.

The successful entries are submitted as a transaction. The response shape is an object with two keys: `succeeded`, which is an array of `studentId` strings for which the upsert completed successfully, and `failed`, which is an array of objects each containing `studentId` and `reason`.

If all entries succeeded and the `failed` array is empty, the handler returns HTTP 200 with the response object. If at least one entry succeeded and at least one failed, the handler returns HTTP 207 Multi-Status with the response object. If all entries failed and the `succeeded` array is empty, the handler returns HTTP 400 with the response object. This graduated response protocol allows the client to surface partial failure clearly: the teacher is shown which students' marks were saved and which were not, so they can take corrective action without losing the successful saves.

---

## Audit Log Schema for `MARK_UPDATED`

### Where the Constant Lives

The `MARK_UPDATED` string constant must be added to `lib/audit-actions.ts`. This file already exists from Phase 2 Task 4 and exports constants for other audit actions. Adding `MARK_UPDATED` follows the same pattern as existing constants in that file.

### Audit Entry Structure

Each audit log entry written by the mark endpoint handlers shares a common structure. The `action` field holds the `MARK_UPDATED` constant. The `performedBy` field holds the user ID extracted from the NextAuth session, identifying which administrator or teacher performed the write.

The `targetType` field is the string `"Student"` to indicate that the audit event describes a change affecting a student's data. The `targetId` field is the `studentId` of the affected student.

The `metadata` object provides the contextual detail necessary to reconstruct what changed. It contains `subject` as a string (the specific subject key updated, for example `"mathematics"`), `term` as the term string (one of `"I"`, `"II"`, or `"III"`), `year` as the integer academic year, `classId` as the class identifier, `oldValue` as the prior mark value for that subject (either a number or null — serialized directly into the metadata JSON), and `newValue` as the newly written mark value (also number or null).

### One Entry Per Student Per Batch

In the context of PATCH `/api/marks/batch`, the handler writes one audit log entry per student in the batch where a change occurred, not one entry for the entire batch. This is a deliberate choice. Audit logs are most useful when they can be filtered by `targetId` to show the full history of changes to a specific student's marks. A single batch-level audit entry would require the reviewing administrator to parse a potentially large metadata blob to determine which student was affected. Per-student entries make the audit log filterable, scannable, and meaningful.

---

## File Inventory

The following files are created or modified as part of this task. No other files should be touched.

**New files:**

- `lib/w-rule.ts` — The W-Rule utility module exporting `W_THRESHOLD`, `applyWRule`, `isWMark`, and `getWSubjects`.
- `app/api/marks/route.ts` — The GET and POST handler file for the `/api/marks` route. Next.js App Router convention uses a single `route.ts` file per URL segment, with exported named functions `GET` and `POST`.
- `app/api/marks/batch/route.ts` — The PATCH handler file for the `/api/marks/batch` route. This file exports a single named function `PATCH`.
- `lib/validators/marks.ts` — The Zod schema definitions file containing `markValueSchema`, `singleMarkBodySchema`, `batchUpsertBodySchema`, and `queryParamsSchema`.

**Modified files:**

- `lib/audit-actions.ts` — Add the exported constant for `MARK_UPDATED`. This is a single-line addition following the existing constant declaration pattern in the file.

---

## Testing Guidance

### Unit Tests for `lib/w-rule.ts`

Unit tests for this module must be placed in a `__tests__` directory adjacent to `lib/` or in a `lib/w-rule.test.ts` file, following whichever convention the project established in Phase 1. Tests must be run with Vitest and must not require any database connection or HTTP server.

**`applyWRule` test cases:**

The test for a null input should assert that calling `applyWRule` with the value `null` returns exactly the em dash string character. This verifies the not-yet-entered display case.

The test for a value of 0 should assert that `applyWRule` returns the string `"W"`. Zero is a valid score but falls well below the threshold, confirming the warning logic activates at the extreme low end.

The test for a value of 34 should assert that `applyWRule` returns the string `"W"`. This is the boundary case one unit below the threshold and confirms the strict less-than condition.

The test for a value of 35 should assert that `applyWRule` returns the string `"35"`. This is the threshold boundary itself and confirms that the boundary is inclusive on the non-warning side.

The test for a value of 100 should assert that `applyWRule` returns the string `"100"`. This validates the high-end passing case.

**`isWMark` test cases:**

The test for a null input should assert that `isWMark` returns `false`. Null means no mark entered; it is not a warning.

The test for a value of 34 should assert that `isWMark` returns `true`. This confirms the function correctly identifies a below-threshold mark.

The test for a value of 35 should assert that `isWMark` returns `false`. This confirms the threshold boundary is handled correctly for the boolean predicate.

**`getWSubjects` test cases:**

A test with all nine subject marks set to values greater than or equal to 35 should assert that `getWSubjects` returns an empty array. No warnings mean no subjects listed.

A test with mathematics set to 30, all others set to 50 or above, and a valid `electiveLabels` array should assert that the returned array contains exactly one element, the string `"Mathematics"`.

A test with `elective1` set to 20 and `electiveLabels` set to `["Art", "Music", "Drama"]` should assert that the returned array contains `"Art"`, confirming the dynamic elective label mapping.

A test with `elective2` set to 15 and `electiveLabels` set to an empty array should assert that the returned array contains `"Elective 2"`, confirming the fallback behavior when `electiveLabels` is missing entries.

A test with multiple subjects at warning level — for example, english set to 10, geography set to 28, and mathematics set to 50 — should assert that the returned array contains `"English"` and `"Geography"` (in that order) and does not contain `"Mathematics"`.

### Integration Tests for API Routes

Integration tests for the API routes require a test database or a Prisma client mock. They should be placed in `__tests__/api/` following Next.js conventions for route handler testing. These tests exercise the HTTP layer including authentication middleware, Zod validation, and Prisma interactions.

**GET `/api/marks` integration tests:**

A request made without a valid session cookie should receive HTTP 401. This validates that the authentication guard is functioning.

A request made with a valid session but without either `studentId` or `classId` in the query string should receive HTTP 400. This validates the cross-field requirement check.

A request made with a valid session and a valid `classId` that exists in the test database with seeded MarkRecords should receive HTTP 200 with a non-empty JSON array.

A request made with a valid session and a `classId` that has no MarkRecords should receive HTTP 200 with an empty JSON array, not a 404.

**POST `/api/marks` integration tests:**

A request made with a session belonging to the Student role should receive HTTP 403.

A request made with a valid Admin session and a `marks.english` value of 150 should receive HTTP 422 because 150 exceeds the valid range of 0–100. The response body should contain a structured Zod error identifying the `marks.english` field.

A request made with a valid Teacher session and a fully valid body should receive either HTTP 201 (on first insert) or HTTP 200 (on subsequent update for the same composite key).

**PATCH `/api/marks/batch` integration tests:**

A request made with a valid Teacher session and a fully valid batch body where all `studentId` values exist in the specified class should receive HTTP 200 with a `succeeded` array containing all submitted student IDs and an empty `failed` array.

A request made with a valid Teacher session where one `studentId` in the `entries` array does not belong to the specified `classId` should receive HTTP 207. The `succeeded` array should contain the valid student IDs, and the `failed` array should contain the invalid `studentId` with an explanatory reason string.

---

## Implementation Notes and Warnings

### Do Not Apply W-Rule in API Layer

This bears repeating: the W-Rule must not be applied inside any API route handler. The database stores integers and nulls. The API returns integers and nulls. The W-Rule string transformation happens in React components and PDF generators. If a future developer is tempted to apply `applyWRule` inside the Prisma query result mapping in any route handler, they must be strongly counseled against it. Mixing display logic into the data layer breaks the contract that allows different consumers (web UI, PDF, CSV export) to apply their own display rules to the same raw data.

### Type Safety for the Dynamic Subject Key

In PATCH `/api/marks/batch`, the `subject` parameter received from the request body is used to dynamically construct the dot-notation update path. TypeScript's strict mode will require careful typing here. The `subject` value should be typed as one of the nine valid subject key strings using a union type or a Zod enum's TypeScript inferred type. When constructing the Prisma update payload with a key like `"marks.mathematics"`, TypeScript may require an explicit type assertion or a utility type to satisfy the Prisma type checker. Developers should handle this using a type assertion narrowed to the expected Prisma update input type rather than using a broad `as any` assertion, which would silence TypeScript's checks entirely and defeat the purpose of strict mode.

### Upsert Composite Key Configuration

Prisma's `upsert` operation requires the `where` clause to reference a field or combination of fields with a unique constraint. The composite unique index across `(studentId, classId, year, term)` must be defined in `schema.prisma` as a `@@unique` directive. If this index is missing, the Prisma client will throw a type error at compile time because the `where` clause for `upsert` on the `MarkRecord` model will not accept that field combination. Verify that the Prisma schema from Phase 1 Task 2 includes this directive before attempting to implement the upsert logic.
