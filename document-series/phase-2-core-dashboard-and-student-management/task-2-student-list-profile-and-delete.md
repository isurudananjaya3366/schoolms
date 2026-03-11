# Phase 2 / Task 2 — Student List, Profile, and Soft-Delete

**Phase:** 2 — Core Dashboard and Student Management
**Task:** 2 of Phase 2
**Title:** Student List, Profile, and Soft-Delete
**Estimated Complexity:** Medium-High

---

## Task Summary

This task builds the two primary student-facing pages of the SchoolMS dashboard — the Student List page at `/dashboard/students` and the Student Profile page at `/dashboard/students/[id]` — along with three supporting API routes. The Student List page offers server-rendered tabular data with URL-driven filter state, sortable columns, client-side bulk selection, and CSV export. The Student Profile page renders a detailed view of a single student including a formatted marks table with W-rule application, an auto-generated W-note block, and placeholder zones for features arriving in Phase 3 and Phase 4. A soft-delete confirmation dialog is implemented on both pages. All three API routes — GET students list, GET single student, and DELETE student — are created under the `/api/students` path with proper role enforcement, Zod validation, and audit logging on deletion.

This task produces the primary data surface that subsequent tasks in Phase 2 (Student Create/Edit form) and Phase 3 (marks entry) will build upon. Getting the architecture of URL state management, server/client boundary splits, and the marks table rendering correct here avoids expensive refactoring later.

---

## Prerequisites

The following must be complete and verified before starting this task:

- **Phase 2 / Task 1** is fully complete: the dashboard layout shell, sidebar navigation, top bar, and role-aware navigation items are rendering correctly. The `/dashboard` route group exists with its layout.
- **Prisma schema** from Phase 1 / Task 2 is in place. The `Student`, `ClassGroup`, and `MarkRecord` models are defined and have been pushed to MongoDB Atlas. The `Student` model includes the `isDeleted` boolean field (default `false`) and the `electives` embedded object with `categoryI`, `categoryII`, and `categoryIII` string fields.
- **W-rule utilities** from Phase 1 / Task 2 exist at `src/lib/w-rule.ts`. This file exports `applyWRule(mark: number | null): string | number` and `getWSubjects(markRecord: MarkRecord, electives: StudentElectives): string[]`. These functions are already tested and must not be re-implemented here.
- **Auth guard** from Phase 1 / Task 4 exists at `src/lib/auth-guard.ts` and exports `requireAuth(roles?: Role[])`. This is used to enforce authentication and role restrictions at the API route level.
- **Audit log utility** from Phase 1 / Task 2 or Task 4 is available to write structured audit log entries to the `AuditLog` collection via Prisma.
- **shadcn/ui** component library is installed and configured. The `AlertDialog`, `Button`, `Badge`, `Table`, `Input`, `Select`, and `Tooltip` components are available or can be added via the shadcn CLI.
- **NextAuth.js v5** session is accessible via the `auth()` helper from `src/auth.ts`, and the session object includes the user's `role`, `id`, and `name` fields.

---

## Task Scope

### In Scope

- `GET /api/students` route with Zod-validated query parameters, Prisma where-clause construction, parallel data and count queries, and paginated response.
- `GET /api/students/[id]` route fetching a single student with `classGroup` and `markRecords` relations, with 404 handling for missing or soft-deleted students.
- `DELETE /api/students/[id]` route performing a soft-delete update, writing an audit log entry, and returning a confirmation response.
- Student List page at `/dashboard/students` as a Next.js App Router Server Component reading `searchParams` and passing them to child rendering components.
- URL-based filter state management using `useSearchParams` and `useRouter` in client filter components.
- Filter bar with Grade dropdown, Class Section dropdown, and Search text input.
- Student table with sortable columns, role-conditional Edit and Delete action buttons, and row rendering from server-fetched data.
- Bulk checkbox selection per row, Select All for current page, contextual action bar, and client-side CSV export from in-memory data.
- Pagination control component reading current page and total pages, rendering Previous/Next controls and a "Showing X–Y of Z" label.
- Soft-delete `AlertDialog` component usable from both the list and profile pages.
- Student Profile page at `/dashboard/students/[id]` as a Server Component fetching the student by ID with all relations.
- Profile header component displaying name, index number, grade, class section, and elective badges, with role-conditional Edit and Delete controls.
- Marks table component with terms as rows, subjects as columns, `applyWRule()` applied to each cell, and distinctive W styling.
- W-note block component using `getWSubjects()` across all term records and displaying an auto-generated sentence listing subjects with W marks.
- Placeholder card for the performance chart and disabled/tooltipped Generate PDF and Preview Mode buttons.

### Out of Scope

- Student Create and Edit forms (Phase 2 / Task 3).
- Marks entry interface (Phase 3).
- Functional PDF report generation (Phase 3).
- Functional performance bar chart (Phase 4).
- Preview mode (Phase 4).
- Bulk deletion (not in scope for any phase).
- Advanced search operators or full-text search indexing beyond Prisma's case-insensitive `contains` filter.

---

## Acceptance Criteria

1. Navigating to `/dashboard/students` renders a paginated list of non-deleted students. If no students exist, an empty-state message is displayed rather than an empty table.
2. The Grade and Class Section filter dropdowns update the URL query string on change and cause the server component to re-render with filtered results without a full page reload.
3. The Search input updates the URL's `search` param on input (debounced or on submit) and filters the table by student name or index number, case-insensitively.
4. Clicking a column header for a sortable column (Index No., Full Name, Grade, Class Section) toggles between ascending and descending order via URL params.
5. Pagination controls correctly show the current page position, disable the Previous button on page 1, disable the Next button on the last page, and navigate via URL param updates.
6. The View button in the Actions column is visible to all authenticated roles and links to the student's profile page.
7. The Edit and Delete buttons in the Actions column are rendered only for users with the ADMIN or SUPERADMIN role. Users with other roles do not see these buttons.
8. Selecting individual row checkboxes and the Select All checkbox correctly manages the selection state. The contextual action bar appears when at least one row is selected.
9. Clicking CSV Export in the action bar downloads a correctly formatted CSV file containing name, index number, grade, class section, and electives for the selected students.
10. Clicking the Delete button on a row opens the `AlertDialog` with the prescribed confirmation message. Clicking Cancel closes the dialog without any change. Confirming sends a DELETE request to `/api/students/[id]` and removes the row from the list on success.
11. Navigating to `/dashboard/students/[id]` for a valid, non-deleted student renders the profile page with the correct header, marks table, and W-note block.
12. Navigating to `/dashboard/students/[id]` for a non-existent student ID or a student with `isDeleted=true` invokes Next.js's `notFound()`, rendering the 404 page.
13. The marks table headers for the three elective columns display the labels from the student's own `electives.categoryI`, `categoryII`, and `categoryIII` fields, not from any global configuration.
14. Each cell in the marks table displays the W-rule result: `null` marks display as an em dash, marks below 35 display as "W" with red styling, and marks 35 and above display the numeric value.
15. The W-note block below the marks table accurately lists every subject that has at least one W mark across all three terms, or displays a "No W marks recorded" message if none exist.
16. The Generate PDF Report and Preview Mode buttons on the profile page are rendered in a disabled, visually greyed state. Hovering them shows a `Tooltip` with the appropriate phase-availability message.
17. `DELETE /api/students/[id]` returns 403 if called by a user with a role below ADMIN. It returns 404 if the student does not exist. It returns 200 with the expected payload on success and writes an audit log entry.

---

## Implementation Steps

### Step 1: GET /api/students Route

Create the route file at `src/app/api/students/route.ts`. This route handles only the GET method; other methods should return 405.

Begin by defining a Zod schema for the incoming query parameters. The schema uses `z.coerce.number()` for `page` (default 1), `limit` (default 20, maximum 100), and `grade` (optional, valid range 6 through 11 inclusive). The `classSection` and `search` fields are optional strings. The `sort` field defaults to `"name"` and should be validated against an allowlist of sortable field names to prevent arbitrary Prisma field injection. The `order` field is an enum accepting only `"asc"` or `"desc"` with a default of `"asc"`.

Extract query parameters from the incoming `Request` object's URL using the `URL` API and `searchParams`. Pass the resulting plain object through the Zod schema's `safeParse`. If parsing fails, return a 400 response with the Zod error issues.

Construct the Prisma `where` clause object incrementally. Always include `isDeleted: false`. If `grade` is present in the validated params, add it as an exact match. If `classSection` is present, add a nested filter on the related `classGroup` using `classGroup: { section: classSection }`. If `search` is present, add an `OR` array containing a case-insensitive `contains` filter on `name` and another on `indexNumber`. On MongoDB, Prisma supports case-insensitive search via the `mode: "insensitive"` option inside string filter objects.

Run two Prisma queries in parallel using `Promise.all`: one `prisma.student.findMany` with `where`, `include: { classGroup: true }`, `orderBy` constructed from the `sort` and `order` params, `skip: (page - 1) * limit`, and `take: limit`; and one `prisma.student.count` with the same `where` clause. This parallel execution avoids sequential round-trips to the database.

Compute `totalPages` as `Math.ceil(totalCount / limit)`. Return a 200 JSON response with shape `{ data, pagination: { totalCount, totalPages, currentPage: page, limit } }`.

Wrap the entire handler in a try-catch. If Prisma throws, log the error server-side and return 500 with a generic error message. Never expose Prisma error details to the client.

### Step 2: GET /api/students/[id] Route

Create the route file at `src/app/api/students/[id]/route.ts`. This handles GET and DELETE; implement GET here and DELETE in Step 3.

Extract the `id` path parameter from the second argument (`context.params.id`). Validate that it is a non-empty string; return 400 if not. Use `prisma.student.findUnique` with `where: { id }` and `include: { classGroup: true, markRecords: true }`.

If the result is `null` or if `student.isDeleted === true`, return a 404 JSON response with `{ error: "Student not found" }`. Do not distinguish between "never existed" and "soft-deleted" in the response — both cases should present as a unified not-found.

If the student is found, return 200 with the full student object including nested `classGroup` and the `markRecords` array. Do not apply the W-rule at this level — that transformation is the responsibility of the UI layer. Send raw numeric mark values exactly as stored in the database.

Authentication: this route requires any authenticated session. Call `requireAuth()` (with no role restriction argument) at the top of the handler before fetching from Prisma. If the session is missing, `requireAuth` returns a 401 response that should be returned immediately.

### Step 3: DELETE /api/students/[id] Route

This handler lives in the same `src/app/api/students/[id]/route.ts` file as the GET handler, exported as a separate `DELETE` function.

Call `requireAuth(["ADMIN", "SUPERADMIN"])` at the top. If the role check fails, return the resulting 403 response immediately.

Fetch the student with `prisma.student.findUnique` using `where: { id }` and selecting only the fields needed for the audit log: `id`, `name`, `indexNumber`, and `isDeleted`. If the student is not found or is already soft-deleted, return 404.

Perform the soft-delete via `prisma.student.update` with `where: { id }` and `data: { isDeleted: true }`. This preserves all related `MarkRecord` entries in the database.

After the update, write an audit log entry. The entry must include: the acting user's `id` and display name from the session (extracted via `auth()`), `action: "STUDENT_DELETED"`, `targetId: student.id`, `targetType: "STUDENT"`, and a `details` object containing `studentName: student.name` and `indexNumber: student.indexNumber`.

Return 200 with `{ success: true, message: "Student removed successfully" }`.

### Step 4: Student List Page Architecture

The page file at `src/app/(dashboard)/students/page.tsx` is a Server Component. Next.js App Router passes URL search parameters to page components as the `searchParams` prop — a plain object of string-keyed string values. Read all filter params from this prop: `grade`, `classSection`, `search`, `page`, `sort`, and `order`.

Parse and coerce these values into their typed forms at the page level using simple coercion (not Zod — Zod is used at the API level). Provide sensible defaults: page defaults to 1, sort defaults to `"name"`, order defaults to `"asc"`.

Fetch the student list from the database directly here, not by calling the `/api/students` route from the server side. Server Components have direct access to Prisma, so calling the API route from the server would introduce an unnecessary HTTP round-trip. Replicate the where-clause logic from the API route here in the page's data-fetching section.

Render the `FilterBar` client component, the `StudentTable` client component (passing the fetched data as props), and the `PaginationControl` component. The top-level fetch and layout remain in the Server Component; interactive behaviors (filter changes, checkbox state) live in the client child components. This boundary — data fetching and initial HTML at the server, interactivity at the client — is the core architectural principle for this page.

### Step 5: URL-Based Filter State

Filters on the Student List page are driven by the URL query string. This approach is preferred over React local state because it makes the filtered view shareable via URL, survives browser refresh, and integrates naturally with Next.js App Router's server rendering on navigation.

Filter bar inputs are Client Components that import `useSearchParams` from `next/navigation` to read the current URL param values (populating the inputs with their current values on render) and `useRouter` from `next/navigation` to push new URLs when values change.

When a filter changes, construct a new `URLSearchParams` object from the current params, update the relevant key, reset `page` to `"1"` (because a filter change invalidates the current page position), and call `router.push` with the new URL string. Use `router.replace` for search input changes to avoid polluting the browser history with every keystroke.

The search input should apply a debounce of approximately 400 milliseconds before pushing the URL update, preventing excessive navigations while the user is still typing. This debounce can be implemented with a `useEffect` that depends on the raw input value and clears/sets a `setTimeout`.

A "Clear Filters" button should be visible whenever any filter param is set. Clicking it pushes to the bare `/dashboard/students` path with no query string, resetting all filters.

### Step 6: Filter Bar Component

Create `src/components/students/StudentFilterBar.tsx` as a Client Component. It renders as a horizontal toolbar above the table, containing three controls and a clear-filters trigger.

The **Grade dropdown** uses a shadcn/ui `Select` component. Its options are the string values "All Grades" (mapping to no grade param) and the numbers 6 through 11. The selected value reflects the current `grade` URL param. On change, it updates the URL as described in Step 5.

The **Class Section dropdown** uses a shadcn/ui `Select` component. Its options are "All Sections" (no param) and the letters A through F. The selected value reflects the current `classSection` URL param. On change, it updates the URL.

The **Search input** uses a shadcn/ui `Input` component of type text with a placeholder like "Search by name or index…". Its displayed value is controlled by local state initialized from the `search` URL param, but URL updates are debounced. On clearing the input, the search param is removed from the URL.

The filter bar should be visually consistent with the dashboard's design language — a flat, borderless toolbar with modest spacing. If any of the three filters has a non-default value, the "Clear Filters" button becomes active and visible.

### Step 7: Student Table Component

Create `src/components/students/StudentTable.tsx` as a Client Component receiving the student data array and the current sort/order values as props.

Define the column headers as an ordered array of objects, each containing a label, an optional `sortKey` field name, and the current sort state. Render the table using a standard HTML table wrapped in a shadcn/ui scroll container to handle overflow on narrow screens.

For sortable column headers, render a clickable element that, on click, reads the current `sort` and `order` URL params and updates them: if clicking a column already active as the sort key, toggle `order` between `"asc"` and `"desc"`; if clicking a new column, set it as `sort` and default `order` to `"asc"`. Display a directional chevron icon next to the active column header to communicate the current sort direction.

For each row, render the student's index number, full name, grade, class section (from `student.classGroup.section`), and an electives summary. The electives summary can be rendered as a compact comma-separated list or small pill badges of the three category labels from `student.electives`.

The Actions cell contains up to three buttons: View (always rendered, links to `/dashboard/students/[student.id]`), Edit (rendered only for ADMIN/SUPERADMIN, links to `/dashboard/students/[student.id]/edit`), and Delete (rendered only for ADMIN/SUPERADMIN, invokes the delete dialog). To determine the current user's role within this client component, the role should be passed down as a prop from the parent Server Component, which reads it from the session. Do not call `useSession` deep in table components — pass role as a single prop from the page level.

Define the delete dialog state as a single `{ open: boolean; studentId: string | null; studentName: string | null }` object at the top of the `StudentTable` component. Opening the dialog for a row sets the student ID and name into this state. On confirmation, the delete API call is made and on success the row is removed from the local copy of the student array (or a refetch is triggered).

### Step 8: Bulk Select and CSV Export

Manage checkbox selection state inside `StudentTable` as a `Set<string>` of selected student IDs stored in a `useState` hook.

Each data row has a checkbox in its leftmost cell. The checkbox's checked state is derived from whether the student's ID is in the selection set. Clicking it toggles inclusion in the set.

The table header row has a "Select All" checkbox. Its checked state is `true` when the selection set contains all student IDs from the current page's data. Its indeterminate state is `true` when some but not all are selected. Clicking it when any are selected deselects all; clicking it when none are selected selects all.

When the selection set is non-empty, render a contextual action bar — a thin band above the table — showing "X student(s) selected" and the CSV Export button. This bar can be positioned absolutely over the top of the table or inline above it.

The **CSV Export** function is a pure client-side operation. It operates on the already-fetched data array (the prop passed to the table) — it does not make any API calls. Filter the data array to only rows whose IDs are in the selection set. Construct a CSV string with a header row and one data row per selected student, containing columns: Full Name, Index Number, Grade, Class Section, Elective I, Elective II, Elective III. Create a `Blob` with MIME type `text/csv`, generate an object URL, programmatically click a temporary anchor element with the `download` attribute set to a filename like `students-export.csv`, then revoke the object URL. This pattern works reliably across modern browsers without a server round-trip.

### Step 9: Pagination Control Component

Create `src/components/students/PaginationControl.tsx` as a Client Component receiving `currentPage`, `totalPages`, and `totalCount` as props.

Render the "Showing X–Y of Z" label where X is `(currentPage - 1) * limit + 1`, Y is `Math.min(currentPage * limit, totalCount)`, and Z is `totalCount`. If `totalCount` is zero, show "No results found" instead of the pagination row.

The Previous button uses `useRouter` to push the URL with `page` decremented by 1. It is rendered in a disabled state (non-clickable, visually muted) when `currentPage === 1`.

The Next button pushes `page` incremented by 1 and is disabled when `currentPage === totalPages` or `totalPages === 0`.

Optionally, for page counts of 7 or fewer total pages, render individual numbered page buttons. For larger counts, show only Previous and Next to avoid a cluttered pagination row. This threshold keeps the component simple for the typical data volume of a single school.

### Step 10: Soft-Delete Dialog

Create `src/components/students/DeleteStudentDialog.tsx` as a Client Component wrapping the shadcn/ui `AlertDialog` primitive.

The component receives props: `open` (boolean), `studentName` (string), `studentId` (string), `onClose` (callback invoked on Cancel and after completion), and `onSuccess` (callback invoked when the delete completes successfully).

Inside the dialog, render the `AlertDialogTitle` as "Remove Student" and `AlertDialogDescription` as the prescribed text: "Are you sure you want to remove this student? Their records will be preserved but the student will no longer appear in lists."

The footer contains two buttons: a Cancel button that calls `onClose` and a destructive-styled Continue button. The Continue button, on click, sets a local `isLoading` state to `true`, performs a fetch DELETE request to `/api/students/[studentId]`, then on a 200 response calls `onSuccess()` and `onClose()`. On a non-200 response, display an inline error message within the dialog (do not close). Whether success or failure, reset `isLoading` to `false`.

During the in-flight request, the Continue button should show a loading state (spinner or "Removing…" text) and be non-interactive. The Cancel button should also be disabled during loading to prevent the dialog from being dismissed mid-request.

This component is reused on both the Student List page (where `onSuccess` removes the row) and the Student Profile page (where `onSuccess` triggers a `router.push` to `/dashboard/students`).

### Step 11: Student Profile Page Architecture

Create the page file at `src/app/(dashboard)/students/[id]/page.tsx` as a Server Component. Its only parameter is `params.id`, the dynamic segment.

Call `prisma.student.findUnique` with `where: { id: params.id }` and `include: { classGroup: true, markRecords: true }`. If the result is `null` or `student.isDeleted === true`, call `notFound()` from `next/navigation` immediately. This triggers Next.js's built-in 404 rendering.

Read the current user's session via `auth()` and extract the `role` field to pass to child components that render conditional buttons.

Pass the student object, the role, and any other needed values to the sub-components described in Steps 12 through 15. This page file itself renders only the structural layout (a vertical stack of sections), delegating all visual content to the sub-components.

Do not use `try-catch` on the Prisma call here — allow unexpected database errors to surface as 500 errors, which Next.js will handle via its error boundary if one is configured, or as a generic error page. The only intentional error handling is the `notFound()` call for missing students.

### Step 12: Profile Header Component

Create `src/components/students/ProfileHeader.tsx` as a Client Component so it can manage the delete dialog's open state.

Render a large, prominent heading for the student's full name at the top. Below the name, display the following labelled values in a compact horizontal grid: "Index No." with the `indexNumber` value, "Grade" with the numeric grade, and "Class Section" with the class group's `section` value from the nested `classGroup` object.

Below the labelled values, render the three elective subjects as shadcn/ui `Badge` components using an outline or secondary variant. The badge labels come from `student.electives.categoryI`, `categoryII`, and `categoryIII`. Since these are stored strings, no lookup or resolution is needed.

In the top-right of the header section, render two buttons conditionally for ADMIN and SUPERADMIN roles: an Edit Profile button linking to `/dashboard/students/[id]/edit` and a Delete button that opens the `DeleteStudentDialog` described in Step 10. The `onSuccess` callback for the delete dialog from this page should call `router.push("/dashboard/students")` to navigate back to the list after successful deletion.

### Step 13: Marks Table Component

Create `src/components/students/MarksTable.tsx` as a Server Component (it performs no client interaction — it only renders data). It receives the student's `markRecords` array and the student's `electives` object as props.

The table has a fixed column structure. The first column header is "Term". The subsequent column headers are the fixed subjects in order: Sinhala, Buddhism, Maths, Science, English, History. The final three column headers are the student's elective labels: `electives.categoryI`, `electives.categoryII`, `electives.categoryIII`. This means all marks table headers at the right side are per-student, not global.

The table has three rows, one for each term: Term I, Term II, and Term III. For each row, find the `MarkRecord` where `term === "TERM_1"` (or equivalent enum value) from the `markRecords` array. If no `MarkRecord` exists for a given term, render the entire row as em dashes.

For each cell in a row, pass the corresponding subject's mark value from the `MarkRecord` to `applyWRule()`. The return value is either an em dash string (for null), the string "W" (for marks below 35), or the numeric mark value. Render the cell content according to this return value.

Apply a distinctive visual style to cells that display "W": a red text color and optionally a light red background tint. This makes W-marks immediately scannable at a glance. Non-W numeric cells and em-dash cells use the default cell styling.

The marks table should display even if `markRecords` is empty — in that case, all cells across all three rows display em dashes. Include a small note below the table when `markRecords.length === 0` stating that no marks have been recorded yet for this student.

Handle the case where `student.electives` has `null` or `undefined` values for any of the three category fields — render an em dash or a placeholder label like "Elective I" in the column header to avoid rendering `undefined` as column text.

### Step 14: W-Note Block

Create `src/components/students/WNoteBlock.tsx` as a Server Component. It receives the `markRecords` array and the `electives` object as props.

To generate the W-note, iterate over all `MarkRecord` entries in the array. For each record, call `getWSubjects(markRecord, electives)` from `src/lib/w-rule.ts`. This function returns an array of subject name strings where the mark is below 35. Collect all returned strings from all terms into a flat array, then deduplicate the array using a `Set`.

If the resulting unique W-subject set is empty, render: "No W marks recorded for this student." This should be styled as an informational, neutral message.

If there are one or more W subjects, render a note block — visually distinguished by a yellow or amber border-left panel — containing text such as: "This student has W marks in the following subject(s): [comma-separated list]." The subject names in the list should match the labels used as column headers in the marks table (i.e., use the student's own elective labels for elective subjects appearing in the list).

Position the W-note block immediately below the marks table and above the performance chart placeholder.

### Step 15: Placeholder Sections on Profile

Below the W-note block, render a card-shaped placeholder for the Performance Bar Chart. The card should have a fixed minimum height (ensure it occupies visible space on the page — around 200px is appropriate), a dashed or muted border, and centered text reading: "Performance chart available in Phase 4". This section should match the visual dimensions and position that the real chart will occupy so that Phase 4 can drop in the chart component without restructuring the page layout.

Below the chart placeholder, render two buttons side by side: "Generate PDF Report" and "Preview Mode". Both are rendered using the shadcn/ui `Button` component with the `disabled` prop set to `true`. Apply additional CSS classes to ensure they appear visually greyed out (since the `disabled` attribute alone may not always achieve sufficient visual differentiation with all button variants).

Wrap each disabled button inside a shadcn/ui `Tooltip` component. The `TooltipContent` for "Generate PDF Report" should read: "PDF report generation is available in Phase 3." The `TooltipContent` for "Preview Mode" should read: "Preview mode is available in Phase 4." Because `Tooltip` components in shadcn/ui do not fire on disabled HTML elements by default, wrap each button in a `span` element as the tooltip trigger, rather than applying the trigger directly to the button.

---

## Elective Label Resolution

The marks table and W-note block use the elective category labels stored on the `Student` record itself (`student.electives.categoryI`, `categoryII`, `categoryIII`) rather than reading current labels from `SystemConfig`. This is intentional and architecturally important.

Elective labels stored in `SystemConfig` may change over time as the school updates subject offerings. If the marks table used live `SystemConfig` values, historical marks for a student who enrolled under different elective labels would display under the wrong subject names, creating incorrect report data. By capturing and storing the elective labels at the time of student creation on the student record itself, the marks table always reflects what the student was actually enrolled in.

This means the implementation must never look up `SystemConfig` from within the marks table or W-note block. The `electives` object on the student is the authoritative source of the column labels for that student's table.

---

## Role Enforcement Detail

Role-based UI rendering and API enforcement must be consistent with each other:

On the **Student List page**, the Edit and Delete buttons in the Actions column are rendered conditionally. The page Server Component reads the session role and passes it as a prop through the component tree. Only when `role === "ADMIN"` or `role === "SUPERADMIN"` should these buttons appear in the rendered HTML. Do not render them as hidden elements — omit them entirely from the DOM for non-privileged roles.

On the **Student Profile page**, the Edit Profile and Delete buttons in the header are similarly conditionally rendered using the role prop.

At the **API level**, the `DELETE /api/students/[id]` route enforces the same restriction server-side using `requireAuth(["ADMIN", "SUPERADMIN"])` regardless of what the UI does. This prevents privilege escalation via direct API calls. A TEACHER or VIEWER who sends a raw DELETE request to the API must receive a 403 response.

The GET routes for students impose only authentication (any valid session), not a role restriction. Any logged-in user can read student data. This matches the UI, where the View button and profile page are accessible to all roles.

---

## Error State Handling

**Student not found on profile page:** When `prisma.student.findUnique` returns `null`, or when the student has `isDeleted: true`, call `notFound()`. Do not use `redirect` — `notFound()` is semantically correct here and results in a 404 status code, which matters for any scraping or testing tools. A redirect to the list page would mask the fact that the URL was invalid.

**Database unreachable:** If Prisma throws a connection error, the Server Component will throw and Next.js will render its error boundary (if configured) or the default error page. Do not silently catch database errors in Server Components and return misleading empty states. The API routes should return 500 with a generic message.

**Empty marks table:** A student with no MarkRecords is a valid and expected state for newly created students. Render all three term rows with em dashes in every cell, and show the "No marks recorded yet" note. Do not skip rendering the table structure.

**Undefined electives fields:** Legacy student records or records created with incomplete data may have `null` values for one or more elective fields. Defensively handle this in both the marks table (fall back to "Elective I/II/III" as column labels) and the `getWSubjects` call (which should already handle null marks gracefully if implemented correctly in Phase 1).

**Search with special characters:** The `search` URL param may contain characters that are meaningful in regex patterns. Prisma's `contains` filter with `mode: "insensitive"` on MongoDB is not regex-based — it uses a case-insensitive substring match and handles special characters safely. No additional escaping is needed at the Prisma query level.

**`searchParams` type in Next.js App Router:** Next.js types `searchParams` as `{ [key: string]: string | string[] | undefined }`. Each value can be a string array if the same key is specified multiple times in the URL. Always coerce to a single string using a pattern like `Array.isArray(val) ? val[0] : val` before using the value, or use the first element extraction. Not handling this will cause type errors or unexpected behavior when filters are duplicated in the URL.

---

## File Inventory

The following files are created or modified by this task:

- `src/app/api/students/route.ts` — GET /api/students route handler
- `src/app/api/students/[id]/route.ts` — GET and DELETE /api/students/[id] route handlers
- `src/app/(dashboard)/students/page.tsx` — Student List Server Component page
- `src/app/(dashboard)/students/[id]/page.tsx` — Student Profile Server Component page
- `src/components/students/StudentFilterBar.tsx` — Filter bar client component
- `src/components/students/StudentTable.tsx` — Table with sorting, bulk select, and delete dialog trigger
- `src/components/students/PaginationControl.tsx` — Pagination UI component
- `src/components/students/DeleteStudentDialog.tsx` — Soft-delete confirmation dialog
- `src/components/students/ProfileHeader.tsx` — Profile page header with labels, badges, and action buttons
- `src/components/students/MarksTable.tsx` — Marks grid with W-rule rendering
- `src/components/students/WNoteBlock.tsx` — Auto-generated W-mark summary block
- `src/lib/w-rule.ts` — Read-only; imported but not modified in this task

No new Prisma schema changes are introduced in this task. No new environment variables are required.

---

## Integration Points

**What Task 3 (Student Create and Edit) depends on from this task:**
- The file structure at `src/app/(dashboard)/students/[id]/page.tsx` must exist for the edit route at `src/app/(dashboard)/students/[id]/edit/page.tsx` to be placed as a sibling.
- The `DeleteStudentDialog` component may be reused directly.
- The `ProfileHeader` component will receive an Edit button linking to the edit page — the edit page must exist before this link is testable end-to-end.

**What Phase 3 (Marks Entry) depends on from this task:**
- The `MarksTable` component and its column structure define the exact layout that the marks entry form in Phase 3 must mirror.
- The `GET /api/students/[id]` route with `markRecords` included is the data source that the Phase 3 marks entry page uses to pre-populate fields.
- The `delete` soft-flag behavior must be stable — Phase 3 filters by `isDeleted: false` when listing students for marks entry.

**What Phase 4 (Analytics and Preview) depends on from this task:**
- The placeholder card in `src/app/(dashboard)/students/[id]/page.tsx` reserves the exact layout zone where the performance chart component will be inserted.
- The disabled "Preview Mode" button must be already rendered in the correct position for Phase 4 to simply enable it.
- The `GET /api/students/[id]` route providing the full `markRecords` array is the data source for the Phase 4 chart.

---

## Common Pitfalls

**`searchParams` values arriving as arrays:** In Next.js App Router, if a URL contains `?grade=7&grade=8`, the `searchParams` object receives `grade` as `["7", "8"]`. Always normalize to a single value before use. The recommended pattern is to access `searchParams.grade` and if it is an array, take `searchParams.grade[0]`.

**Prisma case-insensitive search on MongoDB:** Unlike PostgreSQL, MongoDB does not support the `mode: "insensitive"` option via a standard locale-based collation at the Prisma level in the same way. As of Prisma 5.x on MongoDB, the `mode: "insensitive"` option in a `contains` filter is supported and uses MongoDB's regex-based case-insensitive matching under the hood. Verify this works correctly with the actual Atlas version and Prisma version in use, and add a check for it in the acceptance test.

**Undefined electives on records missing data:** If a student record was inserted without setting elective category fields, accessing `student.electives.categoryI` throws at runtime. Guard this with optional chaining (`student.electives?.categoryI`) in every place elective labels are read from the student object.

**Marks table with zero MarkRecords:** Do not conditionalize whether to render the marks table based on whether MarkRecords exist. The table structure must always be present. Render em dashes throughout and display the "no marks yet" note. Hiding the table for new students would break layout expectations for Phase 3.

**`notFound()` versus `redirect()` on the profile page:** Calling `redirect("/dashboard/students")` when a student is not found looks friendly but hides the invalid URL from the developer and returns a 302 instead of a 404. Use `notFound()` exclusively. If the application later adds breadcrumb or back-navigation logic, it will rely on the profile route being reliable and predictably 404ing for invalid IDs.

**Tooltip on disabled buttons:** The HTML `disabled` attribute prevents all pointer events on the element, including those that trigger tooltip visibility. If a `Tooltip` from shadcn/ui is attached directly to a disabled `Button`, the tooltip will never appear. Wrap the disabled button in a `<span>` (which is always interactive) and attach the `TooltipTrigger` to the span instead. Ensure the span does not introduce unexpected layout effects by setting it to `inline-flex` or `contents` as appropriate.

**Role prop drilling depth:** The role value from the session must reach the `StudentTable` component's row rendering logic and the `ProfileHeader` component. Since the page is a Server Component and these are Client Components, pass the role as a prop at the page level. Do not use a client-side session hook (`useSession`) inside the table row to check the role — this creates a render flash where buttons are absent then appear after the session resolves, which is a poor user experience and a potential UI security concern.
