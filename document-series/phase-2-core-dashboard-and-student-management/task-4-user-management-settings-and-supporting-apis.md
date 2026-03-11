# Phase 2 / Task 4 — User Management, Settings, and Supporting APIs

**Phase:** 2 — Core Dashboard and Student Management
**Task:** 4 of 4
**Title:** User Management, Settings, and Supporting APIs
**Estimated Complexity:** Medium

---

## Task Summary

This task completes Phase 2 by implementing two administrative surfaces and all their backing API routes. The first surface is the User Management page at `/dashboard/settings/users`, which allows ADMIN and SUPERADMIN users to create new accounts, edit existing accounts, and deactivate or reactivate accounts. The second surface is the Settings page at `/dashboard/settings`, which allows authorised users to configure school-level settings including school name, academic year, and elective category labels, and to seed standard class groups. This task also establishes the full audit log constant library for Phase 2, and applies a required schema change — adding `isActive` to the User model — that affects the NextAuth authorize callback.

---

## Prerequisites

All of the following must be complete before starting this task:

- **Phase 1, Task 3** — NextAuth.js v5 is fully configured, the JWT callback exists, and `sessionInvalidatedAt` checking logic is in place on the JWT token refresh cycle (once per hour). The `lib/auth.ts` file is the canonical location for all NextAuth configuration.
- **Phase 1, Task 4** — Middleware-based route protection is active. All `/dashboard/*` routes require an authenticated session. The `withRoleGuard` utility is available for per-route role enforcement inside route handlers.
- **Phase 2, Task 1** — The `AuditLog` Prisma model exists in schema.prisma with fields `id`, `timestamp`, `userId`, `userDisplayName`, `action`, `targetId`, `targetType`, `ipAddress`, and `details`. The Prisma client is generated and available.
- **Phase 2, Task 2** — The Student list, profile, and delete functionality is implemented. The `lib/seed-class-groups.ts` utility exists and exports a callable function that creates standard class group documents and returns the count of documents created.
- **Phase 2, Task 3** — The Add/Edit Student forms and their API routes (`POST /api/students`, `PATCH /api/students/[id]`) are complete. The SystemConfig model is available in the Prisma schema with at minimum `key` and `value` fields.

---

## Task Scope

**In scope:**

- Adding the `isActive` field to the User Prisma model and running `prisma db push`
- Updating the NextAuth `authorize` callback to check `isActive` and surface a deactivation error to the login page
- Session invalidation on deactivation via `sessionInvalidatedAt`
- API routes: `GET /api/users`, `POST /api/users`, `PATCH /api/users/[id]`, `DELETE /api/users/[id]`
- API routes: `GET /api/settings`, `PATCH /api/settings`, `POST /api/settings/seed-classes`
- User Management page at `/dashboard/settings/users` with table, create modal, edit modal, and deactivate/reactivate flow
- Settings page at `/dashboard/settings` with four independent form sections
- `lib/audit-actions.ts` constants file covering all Phase 2 audit action strings

**Out of scope:**

- School logo upload (future feature — a placeholder slot exists in the Settings UI but no upload functionality is implemented)
- Pagination or search on the user list (staff counts are expected to remain under 50)
- Creating SUPERADMIN accounts via the UI (the initial SUPERADMIN is created during the database setup phase only)
- Deleting STAFF accounts via the UI (only deactivation is available to ADMIN; hard delete is available to SUPERADMIN for non-SUPERADMIN accounts)
- Any email notification on account creation or deactivation

---

## Acceptance Criteria

1. The User model in `prisma/schema.prisma` contains an `isActive` field of type Boolean with a default of true, and the schema has been pushed to MongoDB Atlas.
2. A deactivated user who attempts to log in sees the message "Your account has been deactivated. Contact your administrator." on the login page.
3. When a user is deactivated, their `sessionInvalidatedAt` is set to the current timestamp, which causes their existing JWT to be invalidated on its next refresh cycle (within one hour).
4. `GET /api/users` returns only accounts scoped to the requester's role: ADMIN receives STAFF accounts plus their own account; SUPERADMIN receives all accounts. No `passwordHash` or sensitive token fields are returned.
5. `POST /api/users` creates a new user with a bcrypt-hashed password (12 rounds), enforces that an ADMIN cannot create another ADMIN, and writes a `USER_CREATED` audit log entry.
6. `PATCH /api/users/[id]` handles name, email, role, and isActive changes with the correct role-elevation and self-edit restrictions enforced server-side.
7. `DELETE /api/users/[id]` is gated to SUPERADMIN only, refuses to delete the SUPERADMIN account, and writes a `USER_DELETED` audit log entry.
8. The User Management page renders a table of the appropriate accounts with name, email, role badge, creation date, status badge, and per-row action buttons.
9. The Create User modal validates all fields (required fields, email format, password minimum 8 characters, password confirmation match) client-side before submission and shows inline error messages.
10. The Edit User modal pre-populates all editable fields from the selected user record and enforces role-change restrictions in the UI (an ADMIN editing their own account cannot change their role).
11. Deactivation of a user requires confirmation via an AlertDialog. Reactivation is immediate without a dialog.
12. `GET /api/settings` returns all five configuration values (`school_name`, `academic_year`, `elective_label_I`, `elective_label_II`, `elective_label_III`) with hardcoded fallback defaults when keys are absent.
13. `PATCH /api/settings` upserts each supplied key in SystemConfig, writes a `SETTINGS_UPDATED` audit log entry, and returns the updated values.
14. The Settings page has four visually distinct sections, each with its own Save button that submits only that section's values independently.
15. The "Seed Standard Class Groups" button on the Settings page is only shown when fewer than 36 class group documents exist in the database, requires confirmation, and returns the number of documents seeded.
16. `lib/audit-actions.ts` exports string constants for all Phase 2 audit action types, and all API routes in Phase 2 import from this file rather than embedding inline strings.

---

## User Model Change — isActive Field

The User model requires one new field before this task's implementation can proceed. Add `isActive` as a Boolean field with a default value of true. This field controls whether the account can be used to authenticate. It does not represent deletion — deactivated accounts remain visible in the user management table and can be reactivated at any time.

After modifying `prisma/schema.prisma`, run `prisma db push` to propagate the change to the MongoDB Atlas collection. Because MongoDB is schemaless, existing User documents will have `isActive` treated as absent (undefined) by Prisma until explicitly set. The authorize callback must handle this by treating a missing or null `isActive` as active (truthy check: `user.isActive !== false`), so that existing accounts are not inadvertently blocked after the schema change.

Regenerate the Prisma client after the push so that TypeScript picks up the new field in the `User` type. Any existing code that creates User documents must not break — because the field has a Prisma-level default of true, omitting it from a `create` call is safe.

---

## Account Deactivation and Session Invalidation

Setting `isActive` to false on a User document has two effects that must both be implemented:

**Effect 1 — Login prevention:** The NextAuth `authorize` callback fetches the user record and checks `isActive`. If false, it throws an error with the string `"AccountDeactivated"` rather than returning null. The distinction matters because NextAuth treats a thrown error differently from a null return — it surfaces the error message in the callback URL as the `error` query parameter. The login page reads this parameter: if it equals `"AccountDeactivated"`, it renders the specific message "Your account has been deactivated. Contact your administrator." rather than the generic "Invalid credentials" message.

**Effect 2 — Session termination for active sessions:** If the user is currently logged in when deactivated, their existing JWT session remains valid until its next forced revalidation. The mechanism from Phase 1 Task 3 revalidates the JWT token once per hour by checking `sessionInvalidatedAt` against the token's `lastValidated` timestamp. The `PATCH /api/users/[id]` route, when setting `isActive` to false, must also write the current timestamp to `sessionInvalidatedAt`. This causes the next JWT callback refresh for that user to detect that the token was issued before the invalidation timestamp, which terminates the session and redirects the user to the login page. Conversely, when reactivating a user (setting `isActive` to true), `sessionInvalidatedAt` must be cleared (set to null) so that the user can log back in and their new session is not immediately invalidated.

---

## Implementation Steps

### Step 1 — GET /api/users Route

Create the route handler at `app/api/users/route.ts`. Authenticate the request using the session guard utility from Phase 1. Reject any request not from an ADMIN or SUPERADMIN with a 403 response. Once the role is confirmed, scope the database query: if the requester is ADMIN, query for User documents where `role` equals `"STAFF"`, then additionally include the requester's own document regardless of role so they can see and manage their own account. If the requester is SUPERADMIN, query for all User documents. In both cases, use a Prisma `select` clause that explicitly includes `id`, `name`, `email`, `role`, `isActive`, `createdAt`, and excludes `passwordHash`, `passwordResetToken`, `passwordResetExpires`, and `sessionInvalidatedAt`. Return the array as JSON with a 200 status.

### Step 2 — POST /api/users Route

Create the POST handler in the same `app/api/users/route.ts` file. Parse and validate the request body using Zod. The schema requires `name` as a non-empty string, `email` as a valid email address, `password` as a string with a minimum length of eight characters, `confirmPassword` as a string that must equal `password`, and `role` as an enum value of either `"STAFF"` or `"ADMIN"`. Return a 400 response with validation error details if the Zod parse fails.

Enforce the role elevation guard: an ADMIN caller may only create STAFF accounts. If an ADMIN submits a request with `role: "ADMIN"`, return a 403 response with the message "Insufficient permissions to create an account with this role." No caller may specify `role: "SUPERADMIN"` — Zod's enum definition does not include it, so this is handled at the validation layer.

Check email uniqueness: query for an existing User document with the submitted email address. If found, return a 409 response with a descriptive error.

Hash the password using bcrypt with 12 salt rounds. Create the User document via Prisma with `name`, `email`, `passwordHash` (the hashed value), `role`, and `isActive: true`. Write the `USER_CREATED` audit log record using the standard pattern (see Audit Log Write Pattern section). Return 201 with the new user's document, using a select clause to exclude `passwordHash`.

### Step 3 — PATCH /api/users/[id] Route

Create the route handler at `app/api/users/[id]/route.ts`. Authenticate and confirm the requester is ADMIN or SUPERADMIN. Fetch the target User document to confirm it exists — return 404 if not found.

Parse the partial request body. Accepted fields are `name`, `email`, `role`, and `isActive`. Apply the following restrictions:

For `role` changes: if the target user is SUPERADMIN, reject with 403 — no one may change the SUPERADMIN's role. If the requester is ADMIN and they are attempting to change their own role, reject with 403. If the requester is ADMIN and they are attempting to set the target's role to `"ADMIN"`, reject with 403 — only SUPERADMIN may elevate a user to ADMIN. If the requester is ADMIN and they are attempting to set the target's role to `"SUPERADMIN"`, reject with 403.

For `email` changes: if the new email differs from the current email, query for uniqueness and reject with 409 if the email is already taken by another account.

For `isActive` changes to false: additionally set `sessionInvalidatedAt` to the current timestamp in the same Prisma `update` call. For `isActive` changes to true: additionally set `sessionInvalidatedAt` to null in the same update call.

Determine the appropriate audit action string: if `isActive` was explicitly set to false, use `USER_DEACTIVATED`; if `isActive` was explicitly set to true, use `USER_REACTIVATED`; otherwise use `USER_UPDATED`. Write the audit log record with a `details` object containing the changed field names and their new values. Return 200 with the updated user document, excluding sensitive fields via select.

### Step 4 — DELETE /api/users/[id] Route

Create the DELETE handler in `app/api/users/[id]/route.ts`. This endpoint is SUPERADMIN-only — return 403 for any other role. Fetch the target User document. Return 404 if not found. If the target user's role is `"SUPERADMIN"`, return 403 with the message "The SUPERADMIN account cannot be deleted." Write a `USER_DELETED` audit log record capturing the target's email and role in the details. Execute a Prisma `delete` on the User document. Return 200.

### Step 5 — User Management Page Architecture

Create the page at `app/dashboard/settings/users/page.tsx` as a Server Component. Retrieve the current session server-side using NextAuth's `auth()` helper — redirect to the dashboard root if the user does not have ADMIN or SUPERADMIN role. Perform a direct Prisma query (matching the same scoping logic as the GET /api/users route) to fetch the visible user list at render time. This avoids a client-side fetch waterfall and allows the table to be server-rendered. Pass the users array and the current session user's role and id as props to child components. Structure the page with a heading row containing a "Create User" button on the right, followed by the user table.

### Step 6 — User Table Component

Create a Client Component for the user table. Columns are: Name, Email, Role, Created, Status, and Actions. The Role column renders a small badge — use a distinct colour per role (e.g., purple for SUPERADMIN, blue for ADMIN, grey for STAFF). The Status column renders "Active" as a green badge and "Deactivated" as a red or muted badge. The Created column renders the `createdAt` date in a human-readable format.

The Actions column renders two icon buttons per row. The first is an edit (pencil) icon button that opens the Edit User modal pre-populated with that row's data. The second is a deactivate/reactivate toggle icon button — if the user is active it shows a deactivation icon and triggers the deactivation confirmation dialog; if the user is deactivated it shows a reactivation icon and directly calls the reactivation API. Conditionally render action buttons: an ADMIN should not see action buttons for ADMIN or SUPERADMIN rows — they can only act on STAFF rows and their own row. No user should see a deactivate button on their own currently active session.

### Step 7 — Create User Modal

Create a Client Component wrapping a shadcn/ui Dialog. The trigger is the "Create User" button from the page heading row. Inside the dialog, render a form with fields for: Name (text input), Email (email input), Password (password input), Confirm Password (password input), and Role (a Select dropdown). The role dropdown options are populated based on the current user's role: if the current user is ADMIN, only the STAFF option is available; if SUPERADMIN, both STAFF and ADMIN options are available. The SUPERADMIN option is never included.

Use a client-side validation pass before submission: all fields required, email must pass a basic format check, password minimum eight characters, confirm password must match password. Display validation errors inline beneath the relevant field using a small error text element. On valid submission, call `POST /api/users` with a fetch request, display a loading indicator on the submit button, and on success: close the dialog, clear the form, show a success toast notification, and trigger a page refresh using `router.refresh()` from Next.js so the server component re-fetches the updated user list.

### Step 8 — Edit User Modal

Create a Client Component similar in structure to the Create User modal. It receives the selected User's data as a prop and opens a pre-populated form with Name, Email, and Role. Omit the password fields — password changes are not supported in the edit flow (a separate password reset mechanism is out of scope for Phase 2). Apply the same role dropdown population logic as the Create modal. Additionally, if the current user is editing their own account, disable the Role dropdown entirely regardless of their role, preventing self-elevation. Submit a `PATCH /api/users/[id]` request with only the changed fields. On success, close the dialog, show a success toast, and call `router.refresh()`.

### Step 9 — Deactivate/Reactivate Flow

For deactivation, use a shadcn/ui AlertDialog component. When the deactivate icon button is clicked, open the AlertDialog with the destructive message "Deactivate [user's name]? This will prevent them from logging in." Provide a Cancel button and a "Deactivate" button styled as a destructive action. On confirmation, issue `PATCH /api/users/[id]` with `{ isActive: false }`. On success, show a brief success toast and call `router.refresh()` to re-render the table with the updated status badge and toggled action button.

For reactivation, skip the AlertDialog and issue the `PATCH /api/users/[id]` with `{ isActive: true }` directly on button click. On success, show a brief success toast and call `router.refresh()`. The strategy of using `router.refresh()` rather than optimistic UI updates is recommended here so that the table always reflects the ground-truth server state without maintaining complex local state.

### Step 10 — Updated authorize Callback in lib/auth.ts

Locate the `authorize` callback within the credentials provider in `lib/auth.ts`. After successfully verifying the password hash, fetch the full user record including `isActive`. If `user.isActive` is strictly false (not undefined, not null — to preserve backward compatibility for documents created before the schema change), throw a `new Error("AccountDeactivated")`. Do not return null in this case — throwing allows NextAuth to route the specific error string through the callback URL query parameter.

On the login page, read the `error` search parameter from the URL. If the value is `"AccountDeactivated"`, display the message "Your account has been deactivated. Contact your administrator." in the error alert area above the login form. Ensure that the generic "Invalid credentials" message is shown for all other error values, and that no error message is shown when the error parameter is absent.

### Step 11 — GET /api/settings Route

Create the route handler at `app/api/settings/route.ts`. All authenticated roles may call this endpoint — authenticate the session and return 401 if unauthenticated, but do not enforce a specific role. Query SystemConfig for the following keys: `school_name`, `academic_year`, `elective_label_I`, `elective_label_II`, `elective_label_III`. Use a `findMany` call with a `where` clause matching these keys. Build the response object by matching returned documents to their keys. For any key not found in the database, apply the following fallbacks: `school_name` defaults to `"SchoolMS"`, `academic_year` defaults to the current calendar year as a string, `elective_label_I` defaults to `"Category I"`, `elective_label_II` defaults to `"Category II"`, `elective_label_III` defaults to `"Category III"`. Return the key-value map as a flat JSON object.

### Step 12 — PATCH /api/settings Route

Create the PATCH handler in the same `app/api/settings/route.ts` file. Authenticate and confirm the requester is ADMIN or SUPERADMIN. Parse the request body — accept any subset of the five known keys with string values. For each key present in the body, perform a Prisma `upsert` on SystemConfig: match on the `key` field, update the `value` field if a document exists, or create a new document if not. This ensures that the PATCH is safely atomic per key even if the keys were never previously set. After all upserts are complete, write a `SETTINGS_UPDATED` audit log entry with a `details` object listing the keys that were updated and their new values. Return 200 with the final state of all five keys (using the same fallback logic as the GET handler to fill in any keys not present in the body).

### Step 13 — POST /api/settings/seed-classes Route

Create the route handler at `app/api/settings/seed-classes/route.ts`. Authenticate and confirm the requester is ADMIN or SUPERADMIN. Import and call the `lib/seed-class-groups.ts` utility function. This utility was written in Phase 2 Task 2 and handles the creation of standard class group documents for Grades 6 through 11, with Sections A through F per grade — 36 class groups total. It is expected to be idempotent or to skip creation for already-existing groups. The route returns a JSON response of the shape `{ seeded: number }` where `number` is the count of new documents created by the utility. No audit log is required for this operation, but a log entry for `SETTINGS_UPDATED` may optionally be written to record the seeding event.

### Step 14 — Settings Page Architecture

Create the page at `app/dashboard/settings/page.tsx` as a Server Component. Authenticate the session and confirm the user has ADMIN or SUPERADMIN role. At render time, perform two parallel data fetches: a Prisma query for the five SystemConfig keys (to pre-populate the settings forms), and a Prisma count query on ClassGroup documents (to determine whether the Seed button should be shown). Pass both results as props into the page layout.

Structure the page as a vertically stacked set of four shadcn/ui Card components, each representing one settings section. Each card has its own heading, its own form fields, and its own Save button. Each section submits independently — changes to school name do not require re-submitting elective labels. Use a consistent visual pattern across sections: label above input, helper text below input where relevant, Save button aligned to the bottom-right of the card.

### Step 15 — School Name, Academic Year, and Elective Labels Forms

Each of the first three settings sections follows the same implementation pattern and should be implemented as reusable Client Component forms:

The **School Name** section contains a single text input. A helper text line reads "Displayed on the login page and in generated PDF reports." The Save button submits `PATCH /api/settings` with `{ school_name: value }`. On success, show an inline success message or toast. The placeholder slot for a logo upload should be rendered as a static UI card element with placeholder text "Logo upload — coming in a future version" and no interactive functionality.

The **Academic Year** section contains a single numeric or text input. A helper text warning reads "Changing the academic year affects mark entry defaults but does not alter any existing records." The Save button submits `PATCH /api/settings` with `{ academic_year: value }`.

The **Elective Category Labels** section contains three text inputs arranged vertically or in a two-column grid, labelled "Category I Label", "Category II Label", and "Category III Label". A single Save button submits `PATCH /api/settings` with all three label values at once.

All three form sections should be pre-populated with the values fetched during the server render from SystemConfig (or their fallback values), passed down as initial values.

### Step 16 — Class Groups Section

The Class Groups card contains a description: "Standard class groups cover Grades 6–11 with sections A through F (36 groups total)." Below the description, show the current class group count fetched at page render time, formatted as "X of 36 class groups are currently configured."

The "Seed Standard Class Groups" button is conditionally rendered: it is only shown if the current count is fewer than 36. If the count is already 36 or more, replace the button with a static "All class groups are configured." success indicator and do not render the seed button.

When the seed button is clicked, open a shadcn/ui AlertDialog asking "Seed standard class groups? This will create the missing class groups for Grades 6–11 (Sections A–F). Existing groups will not be duplicated." On confirmation, call `POST /api/settings/seed-classes`, show a loading indicator, and on success display a toast with the message "X class groups seeded." and call `router.refresh()` to update the count display.

### Step 17 — lib/audit-actions.ts Constants File

Create the file `lib/audit-actions.ts`. This file exports named string constants for every audit action type used across Phase 2. Centralising these constants prevents typos, enables IDE autocomplete, and makes it straightforward to audit which actions are handled across the codebase. The file defines and exports the following constants: `STUDENT_CREATED`, `STUDENT_UPDATED`, `STUDENT_DELETED` (backfill references from Tasks 2 and 3 to import from this file), `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_REACTIVATED`, `USER_DELETED`, and `SETTINGS_UPDATED`. Each constant's value is the same string as its name in `SCREAMING_SNAKE_CASE`. All API routes introduced in Phase 2 must import their required action constant from this file.

---

## Audit Log Write Pattern

Every API route in Phase 2 that performs a state-changing operation must write an audit log record using the following standard call structure. The Prisma AuditLog model was created in Phase 2 Task 1. The `userId` and `userDisplayName` values come from the authenticated session. The `ipAddress` is extracted from the `x-forwarded-for` request header, falling back to the string `"unknown"` if the header is absent. The `details` field is stored as a serialised JSON string — pass a plain object and call `JSON.stringify` on it before writing. The `targetId` and `targetType` fields are optional and should be populated when the audit action relates to a specific document (e.g., the new user's id and the string `"USER"` for a `USER_CREATED` action). The `timestamp` field is always set to `new Date()` at the moment of the write.

All routes should perform the audit write after the primary database operation has succeeded. If the audit write fails, it should be logged to the server console but should not cause the primary operation's API response to return an error — the audit log is non-critical infrastructure.

---

## Security Requirements

- The `passwordHash` field must never appear in any API response. Every Prisma query in `/api/users` routes must use an explicit `select` clause that omits this field. Never use `select: { ...user, passwordHash: false }` syntax — always list fields positively.
- The role elevation guard must be enforced in the API layer, not only the UI. Even if the UI restricts the role dropdown, the server must independently check the calling user's permissions before assigning any role.
- The SUPERADMIN account must be treated as immutable from within the application: its role cannot be changed, it cannot be deactivated, and it cannot be deleted via any of the user management API routes.
- The `SUPERADMIN` role value must never appear as a valid option in the `POST /api/users` Zod schema's role enum. Its absence from validation is the first line of defence.
- Password validation (minimum length, confirmation match) must be enforced both client-side (for UX) and within the Zod schema in the POST handler (for security). A request that bypasses the client form must still be rejected by the server if the password is too short.

---

## TypeScript Considerations

After running `prisma db push` with the `isActive` field added, regenerate the Prisma client. The `User` type exported by `@prisma/client` will include `isActive: boolean`. TypeScript will flag any code that accesses `user.isActive` before the client is regenerated — ensure the push and generation happen before writing or testing the authorize callback code.

The session user object in NextAuth carries only the fields explicitly mapped in the `jwt` and `session` callbacks in `lib/auth.ts`. The `isActive` field does not need to be added to the session token for Phase 2's purposes — the authorize callback reads it directly from the database on each login attempt, and the JWT invalidation mechanism already handles active-session termination without storing `isActive` in the token.

When the `PATCH /api/users/[id]` handler builds its Prisma update payload, construct it dynamically by only including fields that are present in the request body. Avoid spreading the entire body into the update call — this prevents unintended field overrides and keeps the update auditable.

---

## File Inventory

The following files are created or modified in this task:

- `prisma/schema.prisma` — Modified: `isActive Boolean @default(true)` added to the User model
- `lib/auth.ts` — Modified: authorize callback updated to check `isActive` and throw `AccountDeactivated` error
- `lib/audit-actions.ts` — Created: all Phase 2 audit action string constants
- `app/api/users/route.ts` — Created: GET and POST handlers
- `app/api/users/[id]/route.ts` — Created: PATCH and DELETE handlers
- `app/api/settings/route.ts` — Created: GET and PATCH handlers
- `app/api/settings/seed-classes/route.ts` — Created: POST handler
- `app/dashboard/settings/users/page.tsx` — Created: Server Component page with Prisma data fetch
- `app/dashboard/settings/users/UserTable.tsx` — Created: Client Component table with action buttons
- `app/dashboard/settings/users/CreateUserModal.tsx` — Created: Create user dialog form
- `app/dashboard/settings/users/EditUserModal.tsx` — Created: Edit user dialog form
- `app/dashboard/settings/page.tsx` — Created: Server Component settings page with four sections
- `app/dashboard/settings/SchoolNameForm.tsx` — Created: School name settings section form
- `app/dashboard/settings/AcademicYearForm.tsx` — Created: Academic year settings section form
- `app/dashboard/settings/ElectiveLabelsForm.tsx` — Created: Elective labels settings section form
- `app/dashboard/settings/ClassGroupsSection.tsx` — Created: Seed class groups section with conditional button

Additionally, the route files for `POST /api/students` and `PATCH /api/students/[id]` from Tasks 2 and 3 should be updated to import their audit action constants from `lib/audit-actions.ts` rather than using inline strings.

---

## Integration Points

The following Phase 3 functionality depends on work completed in this task:

- **Mark Entry subject selector (Phase 3)** depends on the `GET /api/settings` route returning the three elective category label values. The mark entry form uses these labels to name the elective subject columns in the marks entry table.
- **PDF report generation (Phase 3)** depends on the `school_name` SystemConfig value for the report header.
- **Analytics filters and default year (Phase 3)** depend on the `academic_year` SystemConfig value as the pre-selected default in year dropdowns.
- **Class group selectors across Phase 3** depend on the presence of class group documents seeded via the Settings page. If Phase 3 is started before class groups have been seeded, mark entry and student assignment flows will have no class groups to display.

---

## Common Pitfalls

**Forgetting to check isActive in the authorize callback.** This is the most critical item in the task. If the authorize callback is not updated, deactivated accounts can still log in. Note that simply setting `isActive: false` in the database without the callback change provides no access restriction.

**Treating undefined isActive as deactivated.** Existing User documents in MongoDB created before this schema change will not have the `isActive` field set — Prisma will return `null` or omit the field depending on the driver version. The callback check must treat `isActive !== false` as active, not `isActive === true`. This avoids locking out all existing accounts after the schema migration.

**Role elevation by ADMIN.** The UI restricts the role dropdown, but the server must independently verify that an ADMIN cannot submit a `role: "ADMIN"` value to `POST /api/users` or `PATCH /api/users/[id]`. Never trust the frontend to enforce security invariants.

**SystemConfig upsert atomicity per key.** The `PATCH /api/settings` route loops through submitted keys and calls upsert once per key. If five keys are submitted, five separate database operations occur. For Phase 2's expected load this is acceptable, but the route should not attempt to wrap all five upserts in a Prisma transaction unless atomicity across keys is explicitly required — MongoDB Atlas transactions introduce additional complexity.

**Settings page caching stale SystemConfig values.** Because the Settings page is a Server Component and Next.js 14 caches `fetch` calls, direct Prisma queries inside Server Components bypass the fetch cache. However, `router.refresh()` from a client form submission will cause Next.js to re-render the Server Component and re-run the Prisma queries, giving fresh values. Ensure the settings forms call `router.refresh()` on successful saves so that the page reflects the latest database state.

**authorize callback throwing vs returning null.** Returning null from the authorize callback triggers a generic "CredentialsSignin" error in NextAuth. Throwing a typed Error allows the specific error message string to be surfaced in the callback URL and read by the login page. Both approaches prevent login, but only the throw approach allows the login page to display the specific "account deactivated" message. Do not return null for the deactivated case.

**PATCH /api/users/[id] not setting sessionInvalidatedAt on deactivation.** Without this write, existing active sessions for the deactivated user will remain valid until the JWT's natural expiry. Always combine `isActive: false` with `sessionInvalidatedAt: new Date()` in the same Prisma update call.

---

## Phase 2 Completion

This document describes the final task in Phase 2. Upon completion of all four tasks, Phase 2 delivers a fully operational student and user management system. The following capabilities are available and tested:

- **Phase 2, Task 1** — Dashboard layout shell with sidebar navigation, topbar, role-conditional menu items, and dark mode toggle. The AuditLog model is available.
- **Phase 2, Task 2** — Student list page with search, filter, and pagination; student profile view with full record display; and student hard delete with confirmation.
- **Phase 2, Task 3** — Add Student form with full Zod validation and class group assignment; Edit Student form pre-populated from existing record; both backed by `POST /api/students` and `PATCH /api/students/[id]` with audit logging.
- **Phase 2, Task 4 (this task)** — User account management for ADMIN and SUPERADMIN; account creation, editing, deactivation, and reactivation; account deactivation reflected immediately in NextAuth session invalidation; school-level settings persistence via SystemConfig; class group seeding utility wired to the settings UI; centralised audit log constants across all Phase 2 operations.

**What Phase 3 can rely on from Phase 2:**

Phase 3 (Marks Entry and Progress Reports) may assume the following are stable and tested: all student records include the full data shape defined in the Student Prisma model; class groups are seeded and available for query; the `GET /api/settings` endpoint returns reliable elective label and school name values; the authenticated session includes `user.id`, `user.name`, `user.role`, and `user.email`; the AuditLog table is available for write operations; and all Phase 1 authentication and middleware guards are active and protecting all app routes.

Phase 3 should not require any modifications to the User model, the settings API, or the student APIs from Phase 2 under normal implementation conditions.
