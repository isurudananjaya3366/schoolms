# Task 5.3 — Audit Log Viewer

**Phase:** 5 — Backup, Security Hardening, and Testing  
**Task Number:** 5.3 of 4  
**Complexity:** Medium  
**Depends On:** Task 5.1 complete, AuditLog collection has been accumulating entries since Phase 2

---

## Objective

Build a SUPERADMIN-only Audit Log Viewer that presents the contents of the existing AuditLog collection in a paginated, filterable table. Provide a CSV export endpoint alongside the paginated API route so that administrators can download a filtered subset of entries for external review or compliance purposes.

---

## Deliverables

- `app/dashboard/settings/audit/page.tsx` — the server-rendered viewer page with filter controls, table, pagination, and export button
- `app/api/audit-log/route.ts` — paginated list endpoint accepting filter parameters and returning a structured JSON response
- `app/api/audit-log/export/route.ts` — CSV export endpoint that accepts the same filter parameters and streams a downloadable file
- Sidebar navigation update to include the Audit Log link under the Settings section, visible only to SUPERADMIN users

---

## Context and Background

The AuditLog collection has been written to since Phase 2 by every mutation route across the application. User management actions, student record changes, mark entries, backup operations, authentication events, and configuration changes all produce audit log entries as a side effect of their primary operations. By the time this task is implemented, the collection will already contain a substantial history of system activity.

This task builds the read interface for that accumulated data. The page is exclusively available to SUPERADMIN-role sessions. No other role — including ADMIN — may access the audit log viewer, its API routes, or the export endpoint. This restriction reflects the sensitivity of the data, which includes IP addresses, user identifiers, and the before and after state of record mutations.

The audit log is intentionally append-only. There are no update or delete operations available anywhere in the system for AuditLog entries, and this viewer must not introduce any such capability. The entry records are treated as an immutable ledger of system events. The viewer page is therefore purely read-only: it displays entries, supports filtering, and allows export. Nothing else.

Because the collection is append-only and can grow very large in an active school environment, the API and export routes must be written with efficient query construction in mind. Pagination must be enforced on the list endpoint, and the export route must avoid loading the entire result set into memory at once.

---

## AuditLog Collection Review

### Fields

| Field | Type | Description |
|---|---|---|
| id | String | MongoDB ObjectId as string, primary key |
| timestamp | DateTime | The moment the event occurred; primary sort key with a descending index |
| userId | String (nullable) | The ObjectId of the user who triggered the event; null for scheduled cron actions |
| userEmail | String | Denormalised email address of the acting user, stored at write time |
| userRole | String | The role held by the acting user at the time of the event |
| action | String | One of the action type constants; identifies the category of event |
| targetId | String (nullable) | The ObjectId of the record affected by the event, if applicable |
| targetType | String (nullable) | The collection or entity type of the target record, such as Student or User |
| details | String | A JSON-encoded string containing event-specific contextual data |
| ipAddress | String | The IP address from which the request originated |

The timestamp field carries a database-level descending index. All queries against this collection should include an orderBy on timestamp descending unless a different sort is explicitly required.

### Action Type Constants Reference

**Authentication events**
- `LOGIN` — successful user login
- `LOGOUT` — user-initiated session logout
- `LOGIN_FAILED` — failed login attempt
- `PASSWORD_CHANGED` — user changed their own password
- `PASSWORD_RESET_REQUESTED` — password reset flow initiated
- `PASSWORD_RESET_COMPLETED` — password reset flow completed successfully

**User management events**
- `USER_CREATED` — a new user account was created
- `USER_UPDATED` — an existing user account was modified
- `USER_DELETED` — a user account was removed
- `USER_ROLE_CHANGED` — a user's role was altered by a SUPERADMIN

**Student management events**
- `STUDENT_CREATED` — a new student record was added
- `STUDENT_UPDATED` — an existing student record was modified
- `STUDENT_DELETED` — a student record was soft-deleted
- `STUDENT_RESTORED` — a previously deleted student record was restored

**Mark management events**
- `MARK_UPDATED` — a single mark entry was changed
- `MARK_BATCH_SAVED` — a batch of mark entries was committed in a single operation
- `MARK_DELETED` — a mark entry was removed

**Report events**
- `REPORT_VIEWED` — a progress report was viewed in the browser
- `REPORT_DOWNLOADED` — a progress report PDF was downloaded
- `PREVIEW_MODE_ACCESSED` — the slide preview mode was entered

**Analytics events**
- `ANALYTICS_VIEWED` — the analytics page was accessed
- `ANALYTICS_EXPORTED` — an analytics chart or dataset was exported

**System config events**
- `CONFIG_CHANGED` — a value in the SystemConfig document was modified

**Backup events**
- `BACKUP_TRIGGERED` — a backup operation was started manually or by schedule
- `BACKUP_COMPLETED` — a backup operation finished successfully
- `BACKUP_FAILED` — a backup operation ended with an error
- `BACKUP_DELETED` — a backup file was removed
- `RESTORE_TRIGGERED` — a restore operation was initiated
- `RESTORE_COMPLETED` — a restore operation finished successfully
- `RESTORE_FAILED` — a restore operation ended with an error

**Security events**
- `RATE_LIMIT_EXCEEDED` — a client exceeded the configured rate limit threshold
- `UNAUTHORISED_ACCESS_ATTEMPT` — a request was made to a route the session role cannot access
- `SUSPICIOUS_REQUEST_DETECTED` — the security middleware flagged a request as suspicious based on heuristics

---

## Audit Log API Route — GET /api/audit-log

### Authentication

The route handler must retrieve the current session at the start of the request. If no session is present, return a 401 response. If the session role is anything other than SUPERADMIN, return a 403 response. Under no circumstances should any partial data be returned to a non-SUPERADMIN session.

### Accepted Query Parameters

| Parameter | Default | Notes |
|---|---|---|
| page | 1 | Current page number; must be a positive integer |
| limit | 50 | Entries per page; capped at a maximum of 200 |
| fromDate | (none) | ISO date string; filters entries where timestamp is on or after this date |
| toDate | (none) | ISO date string; filters entries where timestamp is on or before this date |
| userId | (none) | ObjectId string; performs an exact match on the userId field |
| actionTypes | (none) | Comma-separated list of action type constants to include |
| search | (none) | Free text string applied to both the userEmail and details fields |

### Prisma Query Construction

The where clause must be assembled dynamically based on which parameters are actually present in the request. Begin with an empty conditions object and extend it as each parameter is validated and parsed.

The timestamp range filter applies a gte condition when fromDate is present and a lte condition when toDate is present. Both conditions target the timestamp field and are expressed as Date objects rather than strings.

The userId filter is a simple equality match on the userId field. Validate that the provided value is a non-empty string before applying it.

The actionTypes filter uses the Prisma in operator. Split the comma-separated string into an array, strip whitespace from each element, and filter out any values that do not match a known action type constant before passing the array to the query.

The free text search uses the MongoDB string contains operator with mode set to insensitive. Apply a contains filter to userEmail and a separate contains filter to details. Combine both filters using an OR block. The OR block must be wrapped together with any other active where conditions inside an AND array so that the overall clause behaves correctly. Failing to parenthesise the OR and AND correctly is the most common bug in this type of dynamic query construction.

### Response Shape

Return a JSON object with the following fields:

- `data` — the array of AuditLog entries for the current page, ordered by timestamp descending
- `total` — the total count of entries matching the active where clause, obtained from a separate Prisma count call using the same where clause
- `page` — the current page number as an integer
- `limit` — the effective limit used for this response
- `totalPages` — computed as the ceiling of total divided by limit

---

## Audit Log Export Route — GET /api/audit-log/export

### Authentication

Apply the same SUPERADMIN-only session check as the paginated route. Return 403 for any other session.

### Behaviour

The export route accepts the same set of filter query parameters as the paginated route and constructs the where clause using the same logic. However, it does not apply pagination. The route retrieves all entries matching the filters and serialises them as a CSV response.

Set the response Content-Type header to `text/csv`. Set the Content-Disposition header to `attachment` with a filename of `audit-log-YYYY-MM-DD.csv` where the date portion reflects the current UTC date at the time of the request. This causes the browser to treat the response as a file download rather than rendering the content inline.

To avoid loading a potentially large result set into memory, the export should retrieve results in batches using iterative Prisma findMany calls with skip and take, appending each batch to the response stream as it is retrieved.

### CSV Structure

The CSV file must include a header row followed by one data row per AuditLog entry. The column order and headers must be:

| Column Header | Source Field |
|---|---|
| ID | id |
| Timestamp | timestamp — formatted as ISO 8601 string |
| User Email | userEmail |
| User Role | userRole |
| Action | action |
| Target Type | targetType |
| Target ID | targetId |
| IP Address | ipAddress |
| Details | details |

The Details column contains the raw JSON string from the details field. Because JSON strings frequently contain commas, double quotes, and newlines, each value in this column must be wrapped in double quotes. Any double-quote characters that appear within the value must be escaped by replacing each with two consecutive double-quote characters. All DateTime values must be expressed as ISO 8601 strings to ensure unambiguous parsing by any CSV consumer.

---

## Audit Log Viewer Page Design

### Access Control

Both the middleware configuration and the page's server component must enforce the SUPERADMIN-only restriction independently. The middleware provides the first layer of protection by inspecting the session before the request reaches the page. The server component provides the second layer by re-validating the session at render time and redirecting to a 403 or login page if the session is absent or insufficient.

### Page Layout

The page is organised vertically with the following regions from top to bottom. A page heading identifying the screen as the Audit Log. A filter row immediately below the heading, containing all four filter controls and the Export CSV button positioned at the far right. The data table occupying the main content area. Pagination controls at the bottom of the table.

### Filter Row

The filter row contains four interactive controls that collectively determine which entries appear in the table.

- A pair of date pickers — one for the start of the date range and one for the end — using the shadcn DatePicker component or an equivalent accessible component from the project's component library.
- A searchable user dropdown populated by a call to the existing `/api/users` endpoint. The dropdown displays the user's name or email and sends the selected user's ObjectId as the userId filter parameter.
- An action type multi-select dropdown containing all action type constants as options. Each option is displayed using its human-readable label rather than the raw constant string.
- A free text search input that applies to the userEmail and details fields.

Whenever the value of any filter control changes, the page number must be reset to 1 and a new data fetch must be triggered immediately to reflect the updated filter state.

### Human-Readable Action Labels

Every action type constant must have a corresponding human-readable label defined in a dedicated mapping object. This mapping is used in the Action column of the table and in the options list of the action type multi-select dropdown. Representative examples of the expected label style:

- `LOGIN` → "User logged in"
- `LOGOUT` → "User logged out"
- `LOGIN_FAILED` → "Login attempt failed"
- `USER_CREATED` → "User account created"
- `STUDENT_DELETED` → "Student record deleted"
- `MARK_BATCH_SAVED` → "Batch marks saved"
- `BACKUP_TRIGGERED` → "Backup triggered"
- `BACKUP_COMPLETED` → "Backup completed"
- `RESTORE_TRIGGERED` → "Restore triggered"
- `RESTORE_COMPLETED` → "Restore completed"
- `CONFIG_CHANGED` → "System configuration changed"
- `RATE_LIMIT_EXCEEDED` → "Rate limit exceeded"
- `UNAUTHORISED_ACCESS_ATTEMPT` → "Unauthorised access attempt"
- `SUSPICIOUS_REQUEST_DETECTED` → "Suspicious request detected"

Apply this same pattern to all remaining constants. No raw constant strings should appear anywhere in the rendered UI.

### Table Columns

| Column | Content |
|---|---|
| Timestamp | Formatted in the school's configured timezone; the raw UTC value is shown as a tooltip on hover |
| User | The display name derived from the userEmail field, or the email itself if a name is unavailable |
| Role | The userRole value rendered as a styled badge matching the role badge convention used elsewhere in the dashboard |
| Action | The human-readable label for the action type constant |
| Target | A concatenation of targetType and a truncated version of targetId when both are present; empty otherwise |
| IP Address | The ipAddress field value |
| Details | A disclosure icon rendered when a details record is available; empty cell when details is null or an empty object |

Clicking anywhere on a table row opens the row detail modal for that entry.

### Row Detail Modal

The modal opens as an overlay and displays the full content of the selected AuditLog entry. Every field from the entry is shown, labelled clearly. The details field is rendered in a formatted, syntax-highlighted monospace block so that the JSON structure is legible without manual parsing.

For mark update events the details object will contain before and after sub-objects representing the field values before and after the mutation; the modal should present these side by side or in a clearly labelled before/after structure. For error events the details object will contain an error message field; this must be displayed prominently so the administrator can read the error without inspecting raw JSON.

The modal contains only a Close button. There are no edit, delete, or export actions inside the modal. The modal can also be dismissed by pressing the Escape key or clicking outside the modal boundary.

### Pagination

Pagination is server-side. The total number of matching entries and total page count are returned by the API as part of every response. Display a summary line above the table in the format "Page X of Y — Z total entries". Provide Previous and Next buttons that step through pages while preserving the current filter state. For logs with a large number of pages, include a direct page number input field that allows the administrator to jump to a specific page without stepping through each one. All pagination navigation must update the URL query string so that the current page and filter state can be bookmarked or shared.

### CSV Export

The Export CSV button reads the currently active filter values from the filter state and constructs a GET request to `/api/audit-log/export` with those values encoded as query parameters. The button enters a visible loading state — label changes to "Exporting…" and the button is disabled — while the request is in flight. When the response arrives the browser's native download behaviour is triggered by the Content-Disposition header, saving the file with the server-provided filename. After the download begins the button returns to its normal state.

---

## Sidebar Navigation Update

Add an "Audit Log" link to the sidebar navigation component under the Settings section. The link must be conditionally rendered — it should only be visible when the current session role is SUPERADMIN. Use the same conditional rendering pattern already applied to other SUPERADMIN-only navigation items in the sidebar component established in Phase 2.

The navigation item points to `/dashboard/settings/audit`. Add the new item to the SUPERADMIN-only section of the navigation items array in the sidebar, grouped logically with other settings-category links. Ensure the item uses the correct icon from the existing icon set used throughout the sidebar, choosing one that conveys logging or audit activity. The active state highlight must function correctly when the current path matches `/dashboard/settings/audit`.

---

## Acceptance Criteria

1. Visiting `/dashboard/settings/audit` as a SUPERADMIN user loads the audit log viewer page with the filter row, table, and pagination controls visible.
2. Visiting the same URL as any non-SUPERADMIN authenticated user results in a 403 response or redirect; unauthenticated users are redirected to the login page.
3. The paginated API route returns correctly shaped JSON including data, total, page, limit, and totalPages fields for a request with no filters applied.
4. Each filter parameter — fromDate, toDate, userId, actionTypes, and search — correctly narrows the result set when applied individually and in combination.
5. The action type multi-select dropdown displays human-readable labels for all defined constants, and selecting a subset of action types restricts the table to only matching entries.
6. Clicking a table row opens the detail modal; the modal displays all AuditLog fields and renders the details JSON in a formatted monospace block.
7. The Export CSV button triggers a file download containing all entries matching the current filter state, with correct column headers and properly escaped values in the Details column.
8. The Audit Log sidebar link is visible in the Settings section when signed in as SUPERADMIN and is absent for all other roles.
9. Paginating through results preserves the active filter state in the URL query string; navigating back to the page with a bookmarked URL restores the correct filter state and page number.
10. The total entry count displayed in the pagination summary accurately reflects the number of entries matching the current filter — verified by comparing the displayed count against a filtered count query run directly against the database.

---

## Notes and Pitfalls

- Prisma count with the same where clause as findMany must be issued as a separate query because MongoDB does not support performing a total count in the same pipeline as a paginated findMany in Prisma; attempting to combine them will either produce an error or silently return incorrect results.
- The free text search across both the details and userEmail fields using an OR block requires careful parenthesising of the overall where clause — the OR block must be wrapped inside an AND array together with all other active filter conditions, otherwise the OR will override the other conditions and return more results than intended.
- CSV generation for large audit log data sets must use a batched iteration approach rather than loading all matching entries into memory at once; retrieve entries in chunks using successive findMany calls with skip and take increments, writing each batch to the response stream before fetching the next, to avoid excessive memory consumption on large exports.
- Human-readable timezone formatting for the Timestamp column requires the school's configured timezone string from the SystemConfig document; this value must be fetched server-side during the page render and passed down as a prop or through a server context to the date formatting utility — do not rely on the browser's local timezone, which may differ from the school's timezone and produce inconsistent timestamp displays.
