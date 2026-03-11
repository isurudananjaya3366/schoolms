# Phase 3, Task 4 — PDF Progress Report and Reports Page

## Overview and Purpose

The Progress Report is the primary formal deliverable of SchoolMS. It is a structured PDF document generated on demand for each student, summarising their academic performance across all three terms of the school year. The document follows the same W-rule display logic used on the View Marks page, so all marks are presented consistently whether a user is viewing them on-screen or in print. Students who received warning marks in any term are given an additional section inside the PDF — the W-Note — which lists the affected subjects and terms and carries a standard advisory message.

This task is split into two major, independently testable units. The first is a server-side API route at GET /api/reports/[studentId] that assembles data from the database, applies all display rules, instantiates the React PDF template, and streams the rendered PDF as a binary HTTP response. The second is a client-side Reports Page at /dashboard/reports where authorised users can search for a student, select an academic year, preview the rendered report in an embedded frame, and trigger a browser download or print. Both parts must be completed together because the page depends entirely on the API route for its data.

---

## Pre-requisites and Dependencies

Before beginning this task, the following earlier work must be complete and stable:

Phase 1 Task 1 must have installed the @react-pdf/renderer package at version 3 as part of the initial dependency setup. If for any reason this was omitted, it must be added before any PDF template code is written.

Phase 1 Task 2 must have defined the MarkRecord and AuditLog Prisma models in the schema and migrated them to MongoDB Atlas. The MarkRecord model must carry the fields expected in this task: studentId, year, term, and the nine mark fields (english, mathematics, science, history, geography, informationTechnology, elective1, elective2, elective3). The AuditLog model must carry action, performedBy, targetType, targetId, metadata, and createdAt.

Phase 2 Task 4 must have established the SystemConfig model and populated it with the electiveLabels array (a three-element string array), schoolName, and the academicYear or currentYear field. The lib/audit-actions.ts helper file introduced in Phase 2 must be available, as this task adds the REPORT_VIEWED constant to it.

Phase 3 Task 1 must have delivered the applyWRule and getWSubjects utility functions in lib/w-rule.ts. These are called directly by the API route during data processing and must already be tested and stable.

Phase 3 Task 3 (or at a minimum the mark-entry API) must be implemented so that MarkRecord documents actually exist in the database to generate reports against. Testing PDF generation against an empty dataset is not meaningful.

---

## PDF Architecture: @react-pdf/renderer

### How the Library Works

@react-pdf/renderer is a React-based library that converts a React component tree into a binary PDF document using its own internal layout engine. It does not use a browser rendering pipeline, HTML, or DOM — it operates entirely in Node.js memory. This distinction matters heavily for SchoolMS because it means the library must run in the Node.js runtime, not the Edge runtime. If the Next.js API route is not explicitly declared as a Node.js runtime route, the deployment environment may attempt to run it on Edge, which will cause the library to fail at startup.

The entry point for generating a PDF is the renderToBuffer function exported by @react-pdf/renderer. It accepts a React element whose root component must be the Document component provided by the library. It returns a Promise that resolves to a Node.js Buffer containing the full binary contents of the generated PDF. This Buffer is what the API route sends as its response body.

### @react-pdf/renderer Component Primitives

Because the library does not use HTML, the PDF template cannot use any standard HTML elements such as div, p, span, table, or img. Instead, the library provides its own set of primitive components: Document, Page, View, Text, Image, and Link. The Document component is the root and can contain one or more Page components. View is analogous to a box or div — it is the primary layout container. Text renders a string of text. Image renders a raster image. All layout and styling is handled via an object passed to the style prop on each component.

### Styles in @react-pdf/renderer

Styles are defined using the StyleSheet.create function, which takes a plain object of named style rules and returns an optimised stylesheet object. Each style rule uses CSS-like property names, but only a subset of CSS properties is supported. The supported properties most relevant to this task are flexDirection, justifyContent, alignItems, margin, marginBottom, marginTop, padding, paddingBottom, paddingTop, fontSize, fontWeight, color, backgroundColor, border, borderBottom, borderLeft, width, height, and textAlign. Properties that work in a browser but are absent from this subset — such as box-shadow, text-decoration, border-radius (partially supported), and overflow — must be avoided or substituted with supported alternatives.

Colors must be specified as hex strings (e.g., "#ea580c" for an amber-orange). Tailwind class names or CSS variables are meaningless inside @react-pdf/renderer styles. Responsive breakpoints do not exist in this context. The entire layout is static and computed for an A4 paper size at 72 DPI.

---

## GET /api/reports/[studentId]

### Route Location and Runtime

The route file is located at app/api/reports/[studentId]/route.ts. The very first export in this file must be the runtime constant set to the string "nodejs". This declaration is mandatory and must appear before any function exports. Without it, Next.js may route the request through the Edge runtime, which lacks the Node.js built-in modules that @react-pdf/renderer depends on.

### Authentication and Authorization

Every request to this route must be authenticated. The route calls NextAuth's getServerSession with the application's authOptions to retrieve the current session. If no valid session is present, the route returns an HTTP 401 response with a JSON body containing a message field set to "Unauthorized". This check must happen before any database work begins to avoid unnecessary queries for unauthenticated callers.

Once a session is confirmed, role-based access is enforced. Users with the Admin role and users with the Teacher role may generate PDF reports for any student without restriction. Users with the Student role may only generate their own report. The authorisation check compares the studentId path parameter from the URL against the studentId stored on the session user object. If a Student-role user provides a studentId that does not match their own, the route returns an HTTP 403 response with a JSON body containing a message field set to "Forbidden". This protects against direct URL manipulation.

### Query Parameters

The route accepts one optional query parameter: year, which must be a number representing the academic year for the report (e.g., 2024 for the 2023–2024 school year, depending on the project's convention). If year is not provided or is not a valid integer, the route falls back to the currentYear field from SystemConfig. This fallback is resolved during the data assembly step.

### Data Assembly Using Parallel Fetches

The route assembles data from three independent sources simultaneously using Promise.all to minimise latency. The three operations are as follows.

The first operation fetches the Student document using a direct Prisma query: prisma.student.findUniqueOrThrow with a where clause on the studentId from the URL parameter. The query should include a join to the student's ClassGroup (via the classId relation) to resolve the class section name (e.g., "6A") in the same database round-trip. The returned object provides the student's firstName, lastName, indexNumber, grade, and classId, as well as the resolved class section label through the join.

The second operation fetches the SystemConfig document using prisma.systemConfig.findFirst with no filters, since there is only ever one SystemConfig document in the database. This provides the schoolName string, the currentYear number (used as the fallback if no year query parameter was given), and the electiveLabels array — a three-element array of strings where index 0 is the label for elective1, index 1 is for elective2, and index 2 is for elective3.

The third operation fetches all MarkRecord documents for the student and year combination using prisma.markRecord.findMany with a where clause containing both studentId and year. This returns up to three documents, one for each term. Fetching them in bulk with findMany and separating them in application logic is more efficient than three separate findUnique calls.

If the Student document throws an error because the student does not exist, the route catches that specific error and returns an HTTP 404 response with a JSON body containing a message field set to "Student not found".

### Data Processing After Fetch

**Resolving MarkRecords by Term**

Once the three fetch operations complete, the array of MarkRecord documents is separated by term. A plain JavaScript object or Map is constructed with "I", "II", and "III" as keys. Each entry in the fetched array is placed into this structure by its term field. If a given term key has no corresponding document in the fetched array — meaning marks were never entered for that term — a default object is used in its place. The default object has all nine mark fields set to null. This ensures the PDF template always receives a complete data shape for all three terms even when data is sparse.

**Applying the W-Rule to All Marks**

For each of the nine subject fields in each of the three terms, applyWRule is called with the raw numeric value from the MarkRecord (or null from the default object). The result is a display string: a plain number string if the mark is 35 or above, the literal string "W" if the mark is below 35, and the literal string "—" (em dash) if the mark is null. The processed results are stored in a nested object structure keyed by term and then by subject name, ready to be passed directly into the PDF template.

**Building W-Note Content**

The getWSubjects function from lib/w-rule.ts is called once for each of the three terms, passing the raw marks object for that term and the electiveLabels array. getWSubjects returns an array of subject display names for which the raw mark was below 35. After all three calls, the results are consolidated into a single structure that lists each unique affected subject alongside the term or terms in which it received a W. If a subject received a W in multiple terms, it appears once with all affected terms listed. For example, if Mathematics received a W in Term I and Term III, the W-Note entry reads "Mathematics — Term I, Term III". If getWSubjects returns empty arrays for all three terms, the wNoteData structure is empty, and the W-Note section in the PDF template will be suppressed.

**Resolving Elective Labels**

The electiveLabels array from SystemConfig is used to replace the generic field names elective1, elective2, and elective3 with human-readable display names for the marks table. Index 0 of electiveLabels becomes the display name for elective1, index 1 for elective2, and index 2 for elective3. If the electiveLabels array is absent, null, or has fewer than three elements, the route falls back to the strings "Elective 1", "Elective 2", and "Elective 3" respectively to avoid runtime errors in the template.

**Resolving Class Name**

The class section name — such as "6A" or "7B" — is resolved from the ClassGroup join included in the student fetch. If the join returns a result, its name field is used directly. If the join is absent or null, the class name defaults to the student's grade suffixed with "A" as a safe fallback, though this situation should not occur if the student data was entered correctly.

### Audit Logging

Immediately before the PDF buffer is constructed and dispatched, the route writes a REPORT_VIEWED entry to the AuditLog collection. The audit entry has the following fields: action is set to the "REPORT_VIEWED" constant imported from lib/audit-actions.ts; performedBy is set to the userId from the session; targetType is the string "Student"; targetId is the studentId from the URL parameter; and metadata is an object containing the year, a generatedAt timestamp as an ISO string produced by calling new Date().toISOString(), and the student's indexNumber for convenient display in the Recent Reports list.

The audit write is wrapped in a try/catch block. If it throws — for example, due to a momentary database connectivity issue — the error is caught and silently swallowed after being logged to the server console. The audit failure must never propagate to the user or prevent the PDF from being returned. The audit log is a secondary concern; the report delivery is the primary function of this route.

### Response Headers

The HTTP response carries three headers. The Content-Type header is set to "application/pdf" to instruct the browser that the body is a binary PDF document. The Content-Disposition header is set to a value in the form `attachment; filename="report-{indexNumber}-{year}.pdf"` where {indexNumber} is the student's actual index number and {year} is the requested academic year. The index number must be sanitised before embedding in the filename: any whitespace characters and non-alphanumeric characters other than hyphens and underscores must be replaced with hyphens to produce a safe filename. The Cache-Control header is set to "no-store" to prevent all forms of caching — because marks change as teachers enter data, a cached report could be misleadingly out of date.

### Streaming the PDF Response

With all data assembled and processed, the route calls renderToBuffer passing a React element whose type is ProgressReportDocument. All processed data — student details, processed marks, W-Note data, resolved elective labels, resolved class name, school name, academic year, and the generatedAt timestamp — is passed as props. The renderToBuffer call returns a Promise; the route awaits it to obtain the binary Buffer. The Buffer is then passed as the first argument to the Response constructor, with the headers object as the second argument's headers property. Next.js App Router API routes return this Response object directly.

---

## PDF Template: ProgressReportDocument

The ProgressReportDocument is a React component file located at components/reports/ProgressReportDocument.tsx. It accepts all pre-processed data as props and renders a complete @react-pdf/renderer Document. The rendered output is A4 in size (595 × 842 points), with a top margin of 40 points, a bottom margin of 40 points, a left margin of 50 points, and a right margin of 50 points. The component does not make any database calls or perform any business logic. All data transformation and W-rule application happens in the API route before this component is instantiated.

### Section 1: Header

The header is a single horizontal View with flexDirection set to "row", spanning the full width of the printable area. It contains two child Views.

The left child View holds the school logo. If a logo image URL is available in the SystemConfig (a logoUrl field is anticipated but not strictly required), the Image component from @react-pdf/renderer is used with a fixed width and height of approximately 60 × 60 points. If no logo URL is configured, the school initials are rendered inside a styled View that has a fixed width and height, a border, and centered Text showing the first letters of each word in the schoolName.

The right child View has its flex set to 1 and textAlign set to "right". It stacks three Text components vertically: the first renders the string "Progress Report" at 18 points with fontWeight set to "bold"; the second renders the school name from SystemConfig at 12 points with normal weight; the third renders the academic year at 10 points in a lighter gray color.

Below the two-column header row, a full-width horizontal rule is rendered as a View with a height of 0 and a borderBottom of 1 point in a medium gray color (hex "#d1d5db"). A small marginBottom of 8 points follows the rule to give breathing room before the next section.

### Section 2: Student Information Bar

The student information bar is a single horizontal View with flexDirection set to "row" and marginBottom of 12 points. It contains four child Views, each with a flex value of 1 so they divide the available width equally.

Each child View stacks two Text components: a label at 8 points in gray (hex "#6b7280"), and a value at 10 points in near-black (hex "#111827") with fontWeight set to "bold". The four columns are: index number (label "Index No.", value is the student's indexNumber), full name (label "Name", value is student.firstName concatenated with a space and student.lastName), grade level (label "Grade", value is the string "Grade " followed by the grade number), and class section (label "Class", value is the resolved class section name such as "6A").

Below the bar, the same style of horizontal rule as in the header is rendered.

### Section 3: Marks Table

The marks table is the most complex section of the PDF. It occupies the greatest vertical space on the page and must be readable at print size.

A header row is rendered as a horizontal View with flexDirection "row" and a backgroundColor of hex "#f3f4f6" (light gray). The header row contains four Text children: the first has a width of 40% of the table and reads "Subject"; the remaining three each have a width of 20% and read "Term I", "Term II", and "Term III" respectively. All header cells use fontSize 10 and fontWeight "bold", with padding of 6 points on each side.

The nine subject rows follow in order: English, Mathematics, Science, History, Geography, Information Technology, and then the three elective labels as resolved from SystemConfig. Rows alternate between a white background (hex "#ffffff") and a very light gray background (hex "#f9fafb") using the row index modulo 2. Each row is a horizontal View with flexDirection "row". The first child View has a width of 40% and contains the subject name in Text at 10 points. The three term cell Views each have a width of 20% and contain the applyWRule display value.

Display value styling within cells is differentiated by value type. Cells showing a numeric string are rendered in standard near-black text. Cells showing the string "W" are rendered with fontWeight "bold" and color hex "#ea580c" (amber-orange). Cells showing the string "—" are rendered in a lighter gray (hex "#9ca3af") to visually de-emphasise the absence of data. All cells have uniform vertical padding of 5 points.

### Section 4: W-Note Section (Conditional)

The W-Note section is rendered only when the wNoteData structure is non-empty — that is, only when at least one subject received a W mark in at least one term. The ProgressReportDocument component performs this conditional check on the wNoteData prop. If the structure is empty, this entire section is omitted from the rendered output without any placeholder.

When rendered, the section uses a View with a backgroundColor of hex "#fef9c3" (light yellow), a borderLeft of 3 points in hex "#f59e0b" (amber), left padding of 12 points, top and bottom padding of 10 points, and marginTop of 16 points.

Inside this View, a Text heading reads "Academic Warning (W) Note" at 11 points with fontWeight "bold". Below the heading is a thin horizontal rule rendered as a View with 0 height and 1-point borderBottom in hex "#fbbf24". Below the rule is a body Text at 9 points reading "The following subject(s) show a W grade, indicating a score below 35 in at least one term:". A marginTop of 6 points separates the body text from the bullet list.

The bullet list is rendered by iterating over the wNoteData entries. Each bullet is a horizontal View with flexDirection "row". The first child is a Text showing "•" at 9 points with a fixed width of 12 points. The second child is a Text showing the subject name, an em dash, and the affected terms — for example, "Mathematics — Term I, Term III" — at 9 points.

After the bullet list, an advisory footer Text at 8 points in gray reads "Students receiving W grades in any subject are advised to seek academic support."

### Section 5: Footer

The footer is pinned to the bottom of the page using @react-pdf/renderer's fixed prop on the View, which causes it to repeat on every page if the document overflows to multiple pages (unlikely for this layout but correct practice). The footer begins with a horizontal rule identical in style to those used in earlier sections.

Below the rule, a horizontal View with flexDirection "row" and justifyContent "space-between" holds two Text components at 9 points in hex "#9ca3af" (gray). The left Text reads "Generated by SchoolMS on" followed by the generatedAt date formatted as a long human-readable string such as "January 15, 2024". The right Text reads "Confidential — For school use only".

---

## Reports Page: /dashboard/reports

### Route and File

The Reports Page is located at app/dashboard/reports/page.tsx. The page is a client component — it carries the "use client" directive — because it manages significant interactive state: the selected student, the selected year, the PDF blob URL, loading indicators, and the iframe reference. The page is accessible to all authenticated roles. Unauthenticated users are redirected to /login by the middleware.

### Page Layout

The page uses a two-column layout on desktop screens. The left column is narrower (approximately one-third of the available width) and contains the Student Search Panel and the Recent Reports List stacked vertically. The right column is wider (approximately two-thirds of the available width) and contains the Report Preview Panel. On screens narrower than the tablet breakpoint, the two columns collapse into a single vertical stack, with the search panel appearing above the preview panel.

The page heading "Progress Reports" is displayed prominently at the top of the page, outside the two-column layout, in the same typographic style as other dashboard page headings.

### Student Search Panel

The Student Search Panel is implemented in a separate component file at components/reports/StudentSearchPanel.tsx. It receives callbacks to notify the parent page when a student is selected or when the year changes.

#### Search Input

The search field is a text input. A debounce of 300 milliseconds is applied so that the GET /api/students?search={query} request only fires after the user pauses typing. The query parameter is the raw text of the input. The API returns an array of student objects, each containing at minimum the id, indexNumber, firstName, lastName, grade, and classSection fields. These results are displayed in a dropdown positioned absolutely below the input. Each item in the dropdown shows the student's index number in smaller text, their full name in standard weight, and their grade and class section on a second line in a subdued color. Selecting an item from the dropdown closes the dropdown, populates the input with the selected student's name, and calls the onStudentSelect callback with the full student object.

#### Year Selector

A compact select or combobox component is placed immediately to the right of the search input. It is populated with a range of academic years, centred on the current year from SystemConfig. The default selected value is the current academic year. When the user changes the year while a student is already selected, the onYearChange callback fires, which clears the current PDF blob URL and the iframe src, and renders the "Preview Report" button as active again so the user can regenerate for the new year.

#### Student Role Auto-Selection

When the logged-in user has the Student role, the entire search input and year selector are hidden. Instead, the component fetches the student document linked to the current session by calling GET /api/students/me (or an equivalent endpoint established in Phase 2). On successful fetch, the student object is passed to the onStudentSelect callback automatically, as if the user had selected it from a search. A non-interactive label displays the student's full name and index number where the search input would have been. The year selector is retained for Student-role users because they may want to view reports from prior academic years.

### Report Preview Panel

The Report Preview Panel is implemented in components/reports/ReportPreviewPanel.tsx. It receives the selected student, the selected year, and a flag indicating whether auto-preview is enabled.

#### Preview Trigger

When a student is selected, a "Preview Report" button is displayed inside the preview panel. Clicking the button triggers the PDF fetch. Internally the component calls the Fetch API with a GET request to /api/reports/{studentId}?year={year}. The response is read as a binary blob using response.blob(). A blob URL is created from this blob using URL.createObjectURL. This blob URL is then set as the src of an iframe element within the panel. The browser's built-in PDF viewer renders the document inside the iframe without any navigation or downloading required.

The iframe approach is preferred over an HTML mirror of the report because it shows the exact same document the user will download or print, eliminating any discrepancy between the preview and the final output. An HTML mirror would require maintaining a separate React rendering of the same data, which introduces duplication and drift risk.

#### Download Button

A "Download Report" button is shown once a preview has been loaded. Clicking it triggers a fresh GET request to /api/reports/{studentId}?year={year} (or reuses the previously fetched blob). From the blob, a temporary anchor element is created in memory and given a download attribute set to "report-{indexNumber}-{year}.pdf". The anchor's href is set to the blob URL, and a programmatic click is dispatched on the element. The browser interprets this as a user-initiated download and saves the file. The temporary anchor element is then removed from memory. Regardless of this download mechanism, the Content-Disposition header returned by the server also independently instructs the browser to treat the response as a download if accessed directly.

#### Print Button

A "Print Report" button is shown alongside the download button. The preview panel holds a ref to the iframe element (iframeRef). When the print button is clicked, the handler calls iframeRef.current.contentWindow.print(), which opens the browser's native print dialog scoped to the iframe's content. This routes the PDF directly to the user's printer or PDF export driver without requiring a separate download step. The label on the button is "Print Report".

#### Loading State in Preview Panel

While the PDF is being generated and the blob is being fetched, the preview panel shows a centered spinner using the shadcn/ui Skeleton or a custom animated div. The "Preview Report" button is disabled during this period. If the API returns a non-200 status code, the panel hides the spinner and shows a contextual error message. If the status is 404, the message reads "Student not found." If the status is 400 or 422, the message reads "No marks have been entered for this student in {year}. Please enter marks before generating a report." For any 5xx status, the message reads "Report generation failed. Please try again later." Admin-role users additionally see the raw status code appended to the message for diagnostics.

If the initial fetch fails due to a network error (the Promise rejects entirely), the panel shows a "Retry" button beneath the error message. Clicking retry repeats the same fetch without resetting the selected student or year.

### Recent Reports List

The Recent Reports List is implemented in components/reports/RecentReportsList.tsx. It appears below the Student Search Panel in the left column.

This component fetches the ten most recent REPORT_VIEWED entries from the audit log by calling GET /api/audit-log?action=REPORT_VIEWED&limit=10 on mount. The response is an array of audit log objects, each containing the targetId (the studentId), the metadata object (which includes studentIndexNumber, year, and generatedAt), the performedBy field (the userId of the person who generated the report), and the createdAt timestamp.

Each list item displays: the student's index number and resolved name from the metadata.studentIndexNumber field (the name can be displayed as a secondary label if it was stored in metadata, otherwise it is shown as the index number alone), the academic year, the user who generated the report formatted as their display name or email, and the timestamp shown as a relative duration (e.g., "2 hours ago", "Yesterday") using a lightweight utility function or the date-fns library. Items are ordered from most recent to oldest.

Clicking a list item fires a callback to the parent page that pre-populates the StudentSearchPanel with that student and year. The component calls the same onStudentSelect and onYearChange callbacks as the search input would, bypassing the search step entirely.

This section is only visible to Admin and Teacher users. Student users do not see the Recent Reports section, as they cannot view audit log data for other students.

---

## API Endpoint: GET /api/audit-log

The audit log endpoint is a new route file at app/api/audit-log/route.ts. It provides a general-purpose interface for querying the AuditLog Prisma model and is introduced in this task primarily to serve the Recent Reports List, but its design from the outset accounts for its anticipated use in the Audit Log UI during Phase 5.

### Query Parameters

The endpoint accepts three query parameters: action (string, required — the route returns 400 if this is absent), limit (number, optional, defaults to 10, capped at a maximum of 50 to prevent large accidental queries), and page (number, optional, defaults to 1 for pagination purposes).

### Database Query

The Prisma query uses prisma.auditLog.findMany with a where clause filtering by the provided action value. Results are ordered by createdAt in descending order (most recent first). The skip value is derived from (page - 1) multiplied by limit, and the take value is the limit itself. The total count for the action is also fetched using prisma.auditLog.count with the same where clause, so that callers can determine whether additional pages exist.

### Authorization

Only Admin-role and Teacher-role users may call this endpoint. Student-role users receive a 403 response. If the session is absent, the route returns 401. These checks follow the same pattern used in all other protected routes in the project.

### Response Shape

The response is a JSON object with two top-level fields: items, which is the array of audit log documents from the findMany result, and total, which is the count of all matching records. This shape is consistent with the list pagination conventions established in Phase 2.

---

## Error Scenarios

Beyond the loading and fetching states handled in the preview panel, the following error scenarios must each be explicitly handled and tested.

When a student is not found — either because the studentId in the URL no longer exists in the database or was manually typed incorrectly — the API returns 404 and the preview panel displays "Student not found" with a suggestion to use the search input to locate the correct student.

When no marks have been entered for the student in the requested year, the API receives empty MarkRecord results from the database. The route should detect this condition (all three MarkRecord fetch results are absent) and return a 422 or 400 with an appropriate JSON message. The preview panel surfaces this as "No marks have been entered for this student in {year}." This prevents PDF documents containing entirely "—" marks from being generated and distributed.

If PDF generation itself fails — for example, due to a corrupt props object or an internal @react-pdf/renderer error — the server catches the exception from the renderToBuffer call and returns a 500. The preview panel shows the generic "Report generation failed" message.

If a Student-role user directly types another student's report URL into the browser address bar, the API returns 403. The client page handles this through the API response status check and renders "Access denied. You are not authorised to view this report."

---

## File Inventory

The following files are created or modified as part of this task.

app/api/reports/[studentId]/route.ts is a new file containing the Node.js-runtime API route for PDF generation. It is entirely new and has no prior version to modify.

app/api/audit-log/route.ts is a new file containing the general-purpose audit log query endpoint.

components/reports/ProgressReportDocument.tsx is a new file containing the @react-pdf/renderer PDF template component. It exports a single default component ProgressReportDocument.

app/dashboard/reports/page.tsx is a new file containing the Reports Page client component. It orchestrates the two sub-panels and manages shared state.

components/reports/StudentSearchPanel.tsx is a new file containing the student search input, year selector, and role-conditional auto-selection logic.

components/reports/ReportPreviewPanel.tsx is a new file containing the iframe-based PDF preview, the download button, the print button, and all related loading and error states.

components/reports/RecentReportsList.tsx is a new file containing the recent reports audit log list.

lib/audit-actions.ts is an existing file modified to add the "REPORT_VIEWED" string constant. No other changes are made to this file.

---

## Testing Guidance

### API Route Tests

The GET /api/reports/[studentId] route must be tested against the following scenarios before the task is considered complete.

An unauthenticated request (no session cookie present) must return a 200 HTTP status bearing the 401 JSON body — or, correctly, a 401 response — with a message field of "Unauthorized". No database queries should be executed.

A Student-role user making a request with a studentId that does not match their own session's studentId must receive a 403 response with a message field of "Forbidden".

A valid Admin-role request with a correct studentId and year combination for which MarkRecord documents exist must return an HTTP 200 response with a Content-Type header of "application/pdf" and a non-empty binary body.

The same valid request must also produce a new AuditLog document in the database with the action field equal to "REPORT_VIEWED" and the targetId equal to the requested studentId.

A valid request where the studentId does not match any Student document in the database must return a 404 response with a JSON message field of "Student not found".

A valid request must return a Content-Disposition header whose filename segment begins with "report-" and ends with "-{year}.pdf" and contains the student's sanitised index number.

### Reports Page Tests

An Admin-role user visiting the page must see an active search input that returns student suggestions when a query is typed.

A Student-role user visiting the page must not see a search input; instead, their own name and index number must be displayed as a static label, and the preview panel must auto-trigger for their own record.

Clicking the "Preview Report" button for a valid student and year must result in the iframe element receiving a non-empty src attribute matching a blob: URL scheme.

Clicking the "Download Report" button must trigger a browser file-download action for a file whose name follows the pattern "report-{indexNumber}-{year}.pdf".

Clicking the "Print Report" button must invoke the iframe element's contentWindow.print method as evidenced by the print dialog appearing.

The Recent Reports List must render a maximum of 10 entries ordered from most recent to oldest, each showing the student index number, year, performing user, and relative timestamp.

Clicking a Recent Reports List item must pre-populate the search panel with the corresponding student and year without requiring the user to type in the search box.

---

## Summary

Task 4 completes the core deliverable of SchoolMS: the ability to generate, preview, download, and print a formal PDF Progress Report for any student. The architecture cleanly separates concerns — data assembly and business logic live entirely in the API route, PDF layout lives in the ProgressReportDocument component, and all user interaction lives in the client-side Reports Page and its sub-components. The W-rule and W-Note logic reuse the utilities from Phase 3 Task 1 without duplication. The audit log infrastructure introduced in Phase 2 is extended with the REPORT_VIEWED action and a new query endpoint that will serve both the Recent Reports List here and the full Audit Log UI in Phase 5.
