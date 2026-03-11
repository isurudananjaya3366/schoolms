# Phase 2: Core Dashboard and Student Management

**Document Version:** 1.0  
**Phase Number:** 2  
**Recommended Task Documents:** 4  
**Last Updated:** 2026-03-11  
**Project:** SchoolMS — Full-Stack School Management System  

---

## Phase Summary

Phase 2 constructs the primary working surface of SchoolMS: the authenticated Admin Dashboard shell and the core data management pages that staff and administrators will use every day. Building directly on the authentication infrastructure, database schema, and configuration tooling established in Phase 1, this phase delivers a navigable, role-aware dashboard that immediately presents meaningful school data to its users.

The phase is divided into four major areas of work. First, the persistent dashboard shell — the layout, sidebar, and topbar — is built as the structural container inside which all future dashboard pages are rendered. Second, the Dashboard Overview page provides at-a-glance key performance indicators and a live activity feed so that any user logging in immediately has a meaningful starting point. Third, the full Student Management surface is constructed: this includes the paginated student list, the student profile page, and the add/edit student forms. Fourth, administrative tooling is added in the form of User Management (creating and managing user accounts) and the Settings page (school-level configuration stored in SystemConfig).

All API routes serving Phase 2 UI are also built in this phase. Every data mutation writes an audit log entry. All inputs are validated with Zod. All role-based access controls are enforced at both the API and UI layers.

When Phase 2 is complete, a fully authenticated user can log in, view school KPIs, browse and search students, view individual student profiles, add or edit student records, manage other user accounts (if admin), and configure school-wide settings. Navigation items for marks, reports, analytics, backup, and audit log are present in the sidebar but route to clearly labelled placeholder pages — this keeps the navigation complete while deferring those implementations to later phases.

---

## Phase Scope

### In Scope for Phase 2

- Dashboard layout shell: layout.tsx as a React Server Component with sidebar, topbar, and main content area
- Sidebar navigation with role-conditional rendering of all 11 nav items
- Topbar displaying user name, role, logout button, and breadcrumb navigation
- Dashboard Overview page with four KPI cards, recent activity feed, and quick actions section
- Student List page with server-side pagination, URL-based filter state, sorting, bulk select, and CSV export
- Student Profile page with header section, marks table with W-rule display logic, and placeholder zones for charts and PDF generation
- Add Student form at /dashboard/students/new
- Edit Student form at /dashboard/students/[id]/edit
- Soft-delete student capability with confirmation dialog
- User Management page at /dashboard/settings/users with list, create modal, edit, and deactivate flows
- Settings page at /dashboard/settings with school name, academic year, and elective label configuration
- Class Group data used in student assignment forms (seeding strategy and grade/section filtering logic)
- All student API routes: GET, POST, GET by id, PATCH, soft-DELETE
- All user management API routes: GET, POST, PATCH, soft-DELETE (deactivate)
- Settings API routes: GET and PATCH for SystemConfig
- Audit logging for every create, update, and delete action within Phase 2 scope
- Zod validation on all API route input
- Offline-tolerant UI error boundaries and graceful empty states
- Role enforcement at middleware, API handler, and UI rendering layers

### Out of Scope for Phase 2

- Mark entry and mark viewing pages (built in Phase 3)
- Progress report generation and PDF output (built in Phase 3)
- Analytics and cohort charts (built in Phase 4)
- Preview mode for student reports (built in Phase 4)
- Backup and restore functionality (built in Phase 5)
- Audit Log browsing page (built in Phase 5)
- The Performance Bar Chart on the student profile (placeholder only in Phase 2, implemented in Phase 4)
- Email notification system
- Any mobile-first native app concerns beyond responsive web layout

---

## Phase Goals

The following criteria must all be true before Phase 2 is considered complete:

- The dashboard shell renders with a persistent sidebar on desktop and a drawer-based mobile sidebar, and correctly wraps all child routes under /dashboard/
- All 11 sidebar navigation items render with correct routes, icons, and labels; items requiring elevated roles are hidden from lower-privilege users
- The Dashboard Overview page displays four populated KPI cards and a recent activity feed without requiring any manual data refresh
- The student list page loads paginated results from MongoDB, supports filtering by grade and class, supports search by name or index number, and reflects all active filter state in the URL query parameters
- A student profile page correctly displays the student's full information and their marks in a tabular format with W-rule applied at the display layer
- The Add Student form validates all required fields, checks index number uniqueness server-side, and redirects to the new student profile on success
- The Edit Student form pre-fills with current data, submits a PATCH to the API, and reflects changes immediately after save
- Student soft-delete removes the student from all list views but preserves their mark records in the database
- The User Management page lists all accounts, allows an admin to create a new user via modal, edit user details, and deactivate accounts
- The Settings page saves and reads school name, academic year, and elective category labels from SystemConfig
- All Phase 2 API routes enforce role requirements and return 403 responses when the calling user does not meet the minimum role
- Every create, update, and delete operation in Phase 2 writes a structured entry to the AuditLog collection
- All API route inputs are validated with Zod and return structured 422 responses on validation failure
- The dashboard displays graceful error states, not unhandled error pages, when the database is unreachable

---

## Phase 1 Prerequisites

The following must exist from Phase 1 before Phase 2 implementation begins:

- A Next.js 14 App Router project initialised with TypeScript strict mode, path aliases, Tailwind CSS v3 configured, and shadcn/ui installed with base theming in place
- Prisma schema fully defined and synced to MongoDB Atlas, with models for User, ClassGroup, Student, MarkRecord, and SystemConfig all present and functional
- NextAuth.js v5 configured with a CredentialsProvider that reads from the User collection, generates JWT sessions containing the user's id, name, email, and role field
- middleware.ts in place that protects all routes matching /dashboard/ and /api/ by redirecting unauthenticated requests to /login
- The database configuration page at /config is functional and confirms database connectivity
- All required environment variables are configured and stable: database connection string, NextAuth secret, and any application-level configuration values
- At least one SUPERADMIN user exists in the database so that the system can be logged into at the start of Phase 2 development

If any of these prerequisites are absent or non-functional, Phase 2 work must not begin on the affected areas until they are resolved.

---

## Dashboard Layout Architecture

### Layout Component Strategy

The root layout for all dashboard routes is defined at app/dashboard/layout.tsx and implemented as a React Server Component. This means it runs entirely on the server, can read the session directly using the NextAuth getServerSession helper, and passes the session user data as props down to any client components it contains. The layout does not have a loading state of its own — it renders synchronously with the server session and delegates loading states to its child pages.

The layout renders three structural zones: the sidebar, the topbar, and the main content area. The Outlet equivalent in App Router — the children prop — is placed inside the main content area. This ensures every page under /dashboard/ automatically inherits the shell without any per-page setup.

### Sidebar Design

The sidebar is a persistent navigation panel visible on desktop breakpoints (lg and above, meaning 1024px viewport width and wider). On smaller viewports, the sidebar is hidden and replaced by a hamburger menu button in the topbar that triggers a shadcn/ui Sheet component acting as a sliding off-canvas drawer.

The sidebar contains:

- The application logo and name at the top
- A vertical stack of navigation items grouped logically (main navigation at the top, settings/admin items toward the bottom)
- A visual active-route indicator that highlights the current page's nav item using Next.js usePathname on the client
- Conditional rendering of restricted navigation items (settings/users, audit log, backup/restore) based on the session role passed from the server layout

Because the layout.tsx is a Server Component, the session role check happens server-side before the sidebar markup is sent to the client. Navigation items the user is not permitted to see are simply not present in the rendered HTML — they are not hidden with CSS.

The sidebar navigation items and their properties are as follows:

| Label | Route | Minimum Role | Phase 2 Status |
|---|---|---|---|
| Overview | /dashboard | ALL | Fully implemented |
| Students | /dashboard/students | ALL | Fully implemented |
| Add Student | /dashboard/students/new | ADMIN | Fully implemented |
| Enter Marks | /dashboard/marks/entry | ALL | Placeholder page |
| View Marks | /dashboard/marks/view | ALL | Placeholder page |
| Progress Reports | /dashboard/reports | ALL | Placeholder page |
| Analytics | /dashboard/analytics | ADMIN | Placeholder page |
| Backup & Restore | /dashboard/backup | SUPERADMIN | Placeholder page |
| Settings | /dashboard/settings | ADMIN | Fully implemented |
| User Management | /dashboard/settings/users | ADMIN | Fully implemented |
| Audit Log | /dashboard/settings/audit | SUPERADMIN | Placeholder page |

Placeholder pages must render a clearly labelled message indicating the feature is coming in a later phase, along with a link back to the Overview. They must not be empty or cause 404 errors.

### Topbar Design

The topbar is a horizontal bar fixed to the top of the main content area on desktop, or to the top of the viewport on mobile. It contains:

- On mobile: a hamburger icon button that opens the sidebar drawer
- Breadcrumb navigation showing the current page path as human-readable labels (e.g., Dashboard > Students > Edit Student)
- On the right side: the current user's display name and role label, a notifications bell icon (non-functional in Phase 2, present as a future extension point), and a logout button that calls the NextAuth signOut function

The topbar is a Client Component because it consumes the usePathname hook for breadcrumb generation and handles the logout click event. It receives the user's name and role as props from the Server Component layout.

### Mobile Drawer Behaviour

On mobile, the Sheet component from shadcn/ui is used to render the sidebar as an off-canvas panel. The sheet opens when the hamburger button in the topbar is clicked and closes when a navigation item is selected or when the user taps outside the sheet. The same sidebar content — including all navigation items with correct role-based rendering — is used inside the sheet. No separate mobile menu markup is needed.

---

## Dashboard Overview Page Design

### Page Architecture

The Dashboard Overview page is located at app/dashboard/page.tsx and is implemented as a React Server Component. It uses React's built-in support for parallel async operations to initiate multiple Prisma queries simultaneously rather than sequentially. This means the page waits for all four KPI queries and the activity feed query to resolve in parallel before streaming the rendered result to the client. This approach significantly reduces the total page wait time compared to sequential queries.

### KPI Cards

The four KPI cards are rendered in a responsive horizontal row at the top of the page (four columns on large screens, two on medium, one on small). Each card has a title, a large numeric value, and a secondary label showing context.

**Total Students Enrolled**  
Queries the Student collection for a count of all records where the soft-delete flag is false. The secondary label shows a delta value comparing the current year's total count against the previous year's total count — prefixed with "+" or "−" and a percentage change. If no previous year data exists, the delta is omitted.

**Mark Records This Term**  
Queries the MarkRecord collection for a count of records matching the current academic year and current term as stored in SystemConfig. The secondary label displays the current term label (e.g., "Term 2, 2025").

**Pending Mark Entry**  
Calculates the number of currently active students who have zero MarkRecord entries for the current term and year. This is derived by counting students and subtracting those with at least one MarkRecord this term, or by running a query that groups students by their presence in the MarkRecord set for the current period. The secondary label shows the pending count as a percentage of total students.

**W-Rate This Term**  
Calculates the percentage of individual subject mark fields across all students this term that carry the W value. This is a ratio of W-marked fields to total expected mark fields. The secondary label shows the raw count of W-marked entries.

If any of these queries fail due to database unavailability, the corresponding card must render with a dash value and a subtle error indicator rather than throwing. The error is caught per-card at the component level.

### Recent Activity Feed

Below the KPI cards, the activity feed displays the 20 most recent entries from the AuditLog collection, ordered by timestamp descending. Each entry is formatted as a human-readable sentence based on the action type — for example, a STUDENT_CREATED entry becomes "Admin Jane created student profile for Kavindu Perera, Grade 9B" and a USER_DEACTIVATED entry becomes "Superadmin Root deactivated user account editor@school.lk."

The feed is rendered as a scrollable list with each item showing the formatted sentence on the left and a relative timestamp (e.g., "3 minutes ago", "2 days ago") on the right. Relative timestamps are calculated using a date formatting utility. Because the activity feed is rendered server-side, the relative timestamps are accurate at the time of the server render. Client-side live refresh is not required in Phase 2.

### Quick Actions Section

A set of three prominent action buttons below the activity feed provides fast access to the most common tasks:

- Enter Marks — links to /dashboard/marks/entry (placeholder in Phase 2)
- Add Student — links to /dashboard/students/new
- Generate Report — opens a student search dialog allowing the user to find a student by name or index number before navigating to their profile page (the actual report generation is a Phase 3 feature; the dialog itself navigates to the profile page in Phase 2)

---

## Student Data Model Recap

The Student model in the Prisma schema is central to Phase 2. An understanding of its shape is required when building forms, API routes, and list/profile pages.

A Student record contains: a system-generated ObjectId as the primary identifier, a full name string, a unique index number string (used as a human-readable student identifier in the school context), a reference to a ClassGroup record via classId, a grade integer (6 through 11 inclusive), an embedded electives object containing three category fields (each a string label referring to the elective subject the student is enrolled in), a boolean flag indicating whether the record has been soft-deleted, and standard created and updated timestamps.

The ClassGroup model holds grade (integer 6–11) and section (string A–F) fields, creating combinations such as Grade 9A, Grade 10C. The relationship between Student and ClassGroup is a many-to-one join — many students belong to one class group.

The electives object is embedded within the Student document rather than being a separate collection. Each of the three category fields stores the label of the elective subject. These labels are configured school-wide via the Settings page (stored in SystemConfig), but a student record stores the actual value at time of assignment rather than a reference, so label changes in Settings do not retroactively alter existing student records.

Phase 2 does not create or modify MarkRecord entries directly — marks are out of scope. However, the student profile page in Phase 2 must query existing MarkRecord data for the marks table display, since the W-rule display logic and the marks table structure must be visible even if the data was entered hypothetically or in a future phase.

---

## Student List Page Design

### URL-Based Filter State

The student list page at /dashboard/students is a Server Component that reads all filter parameters from the URL query string. Filters are never stored in local client state — instead, every filter interaction updates the URL, causing a server-side re-render with the new filter applied. This means filters persist across page refreshes and can be bookmarked or shared as URLs.

The supported query parameters are: grade (integer 6–11), classSection (string A–F), search (free-text string matching against student name and index number), page (integer, default 1), sort (field name, default "name"), and order (asc or desc, default asc).

When a user changes a filter dropdown, the client component responsible for the filter controls uses the Next.js router to push the updated query string. The table re-renders server-side with the new results.

### Pagination

Server-side pagination is implemented using Prisma's skip and take parameters. Each page shows 20 student records. The page component calculates the skip value from the current page number and limit. A pagination control UI is rendered below the table showing the current page, total pages, and navigation buttons for previous and next. Total count is fetched with a companion Prisma count query run in parallel with the data query.

### Table Design

The student list table renders the following columns:

| Column | Source Field | Sortable |
|---|---|---|
| Index No. | indexNumber | Yes |
| Full Name | name | Yes |
| Grade | grade | Yes |
| Class Section | classGroup.section | Yes |
| Electives | electives (summary display) | No |
| Actions | — | No |

The Actions column contains two or three icon buttons depending on role: a View button (links to /dashboard/students/[id]) available to all roles, an Edit button (links to /dashboard/students/[id]/edit) visible to ADMIN and SUPERADMIN, and a Delete button (triggers soft-delete confirmation dialog) visible to ADMIN and SUPERADMIN only.

### Bulk Select and CSV Export

Each table row has a checkbox for bulk selection. A "Select All" checkbox in the table header selects all rows on the current page. When one or more rows are selected, a contextual action bar appears at the bottom of the table offering a CSV Export action. The export compiles the selected students' name, index number, grade, class, and electives into a downloadable CSV file generated client-side from the already-fetched data.

---

## Student Profile Page Design

### Header Section

The profile page at /dashboard/students/[id] is a Server Component that fetches the student record by ID on the server. The page header displays the student's full name in a large heading, with their index number, grade, and class group shown as labelled values below. The three elective subjects are displayed as pill-style badges.

If the student ID does not correspond to any record, the page renders a not-found state with a link back to the student list. This is handled by the Next.js notFound function rather than a thrown error.

### Edit and Delete Controls

In the top-right of the header, an Edit Profile button is shown to ADMIN and SUPERADMIN roles. This button links to /dashboard/students/[id]/edit. A Delete button (with distinct destructive styling) is also shown to ADMIN and SUPERADMIN. Clicking Delete opens a confirmation dialog that warns the user that the student will be soft-deleted and asks them to confirm. On confirmation, a DELETE request is sent to the students API route, and on success the user is redirected to the student list.

### Marks Table

Below the header, a marks table displays all MarkRecord entries associated with the student. The table structure places terms as rows and subjects as columns. Each cell shows the numerical mark where available, or a dash where no record exists. The W-rule display logic is applied at this layer: if a student's mark in a subject is below 35, the displayed value in the table is shown as "W" with distinctive styling (the underlying integer value is not altered in the database — this is a display-layer transformation only). A note block below the table automatically lists any subject column that shows a W value, formatted as a human-readable sentence.

### Placeholder Sections

Two sections of the profile page are explicitly placeholders in Phase 2:

The Performance Bar Chart section renders a containing card with a "Performance chart available in a future phase" label. The card is the correct visual size and position so that it does not cause layout shifts when the real chart is implemented in Phase 4.

The Generate PDF Report button and Preview Mode button are rendered in a greyed-out, non-interactive state (using the disabled attribute on the button elements and reduced opacity styling) with a tooltip indicating the feature is not yet available.

---

## Add and Edit Student Forms Design

### Shared Form Structure

The Add Student page at /dashboard/students/new and the Edit Student page at /dashboard/students/[id]/edit share the same form structure. The Edit page is a Server Component that fetches existing student data and passes it as default values to the form. The Add page passes no defaults.

Both forms are Client Components (because they handle input state and submission), receiving initial values as props.

### Form Fields

The form contains the following fields:

| Field | Type | Validation |
|---|---|---|
| Full Name | Text input | Required, minimum 2 characters |
| Index Number | Text input | Required, alphanumeric, must be unique (checked server-side) |
| Grade | Dropdown (6–11) | Required, must be a valid integer in range |
| Class Section | Dropdown (A–F) | Required, options filtered by selected Grade |
| Elective Category I | Text input or select | Required |
| Elective Category II | Text input or select | Required |
| Elective Category III | Text input or select | Required |

### Class Filtering Logic

The Class Section dropdown is dependent on the Grade dropdown. When the user selects or changes the Grade value, the Class Section dropdown is repopulated from the available ClassGroup records for that grade. This is handled client-side: the form component holds the full list of ClassGroup records (fetched on the server and passed as a prop) and filters them by the currently selected grade. When the grade is cleared or changed, the selected class section is also reset to prevent assigning a student to a class group of the wrong grade.

### Elective Label Display

The labels shown in the Elective Category I, II, and III inputs are sourced from SystemConfig settings (configured in the Settings page). If the school has configured Category I as "Geography", the form field is labelled "Geography" rather than the generic "Elective Category I". If no custom label is configured, the generic label is used as a fallback.

The elective inputs can be free-text fields or dropdowns depending on implementation preference. The values stored are the actual subject labels (text strings), not identifiers.

### Submission and Validation Flow

On form submit, all fields are validated client-side using a Zod schema to give immediate feedback without a server round-trip. If client-side validation passes, the form submits to the appropriate API route (POST for add, PATCH for edit). If the server returns a 422 validation error — for example because the index number is already taken — the error message from the API response is displayed inline below the relevant field. On success, the user is redirected to the profile page of the created or updated student.

---

## User Management Page Design

### Page Location and Access

The User Management page lives at /dashboard/settings/users. Access to this page requires the ADMIN or SUPERADMIN role. A STAFF-level user attempting to navigate to this path is redirected to /dashboard by the middleware or layout-level role guard.

### User List

The page displays a table of all user accounts in the system. Table columns are:

| Column | Description |
|---|---|
| Full Name | User's display name |
| Email | Login email address |
| Role | STAFF, ADMIN, or SUPERADMIN |
| Created At | Account creation date, formatted as a human-readable date |
| Status | Active or Deactivated pill badge |
| Actions | Edit and Deactivate/Reactivate buttons |

SUPERADMIN accounts are displayed in the list but may not be edited or deactivated through this UI. The action buttons for SUPERADMIN rows are either hidden or rendered in a disabled state.

### Create User Modal

A Create User button in the top-right of the page opens a shadcn/ui Dialog modal containing a form with the following fields: Full Name (text input), Email (email input, must be unique), Password (password input, minimum 8 characters, displayed as masked), and Role (dropdown limited to STAFF and ADMIN — the SUPERADMIN role option is not present and cannot be selected through the UI).

On submit, the form data is sent to POST /api/users. The password is hashed server-side before storage using the same hashing utility established in Phase 1. On success, the modal closes and the user list refreshes to show the new account.

### Edit User

Clicking the Edit button for a user account opens a similar modal pre-filled with the user's current name, email, and role. The password field is not shown in the edit modal — password changes are a separate concern not covered in Phase 2. The edit form submits to PATCH /api/users/[id]. The role dropdown in edit mode has the same restrictions as in create mode (STAFF and ADMIN selectable; SUPERADMIN non-selectable).

### Deactivate and Reactivate

Clicking Deactivate for an active user account triggers a confirmation dialog before submitting a DELETE request to /api/users/[id]. Despite using the DELETE HTTP method, this performs a soft deactivation — the user's active field is set to false, which causes the NextAuth CredentialsProvider to reject any subsequent login attempts by that account. Active sessions are not instantly invalidated server-side in Phase 2, but the account cannot be used to create new sessions.

A Reactivate button appears in place of Deactivate for accounts where active is false, allowing an admin to re-enable the account. This is implemented as a PATCH request setting active to true.

### Role Restrictions on Actions

ADMIN users can create and deactivate STAFF accounts only. They cannot elevate a user to ADMIN or SUPERADMIN. SUPERADMIN users can manage all accounts below their own level. These restrictions are enforced at the API level — the route handler inspects the calling user's role and the target role before performing the action.

---

## Settings Page Design

### Page Location and Purpose

The Settings page at /dashboard/settings is accessible to ADMIN and SUPERADMIN roles. It stores and retrieves configuration values using the SystemConfig collection, which stores data as key-value pairs. The settings page provides a form-based UI for editing the most important school-wide configuration values.

### Configurable Settings

**School Name:** A text input storing the official school name. This value is used in report headers, the preview mode school branding, and potentially on the login page. Changes take effect immediately upon save.

**Academic Year:** A numeric input or dropdown representing the current academic year (e.g., 2025). This value is used as the default year when creating MarkRecord entries and when calculating KPI counts on the overview page. It defaults to the calendar year of the most recent data but can be adjusted if the school's academic year spans two calendar years.

**Elective Category Labels:** Three text inputs corresponding to Category I, Category II, and Category III. These labels are used in the Add/Edit Student forms, on student profile pages, and in mark entry screens. Changing a label here does not retroactively change student records — it only changes how future forms are labelled.

### SystemConfig Storage Strategy

Each setting is a separate document in the SystemConfig collection with a key field and a value field. When the settings form is submitted, a PATCH request is sent to /api/settings with a JSON body containing all changed key-value pairs. The API handler performs an upsert on each key — updating the document if it exists or inserting it if it does not. Reading settings uses a GET /api/settings call that returns all known keys as a structured object.

The settings form is a Client Component that fetches current values via GET /api/settings on load, displays them in the form, and sends changed values on submit. Optimistic updates should not be used here — the form re-fetches from the API after a successful save to confirm the values are persisted.

---

## Class Group Management

### Class Group Data Structure

Class groups represent the academic class divisions within the school. Each ClassGroup record holds a grade integer (6 through 11) and a section string (A through F). Valid combinations produce up to 36 distinct class groups when all grades have all six sections, though smaller schools may have fewer sections per grade.

### Seeding Strategy

Class groups are seeded into the database during Phase 1's database initialisation step. The seed script creates all valid grade-section combinations that the school uses. In Phase 2, there is no CRUD UI for class groups — they are read-only from the perspective of student management forms. If a school needs to add or remove class groups, this is done via a future settings extension or direct database intervention.

The settings page may optionally include a section in a future phase allowing administrators to add or deactivate class sections, but this is not in Phase 2 scope.

### Grade and Section Filtering in Forms

When building the Add and Edit Student forms, the full list of ClassGroup records is fetched from the database on the server and passed to the form component. The form's Grade dropdown is populated from the unique grade values in this list. When a grade is selected, the Section dropdown is filtered to show only ClassGroup records matching that grade. The value submitted from the form is the classId (the ObjectId of the ClassGroup record), not the grade or section strings directly — though the form displays those human-readable values to the user.

---

## API Routes Detail

### Student Routes

**GET /api/students**  
Returns a paginated list of student records. Requires any authenticated role. Accepted query parameters: page (integer, defaults to 1), limit (integer, max 100, defaults to 20), grade (integer filter, optional), classSection (string filter, optional), search (string, matched against name and indexNumber using a case-insensitive regex, optional), sort (field name, defaults to name), and order (asc or desc, defaults to asc). Response includes a data array of student objects with their classGroup populated, and a pagination metadata object containing totalCount, totalPages, currentPage, and limit.

**POST /api/students**  
Creates a new student record. Requires ADMIN or SUPERADMIN role. Request body must contain name, indexNumber, classId, grade, and an electives object with categoryI, categoryII, and categoryIII string fields. Server validates that indexNumber is not already in use. On success, responds with the created student object and HTTP 201. On validation failure, responds with HTTP 422 and a structured errors object. Writes a STUDENT_CREATED audit log entry.

**GET /api/students/[id]**  
Returns a single student record with their ClassGroup populated and all associated MarkRecord entries included. The marks are not transformed — display transformations like the W-rule are applied in the UI layer. Requires any authenticated role. If no student with the given ID exists (or the student is soft-deleted), responds with HTTP 404.

**PATCH /api/students/[id]**  
Updates a student's profile fields. Requires ADMIN or SUPERADMIN role. Accepts any subset of writable fields: name, indexNumber, classId, grade, and the electives object. If indexNumber is provided and changed, uniqueness is re-validated. Responds with the updated student object on success. Writes a STUDENT_UPDATED audit log entry including the previous and new values of changed fields.

**DELETE /api/students/[id]**  
Performs a soft-delete by setting the student's deleted flag to true. Requires ADMIN or SUPERADMIN role. The student no longer appears in list queries but their record and all associated MarkRecord entries remain in the database. Responds with HTTP 200 and a confirmation message. Writes a STUDENT_DELETED audit log entry.

### User Management Routes

**GET /api/users**  
Returns a list of all user accounts, including deactivated ones. Requires ADMIN or SUPERADMIN role. Response is an array of user objects excluding the password hash field.

**POST /api/users**  
Creates a new user account. Requires ADMIN or SUPERADMIN role. Body must contain name, email, password, and role. The role must be STAFF or ADMIN — the API rejects SUPERADMIN as a value for the role field unless the calling user is SUPERADMIN. Password is hashed using bcrypt before storage. Responds with the created user (excluding password) and HTTP 201. Writes a USER_CREATED audit log entry.

**PATCH /api/users/[id]**  
Updates user name, email, role, or active status. Requires ADMIN or SUPERADMIN role. Role escalation restrictions are enforced: an ADMIN user cannot set another user's role to ADMIN or SUPERADMIN. Responds with updated user object. Writes a USER_UPDATED audit log entry.

**DELETE /api/users/[id]**  
Deactivates a user account by setting active to false. Requires SUPERADMIN role to deactivate ADMIN accounts; ADMIN role is sufficient to deactivate STAFF accounts. Responds with HTTP 200 and confirmation. Writes a USER_DEACTIVATED audit log entry.

### Settings Routes

**GET /api/settings**  
Returns all SystemConfig entries as a structured object with known key names mapped to their values. No role restriction — any authenticated user may read settings (school name, year, and elective labels are used across the dashboard). If a key does not exist in the database, its value in the response defaults to null or a specified fallback.

**PATCH /api/settings**  
Accepts a partial object of key-value pairs to update in SystemConfig. Requires ADMIN or SUPERADMIN role. Performs an upsert for each provided key. Responds with the updated full settings object. Writes a SETTINGS_UPDATED audit log entry listing which keys were changed.

---

## Audit Logging Design

### AuditLog Collection

Every create, update, and delete action performed through Phase 2 API routes must write a document to the AuditLog collection. The collection is not managed through Prisma relations — it is written to directly using Prisma's generic document creation and is queried separately. The AuditLog document structure contains:

- id: system-generated ObjectId
- timestamp: ISO 8601 datetime string captured at the moment the action is performed
- userId: the ObjectId of the user performing the action, extracted from the JWT session in the API route handler
- userDisplayName: a denormalised copy of the user's name at the time of the action
- action: a string constant identifying the operation type (e.g., STUDENT_CREATED, STUDENT_UPDATED, STUDENT_DELETED, USER_CREATED, USER_UPDATED, USER_DEACTIVATED, SETTINGS_UPDATED)
- targetId: the ObjectId of the primary resource being acted upon
- targetType: a string indicating the resource type (STUDENT, USER, SETTINGS)
- ipAddress: extracted from the request headers (the x-forwarded-for header if behind a proxy, otherwise the direct connection IP)
- details: a JSON object containing context-specific information about the change — for updates this should include previous values of changed fields alongside the new values; for creations this includes the key identifying fields of the new record

### Writing Audit Entries

Audit entries are written at the end of API route handlers, after the primary database operation has succeeded. If the primary operation fails, no audit entry is written. If writing the audit entry itself fails, the API route must still return a success response for the primary operation — audit logging failure must not cause the user's action to appear to fail. The audit write error should be logged to the server console for operational monitoring.

### Querying for the Activity Feed

The Dashboard Overview activity feed queries the AuditLog collection for the 20 most recent entries, ordered by timestamp descending. The query does not filter by action type — it returns all recent activity. The formatting logic (converting action codes and details into human-readable sentences) is implemented in a utility function that accepts an AuditLog document and returns a formatted string. Each action type has a corresponding sentence template that incorporates the userDisplayName, targetType, and relevant fields from the details object.

---

## Data Validation Strategy

### Zod Schema Approach

All API routes in Phase 2 validate incoming data using Zod schemas defined in a dedicated validation layer. Each route has a corresponding schema for its request body and, for GET routes, for its query parameters. Schemas are defined using Zod's object, string, number, email, min, max, regex, and enum validators as appropriate.

The student creation schema requires name to be a string with a minimum length of 2, indexNumber to be a string matching an alphanumeric pattern, grade to be an integer between 6 and 11 inclusive, classId to be a string matching MongoDB ObjectId format, and electives to be an object with three string subfields each having a minimum length of 1. The user creation schema requires name as a non-empty string, email as a valid email address format, password as a string with minimum 8 characters, and role as a value from the enumeration STAFF, ADMIN. Query parameter schemas use coerce.number for numeric params like page and grade, with appropriate min and max bounds.

### Error Response Format

When Zod validation fails, the API route responds with HTTP status 422 Unprocessable Entity. The response body is a JSON object with a top-level errors key containing an array of error objects. Each error object has a path array (identifying the field path that failed validation) and a message string (human-readable description of the failure). This format allows the client form to display errors inline next to the relevant fields by matching on the path array.

When authentication or authorisation fails (missing session or insufficient role), the route responds with HTTP 401 Unauthorized or HTTP 403 Forbidden respectively, with a simple JSON object containing a message field.

---

## Offline-Tolerant UI Strategy

### Error Boundary Approach

Phase 2 UI components must not render unhandled error pages when the database is unavailable. Each data-fetching Server Component wraps its Prisma calls in try-catch blocks and handles errors gracefully. For the Dashboard Overview page, each KPI card query is wrapped individually — a failure in one query does not prevent the rest of the cards from rendering.

### Graceful Empty States

When a Prisma query fails due to database connectivity issues, UI components render specific graceful empty states:

- KPI cards display a dash value with a small warning icon and a "Data unavailable" subtitle
- The student list renders a full-width empty state card with the text "Unable to load students — database may be unreachable" and a Retry button that refreshes the page
- The activity feed displays an empty state message "Recent activity unavailable" without crashing the page
- Student profile pages that cannot load a student's data render a page-level error card rather than a blank or broken layout

### Database Unreachable Detection

Prisma throws specific error types when it cannot connect to the database. The error handling utility in Phase 2 inspects thrown errors and distinguishes between not-found errors (which result in 404 responses or not-found UI states), validation errors (which result in structured error responses), and connectivity/unexpected errors (which result in the graceful degraded UI states described above). Error details are never surfaced to the client in production — only user-friendly messages are shown.

---

## Role Enforcement Patterns

### Three Layers of Enforcement

Role-based access control in Phase 2 is enforced at three distinct layers, each complementing the others:

**Middleware Layer:** The existing middleware.ts from Phase 1 already protects all /dashboard/ and /api/ routes from unauthenticated access. In Phase 2, path-specific role checks may be added to middleware to redirect STAFF users away from ADMIN-only paths like /dashboard/settings/users before the page even loads.

**API Handler Layer:** Every API route that has a minimum role requirement inspects the session role from the JWT token in the request. The session is read using the NextAuth getServerSession utility within the route handler. If the role is insufficient, the handler returns HTTP 403 immediately without performing the database operation. This layer is the authoritative enforcement layer — it cannot be bypassed by manipulating the UI.

**UI Rendering Layer:** Server Components that render pages or individual UI controls receive the session from the server-side layout and conditionally render or omit role-sensitive elements. Edit and Delete buttons in tables are only rendered if the session role meets the requirement. Navigation items in the sidebar are only rendered for permitted roles. This layer provides a user experience appropriate to each role — users are not shown controls they cannot use — but it is not a security layer on its own, since the API layer provides the actual enforcement.

### Conditional Rendering Rules

The following summarises which roles see which controls:

| Control or Page | STAFF | ADMIN | SUPERADMIN |
|---|---|---|---|
| Overview page | Yes | Yes | Yes |
| Student list (view) | Yes | Yes | Yes |
| Student edit/delete buttons | No | Yes | Yes |
| Add Student nav item | No | Yes | Yes |
| Settings nav item | No | Yes | Yes |
| User Management nav item | No | Yes | Yes |
| Backup and Restore nav item | No | No | Yes |
| Audit Log nav item | No | No | Yes |
| Create/edit STAFF user | No | Yes | Yes |
| Create/edit ADMIN user | No | No | Yes |
| Deactivate any user | No | STAFF only | Yes |

---

## Recommended Task Documents

Phase 2 is divided into four task documents representing logical, independently-implementable units of work. Each task document provides the implementing agent with a focused scope.

### Task 1: Dashboard Layout Shell and Navigation

**Scope:** Implement app/dashboard/layout.tsx as a React Server Component. Build the Sidebar component with all 11 navigation items, role-based conditional rendering, active route highlighting, and shadcn/ui Sheet-based mobile drawer. Build the Topbar component with breadcrumb navigation, user identity display, logout button, and notifications bell placeholder. Implement all 6 placeholder pages for marks, reports, analytics, backup, and audit log routes. Implement the Dashboard Overview page with all 4 KPI cards, the activity feed, and the quick actions section using parallel Prisma queries and graceful error handling.

**Complexity:** Medium. Most complexity lies in the mobile drawer, role-conditional rendering, and the parallel streaming query pattern for the overview page.

### Task 2: Student List, Profile, and Delete

**Scope:** Implement the Student List page at /dashboard/students with server-side pagination, URL-based filter state across grade, class, and search dimensions, sortable table columns, bulk select, and CSV export. Implement the Student Profile page at /dashboard/students/[id] with the header section, marks table with W-rule display, W-note block, and placeholder sections for the performance chart and PDF report. Implement the soft-delete confirmation dialog and DELETE API handler. Implement GET /api/students and GET /api/students/[id] API routes with Zod query validation and full Prisma queries.

**Complexity:** Medium-High. Pagination with parallel count queries, URL filter state management, and the W-rule display transformation require careful implementation.

### Task 3: Add and Edit Student Forms and API

**Scope:** Implement the Add Student page at /dashboard/students/new and Edit Student page at /dashboard/students/[id]/edit using a shared form component. Implement the grade-filtered class section dropdown logic using client-side filtering of server-fetched ClassGroup data. Implement elective label resolution from SystemConfig. Implement POST /api/students and PATCH /api/students/[id] API routes with Zod body validation, server-side uniqueness check for index number, and audit log entries on success.

**Complexity:** Medium. The dependent dropdown filtering and the elective label resolution from settings are the primary complexity points.

### Task 4: User Management, Settings, and Supporting APIs

**Scope:** Implement the User Management page at /dashboard/settings/users with the user list table, Create User modal form, Edit User modal form, and Deactivate/Reactivate flow. Implement the Settings page at /dashboard/settings with the school name, academic year, and elective label inputs. Implement all user API routes (GET /api/users, POST /api/users, PATCH /api/users/[id], DELETE /api/users/[id]) with role restriction logic and audit logging. Implement settings API routes (GET /api/settings, PATCH /api/settings) with SystemConfig upsert logic.

**Complexity:** Medium. Role restriction logic for user management (who can create or modify which roles) is the primary complexity point requiring careful validation both in the API and UI layers.

---

## Phase Completion Checklist

### Layout and Navigation

- [ ] Dashboard layout.tsx renders with sidebar and topbar wrapping all /dashboard/ child routes
- [ ] Sidebar is persistent on desktop (lg+) and renders as a Sheet drawer on mobile
- [ ] All 11 navigation items are present with correct routes, icons, and labels
- [ ] Navigation items are hidden from users without the required role
- [ ] Active route is visually highlighted in the sidebar
- [ ] Topbar shows user name, role, and a functional logout button
- [ ] Breadcrumb navigation reflects the current page path
- [ ] All 6 placeholder pages render without error and link back to Overview

### Dashboard Overview

- [ ] All 4 KPI cards render with database-sourced values
- [ ] KPI cards show graceful degraded state when database is unreachable
- [ ] Recent activity feed shows the last 20 audit log entries as human-readable sentences
- [ ] Quick Actions section renders with correct links and the student search dialog

### Student Management

- [ ] Student list loads paginated results (20 per page) from MongoDB
- [ ] Grade, class, and search filters update the URL and re-render the server component
- [ ] Sort by name, grade, and index number functions correctly
- [ ] Edit and Delete buttons are hidden from STAFF-role users
- [ ] Bulk select and CSV export work for selected rows
- [ ] Student profile page shows header, marks table, and placeholder sections
- [ ] W-rule is applied at display layer — values below 35 show as W in the table
- [ ] W-note block lists subjects with W values
- [ ] Soft-delete removes student from list and redirects to list page
- [ ] Add Student form validates all fields client-side and server-side
- [ ] Index number uniqueness is validated server-side with inline error feedback
- [ ] Edit Student form pre-fills with current data and patches correctly

### User Management

- [ ] User list displays all accounts with role, status, and action columns
- [ ] Create User modal validates inputs and creates account via API
- [ ] Edit User modal pre-fills data and updates via API
- [ ] Deactivate flow sets active to false and shows the account as Deactivated in the list
- [ ] ADMIN cannot create or elevate users to ADMIN or SUPERADMIN
- [ ] SUPERADMIN row actions are disabled or hidden for modifications

### Settings

- [ ] Settings page loads current SystemConfig values into form fields
- [ ] School name, academic year, and elective labels save correctly via PATCH /api/settings
- [ ] Saved elective labels are reflected in the Add/Edit Student form labels

### API and Infrastructure

- [ ] All Phase 2 API routes return 401 for unauthenticated requests
- [ ] All restricted routes return 403 for insufficient role
- [ ] All POST/PATCH routes return 422 with structured error objects on Zod validation failure
- [ ] Every create, update, and delete route writes a document to AuditLog
- [ ] Audit entries include userId, timestamp, action, targetId, ipAddress, and details
- [ ] All error states in the UI are handled with graceful messages, not unhandled error pages

---

## Dependencies for Phase 3

Phase 3 (Marks Entry and Progress Reports) requires the following to be fully functional from Phase 2:

- The dashboard layout shell is stable and all navigation routes are present — Phase 3 will replace the Enter Marks and View Marks placeholder pages with real implementations
- Student records exist in the database and are retrievable via GET /api/students and GET /api/students/[id] — marks entry requires knowing which students to enter marks for
- ClassGroup records are seeded — marks entry is scoped to a specific class group
- SystemConfig contains academic year and elective category labels — mark entry uses academic year as the default MarkRecord year, and the marks entry grid uses elective labels to label subject columns
- The AuditLog collection and the utility function for writing audit entries are complete — Phase 3 will use the same pattern for logging mark entry actions
- The student profile page placeholder for the performance bar chart must be sized and positioned correctly so Phase 4 can replace it without layout changes
- The W-rule display utility used in the student profile marks table must be a reusable function so Phase 3 (which also needs W-rule logic in mark entry) can import it
- Role enforcement utilities and Zod schema patterns established in Phase 2 are reused without modification in Phase 3 routes

---

*End of Phase 2 Overview Document*
