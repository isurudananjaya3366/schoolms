# Phase 3: Marks Entry and Progress Reports

**Document Version:** 1.0  
**Phase Number:** 3  
**Recommended Task Documents:** 4  
**Last Updated:** 2026-03-11  
**Status:** Ready for Implementation

---

## Phase Summary

Phase 3 builds the core academic record-keeping and reporting layer of the SchoolMS system. It delivers the Mark Entry interface (the most frequently used page in the entire application), the View Marks browser, the W-Rule utility library, the Progress Report PDF generation pipeline, and all supporting API routes. This phase transforms the system from a student management tool into a fully operational school academic management system.

Phase 3 builds directly on Phase 1 (project foundation, database models, authentication, middleware, system configuration) and Phase 2 (admin dashboard shell, student management). The MarkRecord model and SystemConfig model — both defined in Phase 1 — are consumed heavily throughout this phase. The student list APIs and class/grade data structures from Phase 2 are prerequisites for the mark entry data grid. The settings page from Phase 2 (which stores elective category labels in SystemConfig) directly feeds the subject selector in mark entry and all report outputs.

By the end of Phase 3, the system can accept marks for any student across any grade, class, term, and subject; persist them in the database; display them with the W-rule applied; and produce a formatted PDF progress report for any student that can be downloaded or printed.

---

## Phase Scope

### Covered in This Phase

- The W-Rule utility library (lib/w-rule.ts) — the core business rule governing mark display throughout the entire application
- Mark Entry page (/dashboard/marks/entry) — the interactive data grid for entering and saving marks
- View Marks page (/dashboard/marks/view) — the read-only marks browser with filtering and CSV export
- Progress Reports page (/dashboard/reports) — student report preview, PDF download, and print functionality
- PDF progress report layout and server-side generation using @react-pdf/renderer
- API routes: GET /api/marks, POST /api/marks, PATCH /api/marks/batch, GET /api/reports/[studentId]
- Audit logging for MARK_UPDATED and REPORT_VIEWED events
- Zod-based server-side validation for all mark input
- Dirty state tracking and unsaved changes warning in Mark Entry

### Out of Scope for This Phase

- Class analytics and aggregate statistics (Phase 4)
- Infographic-style subject performance visualizations (Phase 4)
- Preview mode slide deck or animated report presentations (Phase 4)
- Backup and restore functionality (Phase 5)
- Role-based access control differentiations beyond what NextAuth.js middleware already provides (Phase 5 hardening)
- Bulk student import or bulk marks import via file upload (not planned)
- Email delivery of reports (not planned)

---

## Phase Goals — Acceptance Criteria

A successful Phase 3 implementation satisfies all of the following:

1. A user can select a grade, class, term, and subject and see a data grid with one row per student in that class, pre-populated with any existing marks for that selection.
2. Entering a mark value and clicking Save persists the mark to the database via the batch API route, and a success toast confirms the save.
3. Attempting to navigate away from Mark Entry with unsaved changes triggers a browser warning.
4. Values below 35 display a yellow caution indicator in the mark entry grid cell, but the stored value remains numeric.
5. The View Marks page displays marks with the W-rule applied — any mark below 35 is shown as "W".
6. The View Marks page supports filtering by student, grade, class, term, and year, and the resulting data can be exported as a CSV file.
7. Clicking "Download PDF" on a student's report triggers the PDF generation API, which returns a valid PDF file that downloads in the browser.
8. The PDF progress report contains the student's details, all marks across three terms, W-rule applied to all marks, and a W-Note section listing subjects with W grades where applicable.
9. Elective category labels in all views and reports are resolved from SystemConfig — they do not hardcode "Category I/II/III".
10. All mark inputs are validated server-side: only integers 0–100 or null are accepted; Zod reject anything else with a 400 response.
11. Audit log entries are written for every mark that changes value (MARK_UPDATED) and every report download (REPORT_VIEWED).
12. The system handles database unavailability gracefully, showing error states rather than crashing.

---

## Phase Prerequisites

The following must be fully functional before Phase 3 implementation begins:

- Next.js 14 project is running with TypeScript, Tailwind CSS, and shadcn/ui configured.
- Prisma is connected to MongoDB Atlas and all five models (User, ClassGroup, Student, MarkRecord, SystemConfig) are defined and synced.
- NextAuth.js v5 is configured with session handling and the middleware protects all /dashboard routes.
- The admin dashboard layout (sidebar, topbar, role-aware navigation) is operational.
- The student list page and student data APIs (GET /api/students, GET /api/students/[id]) are working.
- The Settings page has been implemented and is writing elective category label names to SystemConfig. The three elective label fields must be readable from SystemConfig in Phase 3.
- The ClassGroup model contains records for all grades (6–11) and classes (A–F). The student management phase must have created these or a seed script must have populated them.
- The AuditLog model and its write utility (from Phase 2 or Phase 1) is operational and being used correctly.
- Toast notifications (using shadcn/ui's toast or sonner) are set up in the layout.

---

## The W-Rule: Core Business Rule

### What the W-Rule Is

The W-Rule is the most important business rule in the SchoolMS system. It governs how marks are displayed to users, teachers, and in printed reports. The rule states: any raw mark that is strictly less than 35 must be displayed as the letter "W" rather than its numeric value in all report and view contexts.

The threshold value is 35 and must be defined as a single named constant (W_THRESHOLD) inside the utility file lib/w-rule.ts. This constant must be referenced by all W-rule logic — never hardcode the number 35 anywhere else in the codebase. If the threshold needs to change in the future, it changes in exactly one place.

### Why the W-Rule Exists

In the Sri Lankan secondary school grading system used by the target schools, a mark below 35 indicates that a student has failed to meet the minimum competency threshold for a subject. Such marks are traditionally recorded as "W" (which stands for "Weak" in this context) on official progress reports and report cards. The raw numeric value is retained for administrative purposes, statistical analysis, and teacher records, but the student-facing and parent-facing documents always show "W" instead of the number.

This separation between stored value and displayed value is intentional and must be rigorously maintained. If the raw value were stored as "W" (a string), it would break all average calculations and data exports. If the display value were ever numeric below 35, it would violate school policy regarding official reports.

### Where the W-Rule Applies

The following matrix defines precisely where the W-rule is and is not applied:

| Context | W-Rule Applied | Reason |
|---|---|---|
| Database storage (MarkRecord) | Never | Raw integer always stored |
| Mark Entry input grid | Never | Teacher must see and edit the actual number |
| Yellow caution indicator in Mark Entry | N/A | Visual only; not W conversion |
| Student Profile marks table | Yes | Student-facing view |
| View Marks page table | Yes | Reviewer-facing view |
| PDF Progress Report | Yes | Official document |
| Preview Mode slides (Phase 4) | Yes | Student-facing presentation |
| Analytics average calculations (Phase 4) | Never | Math must use raw values |
| CSV export — display column | Yes | When exporting display values |
| CSV export — raw column | Never | Raw export retains numeric values |

### The Three Utility Functions in lib/w-rule.ts

The utility file exposes three functions. All three must be pure functions with no side effects.

**applyWRule(mark)**

This is the primary display function used everywhere marks are rendered. It accepts a single argument: a number, null, or undefined. The return value is always a string.

- If the argument is null or undefined, it returns a dash character (—) to indicate no mark has been entered for this subject in this term.
- If the argument is a number strictly less than W_THRESHOLD (35), it returns the string "W".
- If the argument is a number greater than or equal to W_THRESHOLD, it returns the numeric value converted to a string.

This function handles all three cases in render logic, so the calling code never needs to branch on "is it null, is it W, or is it a number" — applyWRule handles all of that.

**isWMark(mark)**

This function returns a boolean. It accepts a number, null, or undefined. It returns true if the argument is a non-null, non-undefined number that is strictly less than W_THRESHOLD. It returns false for null, undefined, or any number >= W_THRESHOLD. This function is used in contexts where the code needs to conditionally apply styling or logic based on whether a mark qualifies as a W, without needing the display string itself.

**getWSubjects(marks, electives)**

This function is used exclusively during progress report generation to produce the W-Note section. It accepts two arguments: a Marks object containing all subject fields (as they exist in the MarkRecord model) and an Electives object containing the resolved display labels for the three elective categories from SystemConfig.

The function iterates over all 9 subject fields in the Marks object. For each field, it checks whether the mark value satisfies isWMark. If it does, it resolves the subject's human-readable display name — using the plain subject name for the 6 core subjects and using the label from the Electives object for the 3 elective category fields. It returns an array of these resolved display name strings.

The returned array is used in the PDF report to render the sentence listing all subjects in which the student has W grades. If the returned array is empty, the W-Note section is omitted from the report entirely.

---

## Mark Entry Page Design

### Overview

The Mark Entry page at /dashboard/marks/entry is the primary daily-use interface for teachers and administrators entering student marks into the system. It is a client component with interactive filter controls and a live data grid. It must perform well with up to 40 students per class.

### Filter Selectors

The page presents four filter selectors at the top, arranged horizontally in a filter bar. The user must complete all four selections before the data grid renders.

**Grade Selector** — A dropdown containing grades 6 through 11. This is a static list; no API call is needed to populate it.

**Class Selector** — A dropdown containing class letters A through F. It is filtered dynamically: when the grade changes, the class selector resets to empty. In practice the class labels A–F are the same for all grades, but the ClassGroup records are grade-specific, so the selected grade and class together identify a unique ClassGroup record. The class selector should remain disabled until a grade is selected.

**Term Selector** — A dropdown with three options: Term I, Term II, and Term III. Internally represented as the values 1, 2, and 3.

**Subject Selector** — A dropdown that presents 9 subjects in a defined order. The first 6 are the core subjects: Sinhala, Buddhism, Mathematics, Science, English, and History. These labels are static. The last 3 are the elective categories. These must be resolved from SystemConfig: ElectiveCategoryI, ElectiveCategoryII, and ElectiveCategoryIII. The selector should show the configured label names, not "Category I/II/III". The subject selector must fetch the current SystemConfig on page load to obtain these labels and must not render the subject dropdown until this config has loaded.

### Data Grid Component Design

Once all four filter selections are made, the data grid renders below the filter bar. The grid is a table-like component with the following structure:

- One row per student in the selected ClassGroup, sorted by index number ascending.
- Columns: Index Number, Student Full Name, Mark Input.
- The Mark Input column contains a numeric text input field per row. It accepts integer values 0–100. Any value outside this range or any non-integer string causes the input to be visually highlighted with a red border.
- Values that are numeric but less than 35 trigger a yellow caution indicator. This can be implemented as a yellow background on the input cell, a warning icon beside the field, or a yellow border — the exact visual treatment is up to the implementer, but it must be visible and non-intrusive. This is purely a UI affordance to alert the teacher that a low mark has been entered; it carries no semantic meaning for the stored data.
- The grid displays a loading skeleton while the student list and existing marks are being fetched.

### Pre-Population Logic

When the data grid loads for a given grade/class/term/subject selection, it must pre-populate any existing marks into the input fields. The implementation must fetch the student list for the ClassGroup in parallel with the existing marks for the ClassGroup + term + year + subject combination. These two datasets are then merged on studentId: for each student, if a matching MarkRecord exists and contains a value for the selected subject field, that value is loaded into the input as the initial value.

Students who do not yet have a mark record for the selection start with an empty input field, not zero.

### Dirty State Tracking

The component maintains a dirty map — a dictionary keyed by studentId with a value equal to the current input value for that student. A studentId is added to the dirty map the first time its input changes from its initial loaded value. A studentId is removed from the dirty map if the user reverts to the original loaded value.

Only entries present in the dirty map are included in the batch save request. This means a save operation on a 40-student class where only 3 marks were changed sends exactly 3 entries to the API, not 40.

### Unsaved Changes Warning

The component attaches a beforeunload event listener to the window when the dirty map is non-empty. When the user tries to close the tab, navigate away, or refresh while there are unsaved changes, the browser displays its native "You have unsaved changes" dialog. This listener must be cleaned up (removed) when the component unmounts.

In addition, for in-app navigation (using Next.js router), the component should visually warn the user with a confirmation dialog before navigating away. This can be implemented using a custom navigation guard or by displaying a modal prompt.

---

## Mark Entry State Management and Data Fetching

### Component Architecture Decision

The Mark Entry page must be a client component (marked with "use client" in Next.js 14 terms). It cannot be a server component because it manages interactive state: the filter selections, the dirty map, the input values, and the unsaved changes guard all require client-side React state.

However, the page can use a server component as a shell for the layout and pass the current user session as a prop to the client component, avoiding an additional session fetch on the client.

### Data Fetching Strategy

Two separate fetch calls are initiated when all four filter selections are made:

1. Fetch the student list for the selected ClassGroup by calling the student list API filtered by classId. This returns an ordered array of student objects including at minimum: studentId, indexNumber, and fullName.

2. Fetch existing marks by calling GET /api/marks with query parameters for classId, term, year, and subject. The year parameter should default to the current academic year (derived from SystemConfig or the current calendar year).

These two fetches should be parallelized using Promise.all so the grid is ready as soon as both complete rather than sequentially.

The merged data structure is then an array of objects, one per student, each containing: studentId, indexNumber, fullName, and initialMark (the existing mark value, or null if none exists). The input fields render from this merged array.

### SystemConfig Fetch

The subject selector also requires a SystemConfig fetch to resolve elective labels. This fetch should happen once on component mount, independently of the filter selections. The elective labels are stored in state and used to populate the subject dropdown options and to label columns in the data grid and reports.

---

## Batch Save Operation

### What Gets Sent

When the user clicks Save, the component constructs the batch request body from the dirty map. The body is an object containing:

- classId: the identifier of the selected ClassGroup
- term: the selected term number (1, 2, or 3)
- year: the current academic year
- subject: the internal field name of the selected subject as it exists in the MarkRecord Marks type
- entries: an array of objects, one per dirty entry, each containing studentId and the new mark value (an integer 0–100, or null if the input was cleared)

This body is sent as a PATCH request to /api/marks/batch.

### Idempotent Upsert Logic

The batch API route processes each entry in the entries array individually. For each entry:

- The route queries whether a MarkRecord already exists for the given studentId + term + year combination.
- If a MarkRecord exists, the route performs an update operation on that record, setting only the specific subject field to the new value. All other subject fields in the record are left unchanged.
- If no MarkRecord exists, the route creates a new MarkRecord with the given studentId, term, year, classId, and the specific subject field set to the provided value. All other subject fields are initialized to null.
- In both cases, the updatedBy field of the MarkRecord is set to the acting user's ID, retrieved from the NextAuth.js session on the server.

This upsert design is idempotent: sending the same batch twice produces the same database state.

### Audit Logging

For each entry in the batch, the route must compare the new mark value to the old mark value (read from the existing record, if any). If the values differ, an AuditLog entry is written with:

- action: MARK_UPDATED
- userId: the acting user's ID from session
- details: an object containing the subject field name, the old value (null if no record existed), the new value, the studentId, the term, the year, and the classId.

If the new value equals the existing value, no audit entry is written for that entry. This prevents audit log pollution from no-op saves.

### Client-Side After Save

After a successful save (HTTP 200), the component:

1. Clears the dirty map entirely.
2. Updates the initialMark for all entries that were saved so that the pre-populated values reflect the new saved state.
3. Shows a success toast notification.
4. Removes the beforeunload warning (since there are no more unsaved changes).

If the API returns an error, the component shows an error toast with the server's error message. The dirty map is not cleared, allowing the user to retry without re-entering changes.

---

## Mark Data Validation

### Client-Side Validation

The Mark Entry component validates inputs as the user types. A mark input is considered invalid if:

- It contains any non-numeric characters (excluding an empty string, which represents a cleared mark).
- It is a decimal number rather than an integer.
- Its integer value is less than 0 or greater than 100.

Invalid inputs are highlighted with a red visual indicator. The Save button should be disabled if any input in the dirty map is currently in an invalid state.

### Server-Side Zod Validation

The PATCH /api/marks/batch route validates the entire request body using a Zod schema before performing any database operations. The schema asserts:

- classId is a non-empty string.
- term is an integer in the set {1, 2, 3}.
- year is an integer representing a plausible academic year (e.g., between 2000 and 2100).
- subject is one of the 9 known subject field names.
- entries is a non-empty array.
- Each entry contains a studentId (non-empty string) and a mark value that is either null or an integer between 0 and 100 inclusive.

If the schema validation fails, the route returns HTTP 400 with a JSON body containing a message field and a details array listing each validation error. The client displays the message from this response in the error toast.

If validation passes, no database writes have occurred yet at the point of validation failure — the Zod check is a gate before any I/O.

### Error Response Shape

All API error responses from marks and reports routes follow a consistent shape: an object with a message string (human-readable summary) and an optional details array (for validation errors with field-level specifics). HTTP status codes are used semantically: 400 for client errors, 401 for unauthenticated, 403 for forbidden, 404 for not found, 500 for internal server errors.

---

## View Marks Page Design

### Purpose and Audience

The View Marks page at /dashboard/marks/view serves as a read-only audit and review interface. It is used by school administrators to verify entered data, review a student's academic history, and produce quick CSV exports. Unlike Mark Entry, this page always shows marks with the W-rule applied.

### Filter Controls

The page presents a filter bar with the following controls:

- Student Search: A text input that searches by student name or index number. As the user types, results are debounced and a dropdown of matching students appears. Selecting a student from the dropdown pins that student as a filter.
- Grade: A dropdown (6–11). When combined with Class, identifies a ClassGroup.
- Class: A dropdown (A–F), dependent on Grade.
- Term: A dropdown (I, II, III), for selecting which term to display.
- Year: A dropdown of previous and current academic years.

The filters can be used in combination. A common use case is selecting a grade and class to see all students' marks for a specific term. Another common use is searching for a single student to see all marks across all terms.

### Table Layout

When a grade and class are selected with a term, the table renders with:

- Rows: one per student in the ClassGroup, sorted by index number.
- Columns: Index Number, Student Name, and one column per subject (9 subjects total, with elective labels resolved from SystemConfig).
- Each cell shows the result of applyWRule applied to the stored mark: "W" for below 35, "—" for null/no mark, or the numeric string for valid marks.

When a single student is selected, all three terms are shown side by side. The table structure changes to: one row per subject, columns for Term I, Term II, Term III. Each cell shows the W-rule-applied value.

### CSV Export

A CSV Download button is present whenever data is displayed in the table. Clicking it triggers a client-side CSV generation from the currently rendered dataset. The CSV includes all rows and columns visible in the table. Marks in the CSV are the display values (W-rule applied), not raw numbers. The filename includes the class name, term, and year for easy identification.

---

## MarkRecord Data Model Deep Dive

### Structure

The MarkRecord model stores all marks for a single student for a single term and year. The marks are stored in an embedded Marks sub-document with individual fields for each of the 9 subjects:

- 6 core subject fields: sinhala, buddhism, mathematics, science, english, history
- 3 elective fields: electiveI, electiveII, electiveIII

All 9 fields are of type integer and are nullable. A null value means no mark has been entered for that subject in that term for that student. A value of 0 is a valid mark (representing a score of zero, not an absence of data). This distinction is important: the client must transmit null to clear a mark, not 0.

The MarkRecord also stores: studentId (reference to Student), classId (reference to ClassGroup), term (1/2/3), year (integer), updatedBy (reference to User, the last user to update the record), and timestamps.

### Batch Upsert Field Targeting

Because the MarkRecord holds all 9 subjects for a student-term-year combination in a single document, the batch upsert operation must perform a targeted field update. When processing a batch for subject "mathematics", the route must update only the mathematics field within the Marks sub-document, leaving sinhala, buddhism, science, english, history, and all elective fields unchanged.

This field-level update is critical for correctness: if the system wrote the entire Marks sub-document on each save, a teacher entering only mathematics marks could inadvertently overwrite another teacher's previously entered sinhala marks with null. The batch operation must use Prisma's nested update syntax to target only the one subject field included in the batch.

### updatedBy Audit Field

The updatedBy field tracks who last modified the record. It is always overwritten with the current session user's ID on every batch save, regardless of which subject was changed. This provides a lightweight last-modified-by indicator at the document level. For full field-level audit history, the AuditLog collection must be consulted.

---

## Progress Report Data Composition

### Data Required for a Full Report

Generating a complete progress report for a student requires assembling the following data:

- Student record: fullName, indexNumber, grade, class group details (for the class label), and academic year.
- School identity: school name and school logo URL, both read from SystemConfig.
- Elective category labels: read from SystemConfig — the same labels used in mark entry.
- Three MarkRecord documents: one for each of Term I, II, and III, for the student's current academic year. If a term's MarkRecord does not exist, that term's marks are all displayed as "—" in the report.
- W-rule application: applyWRule is called on every mark value before it is passed to the PDF renderer.
- W-subjects list: getWSubjects is called for each term's marks to build the W-Note.

### W-Note Generation

The W-Note is an automatically generated section that lists every subject and term combination where the student has a W grade. The process is:

1. For each of the three terms, call getWSubjects with the term's Marks object and the resolved elective labels. This returns an array of subject display names.
2. If any of the three terms return a non-empty array, the W-Note section is included in the report.
3. The W-Note renders as a structured list: for each subject that has at least one W, list the subject name and which term(s) it occurred in.

The W-Note is intended to help parents and form teachers quickly identify areas of concern without scanning the entire marks table.

### Elective Label Resolution

The three elective subject fields in MarkRecord are named electiveI, electiveII, and electiveIII. In all views and reports, these field names must never appear. Instead, their human-readable labels from SystemConfig are used. The SystemConfig must be fetched as part of the report data assembly. If SystemConfig is missing or a label is not configured, a fallback label of "Elective I", "Elective II", "Elective III" respectively should be used to prevent empty cells in the report.

---

## PDF Report Layout Design

The PDF is generated as a structured document using @react-pdf/renderer. The document is composed of five distinct sections rendered top to bottom.

### Section 1: Header

The header spans the full page width. The school logo (if configured in SystemConfig) appears on the left as an image. The school name appears beneath the logo in a larger font. On the right side of the header, "Progress Report" appears as the main title in a prominent, bold font. The academic year is displayed below the title in a smaller font. A horizontal rule separates the header from the rest of the document.

If no school logo is configured, the left side shows only the school name, and the layout remains balanced.

### Section 2: Student Information Bar

A compact information bar appears immediately below the header. It displays four fields in a horizontal row: Index Number, Full Name, Grade, and Class. These are presented as label-value pairs. This section gives the reader immediate identification context without taking up significant vertical space.

### Section 3: Marks Table

The marks table is the central element of the report. Its structure is:

- Rows: one per subject, in a fixed order — the 6 core subjects first, then the 3 elective subjects.
- Columns: Subject Name, Term I, Term II, Term III.
- Each data cell displays the result of applyWRule for the corresponding mark: "W" for below 35, "—" for null, or the numeric string for valid marks.
- The Subject Name column displays the resolved human-readable label (including elective labels from SystemConfig).
- Column headers and the subject name column use a slightly darker background to visually separate them from data cells.
- Cells containing "W" may optionally use a different text color (e.g., a muted red or amber) to draw visual attention, but must remain legible in monochrome printing.

### Section 4: W-Note Section

This section is conditionally rendered — it only appears if at least one subject in any term has a W grade. It begins with a bold heading: "Subjects with W grades:". Below this heading, a list presents each subject that has a W grade and identifies which term(s) it occurred in. The tone of this section is informational and neutral; it is a factual summary of W occurrences, not a disciplinary note.

### Section 5: Footer

The footer is fixed at the bottom of the page. It contains: the report generation date and time (formatted in a readable locale string), and the statement "Generated by SchoolMS". A horizontal rule separates the footer from the content above.

---

## PDF Generation Flow

### Server-Side Pipeline

The PDF is generated entirely server-side within the GET /api/reports/[studentId] route handler. The pipeline executes in the following sequence:

1. The route handler authenticates the request by verifying the NextAuth.js session. Unauthenticated requests receive HTTP 401.
2. The studentId path parameter is validated. If no student with that ID exists, the route returns HTTP 404.
3. The route fetches all required data in parallel: the student record, the SystemConfig (for school name, logo, and elective labels), and all three MarkRecord documents for the student's current year.
4. The W-rule is applied to every mark value using applyWRule. The W-subjects for each term are computed using getWSubjects.
5. A report data object is assembled containing all formatted values ready for the PDF component tree.
6. The PDF document is rendered using @react-pdf/renderer's renderToBuffer function (or equivalent), which processes the React component tree into a binary PDF buffer.
7. The response is returned with Content-Type: application/pdf and Content-Disposition: attachment; filename="report-[indexNumber]-[year].pdf". The binary buffer is sent as the response body.

### Streaming and Response Headers

The Content-Disposition header must specify the filename so that the browser saves the file with a meaningful name rather than a generic one. The filename should incorporate the student's index number and the academic year so that multiple downloaded reports remain identifiable on the user's file system.

The route sets Cache-Control: no-store on the response to prevent caching of report PDFs, since these documents may be regenerated with updated marks.

### Audit Logging

After successfully generating the PDF (or at the point of completion before streaming), the route writes a REPORT_VIEWED audit log entry with: action REPORT_VIEWED, the acting user's ID, and the studentId. This entry is written even when the response is a streaming PDF, so the write must occur before the buffer is sent.

---

## Progress Reports Page Design

### Student Search

The /dashboard/reports page opens with a student search interface. A search input accepts student name or index number. As the user types (debounced), a list of matching students is fetched from the student API and displayed below the input as selectable rows. Each row shows the student's index number, name, grade, and class for easy identification.

### Report Preview

When a student is selected from the search results, a report preview panel renders. This preview shows the report content in the browser. The implementation can use an embedded PDF preview (by fetching the PDF and rendering it in an iframe or using the browser's native PDF renderer), or alternatively, the same data can be rendered as an HTML replica of the report layout using standard DOM elements styled to match the PDF.

The preview provides a "what you'll get" confirmation before the user downloads or prints.

### Download and Print

Two action buttons are present once a student is selected:

- Download PDF: Triggers a GET request to /api/reports/[studentId]. The browser receives the PDF with the attachment Content-Disposition header and saves it to the user's download folder.
- Print: Triggers window.print() on the preview panel. The print stylesheet (defined in the global CSS or as a media query) should ensure only the report content is printed, hiding the navigation and action buttons.

### Recent Reports

A "Recent Reports" section appears below the search area. It displays the last 10 REPORT_VIEWED audit log entries, showing: timestamp, student name, student index number, and the user who generated the report. This section helps administrators track report usage and quickly re-generate recently requested reports by clicking on a row to re-select that student.

---

## API Routes Reference for Phase 3

### GET /api/marks

This route retrieves MarkRecord data from the database. It accepts the following query parameters: studentId (optional), classId (optional), term (optional, integer 1–3), year (optional, integer), and subject (optional, one of the 9 subject field names).

When classId is provided without a studentId, the route returns all MarkRecord documents for students in that ClassGroup matching the given term and year. When studentId is provided, the route returns all MarkRecords for that student (optionally filtered by term and year). The response is a JSON array of MarkRecord objects. All marks in the response are raw values — no W-rule is applied server-side.

Authentication: Any authenticated session (all roles) may call this route.

### POST /api/marks

This route creates or updates a single MarkRecord for a specific student, term, and year. It is an idempotent upsert: if a MarkRecord already exists for the studentId + term + year combination, it is updated; otherwise, a new one is created.

The request body must contain: studentId, term, year, classId, and a marks object with the subject fields to set. The route validates the body with Zod. On success, it returns HTTP 200 with the upserted MarkRecord. This route is available for cases where fine-grained single-student updates are needed outside of the batch flow. Authentication: Any authenticated role.

### PATCH /api/marks/batch

This is the primary mark-saving route used by the Mark Entry page. The request body contains classId, term, year, subject, and entries — an array of studentId and mark value pairs.

The route validates the full body with Zod before any database I/O. For each entry, it performs a targeted field-level upsert on the MarkRecord for that studentId + term + year, updating only the specified subject field. Audit log entries are written for any marks that actually changed. The route processes all entries and returns HTTP 200 with a summary of how many records were created versus updated. On partial failure (e.g., one entry fails database write), the route returns HTTP 207 Multi-Status with individual entry results. On complete validation failure, it returns HTTP 400.

Authentication: Any authenticated role.

### GET /api/reports/[studentId]

This route generates and returns a PDF progress report for the specified student. The studentId is extracted from the dynamic route segment.

The route fetches the student record, SystemConfig, and all three MarkRecords for the student's current year. It applies the W-rule, computes the W-Note list, and renders the PDF document using @react-pdf/renderer. The response is a binary PDF file with appropriate headers (Content-Type: application/pdf, Content-Disposition: attachment with a filename, Cache-Control: no-store).

If the student does not exist, HTTP 404 is returned. If the PDF rendering fails due to a library error, HTTP 500 is returned with a JSON error body (not a partial PDF). Authentication: Any authenticated role.

---

## Audit Logging in Phase 3

### MARK_UPDATED Entry

A MARK_UPDATED audit log entry is written by the PATCH /api/marks/batch route for every entry in the batch where the new mark value differs from the existing mark value. The entry contains:

| Field | Value |
|---|---|
| action | MARK_UPDATED |
| userId | The ID of the authenticated user making the request |
| targetId | The studentId whose mark was changed |
| details.subject | The internal subject field name (e.g., "mathematics") |
| details.oldValue | The previous mark value (null if no record existed) |
| details.newValue | The new mark value (null if the mark was cleared) |
| details.term | The term number (1, 2, or 3) |
| details.year | The academic year |
| details.classId | The ClassGroup identifier |
| timestamp | Server-generated UTC timestamp |

This entry is only written when oldValue !== newValue. A save that doesn't change any values writes no audit entries.

### REPORT_VIEWED Entry

A REPORT_VIEWED audit log entry is written by the GET /api/reports/[studentId] route each time a PDF is successfully generated. The entry contains:

| Field | Value |
|---|---|
| action | REPORT_VIEWED |
| userId | The ID of the authenticated user who requested the report |
| targetId | The studentId for whom the report was generated |
| timestamp | Server-generated UTC timestamp |

This entry enables the Recent Reports list on the /dashboard/reports page and provides an access audit trail.

---

## Offline and Error States

### Database Unavailability during Mark Entry

If the database is unreachable when the Mark Entry page attempts to fetch the student list or existing marks, the data grid renders an error state instead of a loading skeleton. The error state displays a descriptive message and a Retry button. The filter selectors remain functional so the user can change their selection and attempt a new fetch.

If the database becomes unavailable after the grid has loaded (i.e., during a Save operation), the batch API route returns HTTP 500. The client shows an error toast. The dirty map is retained so the user can retry when connectivity is restored. The unsaved changes warning remains active.

### Database Unavailability during Report Generation

If the database is unavailable during the GET /api/reports/[studentId] request, the route returns HTTP 500 with a JSON error body. The client on the /dashboard/reports page displays the error in a toast and the download button becomes re-clickable after a short delay to allow the user to retry.

The PDF rendering itself (the @react-pdf/renderer step) can fail independently of the database — for example, if the school logo URL is inaccessible. The route should handle this by catching the rendering error, logging it server-side, and returning HTTP 500 with an error message. The logo should be treated as optional: if it fails to load, the PDF is generated without it rather than failing entirely.

### View Marks Page Error States

If the View Marks page cannot retrieve marks for a selected filter combination, it renders an empty state with a message indicating no marks were found. This should be visually distinct from a loading state to avoid confusion. If the fetch itself fails (network or server error), an error message with a Retry button is displayed.

---

## Recommended Task Documents

Phase 3 should be implemented across 4 task documents, each focused on a coherent unit of work. This division respects the dependency order between pieces and keeps each task self-contained.

### Task 1 — W-Rule Utility and Mark Data API Routes

**Scope:** Implement the lib/w-rule.ts utility file with all three functions and the W_THRESHOLD constant. Implement all three API routes: GET /api/marks, POST /api/marks, and PATCH /api/marks/batch, including Zod validation, upsert logic, audit logging, and error responses.

**Rationale:** The W-rule utility is a zero-dependency leaf module that everything else in Phase 3 uses. The API routes are the server-side foundation that all UI components depend on. Building these first means subsequent tasks can be implemented against working endpoints rather than mocks.

**Complexity:** Medium-High. The batch upsert route involves careful field-level update logic and audit comparison logic.

### Task 2 — Mark Entry Page

**Scope:** Implement the /dashboard/marks/entry page as a client component. This includes: filter selectors (grade, class, term, subject with SystemConfig elective labels), the data grid with pre-population logic, dirty state tracking, yellow caution indicators, the Save operation calling the batch API, success/error toasts, and the beforeunload unsaved changes warning.

**Rationale:** This is the most complex UI component in Phase 3 — it involves parallel data fetching, state merging, and real-time input validation. It depends entirely on Task 1's API routes.

**Complexity:** High. The data grid state management and UX edge cases (dirty tracking, pre-population, caution indicators) require careful implementation.

### Task 3 — View Marks Page

**Scope:** Implement the /dashboard/marks/view page. This includes all filter controls, the marks table with W-rule applied, the single-student multi-term view, and the CSV export functionality.

**Rationale:** This page is read-only and simpler than Mark Entry, but it involves its own filter/fetch/display logic. It is a natural follow-on to Task 2 and uses the same API routes.

**Complexity:** Medium. The multi-term view layout requires careful table design, but the state management is straightforward compared to Task 2.

### Task 4 — PDF Progress Report and Reports Page

**Scope:** Implement the GET /api/reports/[studentId] route including data assembly, W-rule application, W-Note computation, and @react-pdf/renderer-based PDF generation with all 5 layout sections. Implement the /dashboard/reports page including student search, report preview, download, print, and recent reports list. Include REPORT_VIEWED audit logging.

**Rationale:** The PDF generation pipeline is self-contained and does not depend on Tasks 2 or 3, only on Task 1's data models and the W-rule utility. The reports page wraps the API in a user-facing interface.

**Complexity:** High. Server-side PDF rendering with @react-pdf/renderer requires careful layout structuring, and the reports page involves a multi-step UI flow.

---

## Phase Completion Checklist

Use the following checklist to confirm Phase 3 is complete before proceeding to Phase 4:

- [ ] lib/w-rule.ts is implemented with W_THRESHOLD, applyWRule, isWMark, and getWSubjects functions
- [ ] GET /api/marks route is implemented and returns raw mark data for given filters
- [ ] POST /api/marks route is implemented with Zod validation and upsert logic
- [ ] PATCH /api/marks/batch route is implemented with field-level upsert, audit logging, and Zod validation
- [ ] Mark Entry page loads with filter selectors and resolves elective labels from SystemConfig
- [ ] Mark Entry data grid pre-populates existing marks on load
- [ ] Mark Entry dirty state tracking works — only changed entries are sent in the batch
- [ ] Yellow caution indicator appears for marks < 35 in Mark Entry (not W, purely visual)
- [ ] Save operation calls batch API, shows success toast, clears dirty state
- [ ] Unsaved changes trigger beforeunload warning
- [ ] View Marks page filters work and table shows W-rule-applied values
- [ ] Single-student multi-term view is implemented in View Marks
- [ ] CSV export downloads in View Marks
- [ ] GET /api/reports/[studentId] generates a valid PDF with all 5 sections
- [ ] W-Note section appears only when W grades exist, and lists correct subjects
- [ ] PDF includes school name (from SystemConfig) and logo if configured
- [ ] Content-Type and Content-Disposition headers are correct on PDF response
- [ ] REPORT_VIEWED audit log entry is written on every PDF generation
- [ ] MARK_UPDATED audit log entries are written for each changed mark value
- [ ] /dashboard/reports student search, preview, download, and print all work
- [ ] Recent Reports section shows last 10 REPORT_VIEWED entries
- [ ] All error states (database unavailable, student not found) handled gracefully
- [ ] Sidebar navigation links to /dashboard/marks/entry, /dashboard/marks/view, and /dashboard/reports

---

## Dependencies for Phase 4

Phase 4 (Analytics, Infographics, and Preview) builds directly on Phase 3 outputs. The following Phase 3 elements are direct dependencies for Phase 4:

- The GET /api/marks route is extended or supplemented in Phase 4 with aggregation endpoints for class-level and subject-level averages.
- lib/w-rule.ts, specifically its raw-value preservation guarantees, must be in place so Phase 4 analytics calculations operate on correct numeric data.
- The MarkRecord data model (all 9 subject fields fully populated) feeds Phase 4 visualizations.
- The elective label resolution pattern established in Phase 3 (reading from SystemConfig) is reused in all Phase 4 chart labels and slide titles.
- The PDF layout structure from Task 4 informs the visual design of the Phase 4 report preview slides.
- The REPORT_VIEWED and MARK_UPDATED audit entries from Phase 3 may be surfaced in Phase 4's activity dashboard section.

Phase 4 must not begin until all Phase 3 completion checklist items are resolved.

---

*End of Phase 3 Overview Document*
