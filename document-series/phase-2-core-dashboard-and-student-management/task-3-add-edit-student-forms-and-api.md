# Phase 2 / Task 3 — Add and Edit Student Forms and API

**Phase:** 2 — Core Dashboard and Student Management
**Task:** 3 of 4
**Title:** Add and Edit Student Forms and API
**Estimated Complexity:** Medium

---

## Task Summary

This task implements the complete student creation and editing workflow. It introduces the Add Student page at `/dashboard/students/new`, the Edit Student page at `/dashboard/students/[id]/edit`, and the two API routes that back them: `POST /api/students` for creating a new student record and `PATCH /api/students/[id]` for updating an existing one.

Both pages render a shared `StudentForm` Client Component that operates in either `"create"` or `"edit"` mode. The form drives all interaction: field-level Zod validation, grade-to-section filtering, a debounced index number availability check, submission with loading state management, field-level API error mapping, and success redirect. Server-side, both API routes enforce role-based access, validate inputs with Zod schemas, perform database-level uniqueness and referential integrity checks, write audit log entries, and return structured error or success responses.

This task also solidifies the ClassGroup data layer by documenting the seed utility at `lib/seed-class-groups.ts` and integrating elective label resolution from `SystemConfig` into the page server components and the form component itself.

---

## Prerequisites

- Phase 2 / Task 1 complete: the dashboard layout shell and navigation are in place, including the `/dashboard/students` route and sidebar link.
- Phase 2 / Task 2 complete: the Student List, Profile, and Delete pages and their API routes are implemented. The `Student` Prisma model is fully defined (including `isDeleted`, `indexNumber`, `classId`, `electives.categoryI/II/III`, `grade`, `classSection`). The `requireAuth` helper and the audit log write utility (`lib/audit.ts`) are available.
- `ClassGroup` records exist in the database, or the seeding mechanism introduced here can be triggered from the Settings page (Phase 2 / Task 4).
- `SystemConfig` keys `"elective_label_I"`, `"elective_label_II"`, and `"elective_label_III"` may or may not exist; fallback values handle the case where they are absent.
- `GET /api/students` with a `search` query parameter is functional (implemented in Task 2) and returns an array of student objects. The index number availability check in the form uses this endpoint.
- The Prisma client is initialised in `lib/prisma.ts` and the `AuditLog` model was defined in Phase 1 / Task 2.

---

## Task Scope

**In scope:**
- `lib/seed-class-groups.ts` utility that checks for and creates the 36 standard ClassGroup documents.
- `POST /api/students` route: Zod validation, classId verification, indexNumber uniqueness check, Student creation, audit log write.
- `PATCH /api/students/[id]` route: partial update with Zod, uniqueness check excluding self, change tracking, audit log write.
- `app/dashboard/students/new/page.tsx`: Server Component page, role guard, ClassGroup fetch, elective label fetch, renders `StudentForm` in create mode.
- `app/dashboard/students/[id]/edit/page.tsx`: Server Component page, role guard, student + ClassGroup + label fetch, `notFound()` guard, renders `StudentForm` in edit mode.
- `components/students/StudentForm.tsx`: shared Client Component, all form logic, validation, submission, loading states.
- Grade→Section filtering logic within the form.
- Debounced index number availability check UX hint.
- API error→field error mapping in the form.
- Role enforcement at both page and API levels.
- Audit log entries for `STUDENT_CREATED` and `STUDENT_UPDATED`.

**Out of scope:**
- Bulk student import (Phase 5).
- Student photo upload.
- Class Group editing or deletion UI (Settings page, Phase 2 / Task 4).
- Mark entry (Phase 3).
- Any analytics or reporting.

---

## Acceptance Criteria

1. Navigating to `/dashboard/students/new` as ADMIN or SUPERADMIN renders the Add Student form with all fields, a populated Grade dropdown, and a Class Section dropdown that is empty or disabled until a grade is selected.
2. Navigating to `/dashboard/students/new` as STAFF redirects the user to `/dashboard/students` (enforced at the page level by the session role check).
3. Submitting the Add Student form with valid data calls `POST /api/students`, creates a Student record, writes a `STUDENT_CREATED` audit log entry, and redirects the user to the new student's profile page.
4. Submitting the Add Student form with a duplicate index number returns a 400 response with `field: "indexNumber"` populated, and the form displays the error inline beneath the Index Number field without a full page reload.
5. Navigating to `/dashboard/students/[id]/edit` as ADMIN or SUPERADMIN renders the Edit Student form pre-populated with the student's current data, including the correct grade selection, section selection, and elective values.
6. Navigating to `/dashboard/students/[id]/edit` for a student where `isDeleted=true` or for a non-existent ID renders the Next.js 404 page (via `notFound()`).
7. Submitting the Edit Student form with valid changes calls `PATCH /api/students/[id]`, updates only the provided fields, writes a `STUDENT_UPDATED` audit log entry with `changedFields` and `newValues`, and redirects to the student's profile.
8. Changing the Grade dropdown in the form immediately filters the Class Section dropdown to show only sections that exist for that grade in the `availableClasses` data, and clears any previously selected section.
9. Typing a value into the Index Number field triggers a debounced availability check (500 ms delay) that queries the API and shows a "Checking availability…" indicator, resolving to either a green "Available" hint or an amber "Index number already in use" warning, without blocking form submission.
10. Elective field labels in the form read from `SystemConfig` values (e.g., "Elective I (Geography)" if `elective_label_I = "Geography"`), and fall back to "Elective I (Category I)" if the config key is absent.
11. If no ClassGroup records exist when the Add or Edit Student page loads, the page renders an informational message: "No class groups are configured. Please seed class groups from the Settings page." and the form is not rendered.
12. The `POST /api/students` and `PATCH /api/students/[id]` routes both return `401` for unauthenticated requests and `403` for requests from STAFF role users.

---

## ClassGroup Setup and Seed Utility

### What ClassGroups Are

A `ClassGroup` document represents one physical class: a specific grade (6 through 11) combined with a section letter (A through F). Every student belongs to exactly one ClassGroup via the `classId` foreign key. ClassGroups are the source of truth for the Grade and Class Section dropdowns in the StudentForm. They are never deleted through the normal UI; they are seeded once and treated as static reference data unless an administrator explicitly manages them from the Settings page.

### Standard Combinations

The standard school configuration has 36 class groups: each of grades 6, 7, 8, 9, 10, and 11 combined with each of sections A, B, C, D, E, and F. These 36 documents have a `grade` integer field (6–11) and a `section` string field ("A"–"F"). The combination is unique in the database — a compound unique index on `(grade, section)` prevents duplicates.

### When and How the Seed Runs

The primary trigger for seeding ClassGroups is the `POST /api/config/connect` route introduced in Phase 1 / Task 5. After a successful database connection is established, that route calls the seed utility function before returning the success response. This means ClassGroups are automatically created the first time an administrator connects the database through the setup wizard.

The seed utility is also safe to run at any later time: it first queries the database to check if any ClassGroup documents exist. If at least one ClassGroup is found, the utility returns immediately without making any writes. If none are found, it proceeds to create all 36 documents using a single `prisma.classGroup.createMany` call with `skipDuplicates: true`. This idempotency ensures that calling the seed multiple times, or running it against a partially-seeded collection, never produces errors or duplicate records.

### The Seed Utility File — `lib/seed-class-groups.ts`

This file exports a single async function, `seedClassGroups`, which takes no arguments and returns a promise that resolves to an object with a `created` count and a `skipped` boolean. Internally it:

1. Calls `prisma.classGroup.count()` to check for existing records.
2. If the count is greater than zero, returns `{ created: 0, skipped: true }`.
3. Otherwise, builds an array of 36 objects by iterating over grades `[6, 7, 8, 9, 10, 11]` and sections `["A", "B", "C", "D", "E", "F"]`, producing `{ grade, section }` for each combination.
4. Calls `prisma.classGroup.createMany` with the full array and `skipDuplicates: true`.
5. Returns `{ created: result.count, skipped: false }`.

The function does not throw on a clean run; uncaught Prisma errors should propagate to the caller so that the route handler can return an appropriate error response.

### Missing ClassGroups at Page Load

When the Add Student or Edit Student page server component fetches ClassGroups and receives an empty array, it does not render the `StudentForm`. Instead it renders a full-width informational `Alert` component (using shadcn/ui `Alert` with `variant="default"` and an info icon) displaying: "No class groups are configured. Please seed class groups from the Settings page." This message links the text "Settings page" to `/dashboard/settings`. This prevents the form from rendering with empty dropdowns, which would confuse users and produce invalid API calls.

---

## Elective Label Resolution

### Fetching Labels from SystemConfig

Both the Add Student page and the Edit Student page server components query `SystemConfig` for the three elective label keys. They use `prisma.systemConfig.findMany` with a `where: { key: { in: ["elective_label_I", "elective_label_II", "elective_label_III"] } }` filter to retrieve up to three records in a single query. Each record has a `key` and a `value` string field.

The server component then reduces the resulting array into a lookup object keyed by config key. For each of the three expected keys, it reads the corresponding value or falls back to a default if the key was not found in the database:

- `"elective_label_I"` → fallback `"Category I"`
- `"elective_label_II"` → fallback `"Category II"`
- `"elective_label_III"` → fallback `"Category III"`

This resolved labels object is shaped as `{ labelI: string, labelII: string, labelIII: string }` and passed as the `electives` prop to `StudentForm`.

### How Labels Appear in the Form

Inside `StudentForm`, the three elective fields use the resolved labels in two places:

1. As the field label rendered above the input: "Elective I (LabelI)", "Elective II (LabelII)", "Elective III (LabelIII)". If the label is the default "Category I", the field label reads "Elective I (Category I)".
2. As the placeholder text inside each text input: the placeholder mirrors the label value (e.g., "Geography" if the label is "Geography").

These labels are display-only. The actual values the user types into the elective fields are stored as free text on the student document's `electives.categoryI`, `electives.categoryII`, and `electives.categoryIII` fields. There is no relationship between the label configuration and the stored student data — the labels serve only as prompts to guide the administrator while entering data.

---

## Implementation Steps

### Step 1 — POST /api/students Route (Create)

**File:** `app/api/students/route.ts` — add the `POST` export alongside the existing `GET`.

The handler first calls `requireAuth(request, ["ADMIN", "SUPERADMIN"])`, which returns either the authenticated session or throws/returns a 401/403 response depending on the implementation pattern established in Phase 1. If the session is not valid or the role is insufficient, the route returns the appropriate error response immediately.

Define a Zod schema for the request body with the following fields: `name` as a trimmed string with a minimum length of 2 and maximum of 100 characters; `indexNumber` as a trimmed string matching the pattern `^[A-Za-z0-9]{2,20}$`; `classId` as a non-empty string; and `electives` as an object containing three required string fields `categoryI`, `categoryII`, and `categoryIII`, each at least 1 character and at most 100.

Parse the request body with `schema.safeParse`. If parsing fails, extract the Zod field errors into a `fields` object mapping each field path to its first error message, and return a 400 JSON response with `{ error: "Validation failed", fields }`.

Next, verify the `classId` refers to a real ClassGroup document by calling `prisma.classGroup.findUnique({ where: { id: classId } })`. If null, return a 400 response with `{ error: "Invalid class selected", fields: { classId: "Class not found" } }`.

Check index number uniqueness: call `prisma.student.findFirst({ where: { indexNumber: body.indexNumber, isDeleted: false } })`. If a record is found, return a 400 response with `{ error: "Index number already in use", fields: { indexNumber: "This index number is already assigned to another student" } }`.

Retrieve the `grade` and `section` values from the found ClassGroup record (from the `findUnique` call above) so they can be stored directly on the Student document and included in the audit log details.

Create the student: call `prisma.student.create` with `name`, `indexNumber`, `classId`, `grade`, `classSection` (from the ClassGroup's `section` field), `electives` as a nested object `{ categoryI, categoryII, categoryIII }`, `isDeleted: false`. The `createdAt` field is set automatically by Prisma's `@default(now())`.

Write the audit log using the `writeAuditLog` utility from `lib/audit.ts`. Pass: `userId` and `userDisplayName` from the session; `action: "STUDENT_CREATED"`; `targetId: newStudent.id`; `targetType: "STUDENT"`; `details: { name: newStudent.name, indexNumber: newStudent.indexNumber, grade: newStudent.grade, classSection: newStudent.classSection }`.

Return a 201 JSON response with the full created student object.

---

### Step 2 — PATCH /api/students/[id] Route (Update)

**File:** `app/api/students/[id]/route.ts` — add a `PATCH` export alongside the existing `GET` and `DELETE`.

Call `requireAuth` with `["ADMIN", "SUPERADMIN"]` as before.

Define a Zod schema with all fields optional: `name` as optional trimmed string (2–100 chars); `indexNumber` as optional string matching alphanumeric pattern; `classId` as optional non-empty string; `electives` as an optional object where each of `categoryI`, `categoryII`, `categoryIII` is individually optional (but if `electives` is provided, at least one subfield should be present — validate this at the object level).

Parse the body with `safeParse`; return 400 with `fields` map on failure.

Fetch the current student: `prisma.student.findUnique({ where: { id: params.id } })`. If null or if `isDeleted` is true, return a 404 response with `{ error: "Student not found" }`.

If `indexNumber` is being updated (the body contains an `indexNumber` value that differs from `currentStudent.indexNumber`), perform a uniqueness check: `prisma.student.findFirst({ where: { indexNumber: body.indexNumber, isDeleted: false, NOT: { id: params.id } } })`. If a record is found, return a 400 with `{ error: "Index number already in use", fields: { indexNumber: "..." } }`.

If `classId` is being updated, verify the new ClassGroup exists and retrieve its `grade` and `section` values for denormalisation.

Track changed fields before writing: build a `changedFields` array of field name strings and a `newValues` object by comparing the submitted body values against the current student. Only include fields where the submitted value differs from the stored value.

Perform the Prisma update: call `prisma.student.update({ where: { id: params.id }, data: { ...updatedFields } })`. If `classId` changes, also update `grade` and `classSection` to the new ClassGroup's values. For `electives`, merge carefully: if only `categoryI` is submitted in the body, the update must not clear `categoryII` and `categoryIII`. Use a spread pattern that reads existing elective values from `currentStudent.electives` and overlays only the submitted subfields.

Write the audit log with `action: "STUDENT_UPDATED"`, `targetId: params.id`, `targetType: "STUDENT"`, `details: { changedFields, newValues }`.

Return a 200 JSON response with the full updated student object returned by the Prisma update call.

---

### Step 3 — Add Student Page (/dashboard/students/new)

**File:** `app/dashboard/students/new/page.tsx`

This is a `async` Server Component. At the top of the function body, call `getServerSession(authOptions)` (or the equivalent NextAuth v5 pattern, `auth()`) and check `session?.user?.role`. If the role is not `"ADMIN"` or `"SUPERADMIN"`, call `redirect("/dashboard/students")`.

Fetch ClassGroups: `prisma.classGroup.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] })`. This returns all 36 records (or fewer if some are missing).

Fetch elective labels: query `SystemConfig` for the three keys and resolve them to `{ labelI, labelII, labelIII }` using the fallback logic described in the Elective Label Resolution section.

If the ClassGroups array is empty, return early rendering the informational `Alert` component without rendering `StudentForm`.

Otherwise, render the `StudentForm` component with `mode="create"`, `availableClasses={classGroups}`, `electives={resolvedLabels}`.

The page should be wrapped in the dashboard layout with an appropriate page title ("Add Student") rendered via the layout's header slot or a local `<h1>` element.

Set the Next.js `metadata` export with `title: "Add Student | SchoolMS"`.

---

### Step 4 — Edit Student Page (/dashboard/students/[id]/edit)

**File:** `app/dashboard/students/[id]/edit/page.tsx`

This is an `async` Server Component. Perform the same role check as the Add Student page; redirect to `/dashboard/students` if the user is STAFF.

Fetch the target student: `prisma.student.findUnique({ where: { id: params.id } })`. If the result is null or `isDeleted` is true, call `notFound()` from `next/navigation` immediately — this triggers the nearest `not-found.tsx` boundary or the default Next.js 404 page.

Fetch ClassGroups and elective labels in parallel using `Promise.all` to avoid waterfall fetching. Both are independent of the student fetch result (assuming the student was found).

Render `StudentForm` with `mode="edit"`, `student={studentData}`, `availableClasses={classGroups}`, `electives={resolvedLabels}`.

The page title should be "Edit Student — [student name]" and `metadata.title` should reflect that.

---

### Step 5 — StudentForm Shared Component — Structure and Props

**File:** `components/students/StudentForm.tsx`

Mark this file with `"use client"` at the top.

The component accepts the following props:

- `mode`: `"create" | "edit"` — controls submit button label, cancel destination, and which API endpoint to call.
- `student`: an optional object matching the Prisma `Student` shape — present only in edit mode. When present, it provides initial values for all form fields.
- `availableClasses`: an array of objects `{ id: string, grade: number, section: string }` — the full list of ClassGroups fetched server-side.
- `electives`: `{ labelI: string, labelII: string, labelIII: string }` — resolved elective labels.
- `onSuccess`: optional `(studentId: string) => void` callback invoked after a successful submission. If omitted, the component handles redirection itself via `useRouter().push(...)`.

Internal state managed by the component includes: all form field values as a single `formData` state object; field-level validation errors as a `fieldErrors` object mapping field names to error strings; a `generalError` string for non-field errors; `isSubmitting` boolean; `indexCheckStatus` as one of `"idle" | "checking" | "available" | "taken"`; and the currently filtered list of sections derived from the selected grade and `availableClasses`.

On mount in edit mode, initialise `formData` from `student` prop values: set `name`, `indexNumber`, `grade` (as string), `classId`, `categoryI`, `categoryII`, `categoryIII`. Initialise `selectedGrade` to `student.grade` so the section filter renders the correct options.

---

### Step 6 — Grade → Section Filtering Logic

When the user selects a grade from the Grade dropdown, the component:

1. Updates the `selectedGrade` state value to the newly selected integer (or null if deselected).
2. Clears the `classId` field in `formData` (to avoid retaining a now-invalid section selection).
3. Clears any existing error on the `classSection` / `classId` field.
4. Computes the filtered sections list: filter `availableClasses` to entries where `availableClasses[i].grade === selectedGrade`, then map each to `{ id: item.id, label: \`${item.grade}${item.section}\` }` (e.g., `"10A"`, `"10B"`).

The Class Section dropdown renders from this derived filtered list. Its `value` is bound to `formData.classId`. The dropdown is disabled when `selectedGrade` is null or when `isSubmitting` is true.

In edit mode, on initial render the filtered section list is pre-computed from the student's current `grade` value so the section dropdown shows valid options immediately without requiring the user to re-select the grade. The `classId` initial value from the student prop pre-selects the correct section in the dropdown.

If the user changes the grade in edit mode, the section selection is cleared and the user must re-select a section. This is intentional: changing grade implies the class group must also change.

---

### Step 7 — Index Number Availability Check

This is a client-side UX convenience feature, not a security mechanism. The server always performs its own uniqueness check.

The component uses a `useEffect` that depends on `formData.indexNumber`. When the index number field value changes, the effect:

1. Clears any existing `indexCheckStatus` by setting it to `"idle"`.
2. If the new value is an empty string or the form is in edit mode and the value equals `student.indexNumber` (unchanged), the effect exits early — no API call is needed.
3. Otherwise, it sets a timeout of 500 ms. When the timeout fires, it sets `indexCheckStatus` to `"checking"`, then calls `GET /api/students?search=${encodeURIComponent(value)}`. Use an `AbortController`: create the controller before the timeout, and call `controller.abort()` in the effect's cleanup function so that in-flight requests are cancelled if the user continues typing.
4. On receiving the response, parse the JSON array. Check whether any returned student has an `indexNumber` that exactly matches (case-insensitive) the entered value and, in edit mode, is not the current student's own ID. If such a match exists, set `indexCheckStatus` to `"taken"`; otherwise set it to `"available"`.
5. If the fetch throws an `AbortError`, do nothing. Any other error should silently reset `indexCheckStatus` to `"idle"`.

The component renders a small inline hint beneath the Index Number field based on `indexCheckStatus`:

- `"checking"`: a spinner icon with the text "Checking availability…" in muted gray.
- `"available"`: a green checkmark icon with "Available".
- `"taken"`: an amber warning icon with "Index number already in use (hint only — confirmed on submit)".
- `"idle"`: nothing rendered.

The "taken" warning does not prevent form submission; it is informational only.

---

### Step 8 — Form Submission Logic

When the user clicks the submit button, the handler:

1. Calls `event.preventDefault()`.
2. Clears `fieldErrors` and `generalError`.
3. Runs client-side Zod validation against the current `formData`. The client schema mirrors the server schema. On failure, maps the Zod errors into the `fieldErrors` state object and returns early without making an API call.
4. Sets `isSubmitting` to true.
5. Determines the API endpoint and HTTP method: `POST /api/students` in create mode; `PATCH /api/students/${student.id}` in edit mode.
6. Constructs the request body JSON: always includes `name`, `indexNumber`, `classId`; always includes the `electives` object with `categoryI`, `categoryII`, `categoryIII`. In edit mode, sends all fields regardless of whether they changed — the server tracks changes internally.
7. Calls `fetch` with `method`, `headers: { "Content-Type": "application/json" }`, and `body: JSON.stringify(payload)`. Wraps this in a try/catch.
8. If the response status is 400, parses the JSON body. If `body.fields` exists, maps each key from `body.fields` into `fieldErrors` state. Sets `generalError` to `body.error`. Sets `isSubmitting` to false and returns.
9. If the response status is 401 or 403, sets `generalError` to "You do not have permission to perform this action." Sets `isSubmitting` to false and returns.
10. If the response is not `ok` for any other reason (500, network failure), sets `generalError` to "An unexpected error occurred. Please try again." Sets `isSubmitting` to false and returns.
11. On a 201 (create) or 200 (edit) success response, parses the returned student JSON. Calls `onSuccess(returnedStudent.id)` if the prop is provided. Otherwise calls `router.push(\`/dashboard/students/${returnedStudent.id}\`)`. Does not set `isSubmitting` back to false before the redirect (the page transition naturally unmounts the form).

---

### Step 9 — Loading and Disabled States

While `isSubmitting` is true, the following UI changes apply:

- The entire form's inputs and selects are given the `disabled` attribute. Apply this by passing `disabled={isSubmitting}` to each individual field, or by wrapping fields in a `<fieldset disabled={isSubmitting}>` element.
- The submit button displays a spinning loader icon (use shadcn/ui's `Loader2` icon with the `animate-spin` class) alongside either "Adding Student…" (create) or "Saving…" (edit) as the button text.
- The cancel button remains enabled at all times — it is a link (`<Link>` component), not a standard button, so it is inherently unaffected by the fieldset disabled state and is never visually disabled.
- The index number availability hint is frozen at its current state during submission and the `useEffect` debounce timer, if pending, does not fire new API calls while `isSubmitting` is true (check the boolean before calling fetch inside the timeout).

---

### Step 10 — API Error to Field Error Mapping

The server returns structured 400 responses in two shapes:

Shape A — field-level errors: `{ error: "Validation failed", fields: { fieldName: "message", ... } }`. The `fields` object may contain keys corresponding to any of the form's fields: `name`, `indexNumber`, `classId`, `electives.categoryI`, `electives.categoryII`, `electives.categoryIII`.

Shape B — non-field errors: `{ error: "Error message" }` with no `fields` key. For example, the "Class not found" error for an invalid `classId` falls into this category alongside a general server error message.

The form component checks for the presence of `body.fields` on a 400 response. If present, it iterates `Object.entries(body.fields)` and sets each key/value into the `fieldErrors` state object. For nested keys like `"electives.categoryI"`, the component stores these using the dotted path as the key and looks up that key when rendering the error beneath the `categoryI` input.

Each form field's error is rendered as a `<p>` element with a red text class (e.g., `text-destructive text-sm`) immediately below the corresponding input. The error text is the value from `fieldErrors["fieldName"]` or `undefined` (in which case the element is not rendered). Always set `aria-describedby` on each input pointing to its error element's `id` for accessibility.

The `generalError` (set from `body.error` for any 400 or non-OK response) is displayed in a red `Alert` component at the top of the form, above all fields, so the user sees the summary error without scrolling.

---

## Role Enforcement

**Add Student page** (`/dashboard/students/new`): The server component reads `session.user.role`. If the role is `"STAFF"`, call `redirect("/dashboard/students")`. The check occurs before any database queries are made. If there is no session at all, redirect to the login page.

**POST /api/students**: The `requireAuth` call specifies `["ADMIN", "SUPERADMIN"]` as the permitted roles array. If the requesting user's role is `"STAFF"` or if there is no session, the helper returns a 403 or 401 response respectively, and the route handler returns that response immediately.

**Edit Student page** (`/dashboard/students/[id]/edit`): The same server-side role check as the Add Student page. Redirect to `/dashboard/students` for STAFF.

**PATCH /api/students/[id]**: Same `requireAuth` call pattern as the POST route.

Note: the navigation sidebar conditionally hides the "Add Student" button/link for STAFF users (implemented in Phase 2 / Task 1 as part of the role-aware nav), but this is a UI convenience only — the server-level enforcement in pages and API routes is the real access control boundary.

---

## Audit Log Entries

### STUDENT_CREATED

Written after a successful student creation in `POST /api/students`. Fields:

- `userId`: the ID of the currently authenticated user performing the action (from session).
- `userDisplayName`: the name or email of the authenticated user (from session).
- `action`: the string literal `"STUDENT_CREATED"`.
- `targetId`: the Prisma-assigned `id` of the newly created Student document.
- `targetType`: the string `"STUDENT"`.
- `details`: a JSON object containing `name` (the student's full name), `indexNumber`, `grade` (integer), and `classSection` (the section string, e.g., "A").

### STUDENT_UPDATED

Written after a successful student update in `PATCH /api/students/[id]`. Fields:

- `userId` and `userDisplayName`: as above.
- `action`: `"STUDENT_UPDATED"`.
- `targetId`: the ID of the updated student.
- `targetType`: `"STUDENT"`.
- `details`: a JSON object containing `changedFields` (an array of the field name strings that were actually changed, e.g., `["name", "classId"]`) and `newValues` (an object mapping each changed field name to its new value after the update, e.g., `{ name: "Alice New Name", classId: "..." }`). Fields that were submitted but whose values are identical to the stored values should not appear in `changedFields`.

If no fields were actually changed (the submitted values are identical to all current values), still write the audit log but with `changedFields: []` and `newValues: {}` — a no-op update is worth logging for traceability.

---

## File Inventory

The following files are created or modified by this task:

- `lib/seed-class-groups.ts` — new file; exports `seedClassGroups` async utility function.
- `app/api/students/route.ts` — modified; `POST` handler added alongside existing `GET`.
- `app/api/students/[id]/route.ts` — modified; `PATCH` handler added alongside existing `GET` and `DELETE`.
- `app/dashboard/students/new/page.tsx` — new file; Server Component for Add Student page.
- `app/dashboard/students/new/` — new directory.
- `app/dashboard/students/[id]/edit/page.tsx` — new file; Server Component for Edit Student page.
- `app/dashboard/students/[id]/edit/` — new directory.
- `components/students/StudentForm.tsx` — new file; shared Client Component for both forms.

No new Prisma schema changes are required in this task — all models (`Student`, `ClassGroup`, `SystemConfig`, `AuditLog`) were defined in Phase 1 / Task 2.

---

## Integration Points

Phase 3 (Marks Entry and Progress Reports) depends on the following outputs from this task:

- The `ClassGroup` collection populated with the 36 standard records — Phase 3's class selector for mark entry iterates over this collection.
- The `Student.classId` field reliably pointing to a valid `ClassGroup` — Phase 3 queries students by `classId` to list students in a given class during mark entry.
- The `Student.grade` and `Student.classSection` denormalised fields — Phase 3 uses these for display in the marks table header and for filtering without joining ClassGroup on every query.
- The `Student.electives.categoryI/II/III` fields — Phase 3 renders elective subject columns in the marks sheet using these per-student values directly.
- The `StudentForm` component pattern (Zod client+server validation, field error mapping, loading state) establishes conventions reused in Ph 3's mark-entry forms.

---

## Common Pitfalls

**Grade/section mismatch if section is pre-selected before grade change:** If a user selects section "10A", then changes the grade to 9, the `classId` still holds the ID of the "10A" ClassGroup. Always clear `classId` (and the section dropdown's displayed value) when the Grade dropdown changes. Do not rely on the dropdown's visual state alone; the actual `formData.classId` value must be reset.

**Index number availability check race condition:** If the user types quickly, multiple fetch calls may be in flight simultaneously. Use `AbortController` to cancel the previous request when a new keystroke occurs. The cleanup function of the `useEffect` must call `controller.abort()`. Also, only act on the result of the most recently initiated request — if a stale response resolves after a newer one, it will overwrite `indexCheckStatus` incorrectly. Store a reference to the current request's AbortController in a `useRef` and abort it on each new effect run.

**Zod `coerce` vs string for classId:** The `classId` field is a MongoDB ObjectId stored as a string. Do not use `z.coerce.number()` for it. Use `z.string().min(1)`. If you accidentally coerce it, the Prisma `findUnique` call will receive `NaN` or `"NaN"` as the ID and fail silently or throw a Prisma validation error rather than returning a clean 400.

**PATCH emptying electives on partial update:** If the client sends `{ electives: { categoryI: "Updated" } }` but the Prisma `update` call sets `electives` to `{ categoryI: "Updated" }` directly (without spreading existing values), `categoryII` and `categoryIII` will be overwritten with `undefined` or empty strings in the database. Always merge the submitted elective subfields with the values read from `currentStudent.electives` before writing. Read the current values first, spread them, then overlay the submitted keys.

**Redirect timing after successful create:** The `router.push` call in the form's success handler runs before the new student record is fully indexed in MongoDB (particularly if Atlas has replication lag). If Phase 3's detail page performs a `prisma.student.findUnique` immediately after redirect and the new record is not yet readable, the page will show 404. This is rare with Atlas but possible. The recommended mitigation is to pass the student object from the creation API response into the URL as a shallow query parameter or to use revalidation — but for now, a brief loading skeleton on the profile page that retries once on a 404 is acceptable. Document this as a known limitation, not a bug to fix in this task.

**Forgetting to handle the case where `availableClasses` is empty in the Edit Student page:** If ClassGroups are absent, the server component should render the info alert and not pass `availableClasses={[]}` to `StudentForm`. If an empty array is passed, the form renders but the Grade dropdown has no options and the section dropdown always empty, making the form impossible to submit correctly. Guard against this by checking `classGroups.length === 0` before rendering `StudentForm` on both the Add and Edit pages.
