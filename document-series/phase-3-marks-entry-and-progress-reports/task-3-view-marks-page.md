# Task 3 — View Marks Page

## Document Information

- **Phase:** 3 — Marks Entry and Progress Reports
- **Task:** 3 of 5
- **Route:** /dashboard/marks/view
- **Primary File:** app/dashboard/marks/view/page.tsx
- **Roles:** Admin, Teacher, Student (all authenticated roles)
- **Depends On:** Task 1 (Mark Entry), Task 2 (W-Rule Utility and MarkRecord schema), Phase 2 Student Management APIs

---

## Overview and Purpose

The View Marks page is a read-only reporting surface that allows authenticated users to inspect recorded marks across the school. Its defining characteristic, and the feature that sets it apart from the Mark Entry page, is that it always presents marks with the W-rule applied. Under the W-rule, any mark below 35 is displayed as the letter "W" rather than as the raw numeric value. This rule represents a school policy decision — a value below 35 is treated as a failure threshold, and exposing it as "W" is the academically appropriate representation.

This page serves three distinct audiences. Admins use it to review the overall state of marks across grades, terms, and years. Teachers use it to review how their classes have performed in any given term. Students use it to review their own marks, which is the most constrained and privacy-preserving of the three experiences.

The page supports two fundamentally different view modes. The first is class view mode, which presents a grid where rows are students and columns are the nine recorded subjects. This is the natural way for a teacher or admin to scan a full class. The second is single-student view mode, which presents a grid where rows are the nine subjects and columns are the three terms of the academic year. This is the natural way to review a single student's overall academic performance for a year.

Both modes use the same W-rule display logic, the same subject resolution logic for elective labels, and the same underlying mark data. The difference is purely in how the data is organized and presented. The page must handle mode transitions gracefully, with clear navigation to move between them.

---

## Route and Access Control

The canonical route for this page is /dashboard/marks/view. The page file lives at app/dashboard/marks/view/page.tsx. At the layout level, this page must be included in the dashboard navigation visible to all three roles — Admin, Teacher, and Student. The corresponding modification to app/dashboard/layout.tsx should add a "View Marks" navigation link that is not gated by role, since all three roles are permitted to access this route.

Access control on this page is handled in two layers. The first layer is the standard NextAuth session check. Any unauthenticated request to this route must be redirected to the sign-in page. This is enforced by the middleware layer introduced in Phase 1. The second layer is role-based data scoping, which is enforced at the UI level on the client. Admins and Teachers may browse any class or student. Students, however, must see only their own data — they cannot browse other students or other classes.

### Student Auto-Filter Logic

When the logged-in user has the role of "Student", the page operates in a restricted mode. On mount, the component reads the current user's session using the useSession hook from NextAuth. The session object for a Student includes the associated studentId field, which was stored in the session during the authentication flow in Phase 1. Using this studentId, the page issues a GET request to /api/students/{studentId} to retrieve that student's full document, including their grade, classGroupId, name, and index number.

Once this fetch completes, the page pre-populates the single-student view with that student's data. The single-student view loads immediately for a Student role without the user needing to select any filters. The entire filter controls panel — meaning the grade selector, class selector, term selector, and student search input — is hidden for Student users. It is not merely disabled; it is conditionally not rendered at all, because showing disabled controls to a student could cause confusion about why they are inaccessible.

The only control that remains visible and operational for Student users is the year selector. This allows a student to look back at their marks from previous academic years. The year selector behaves identically for all roles — it shows all years that have any MarkRecord data for the relevant scope, plus the current academic year as the default.

---

## Dual View Mode Architecture

The dual view mode is the central architectural decision of this page. The component maintains a view mode state value that is either "class" or "student". The mode determines which table component renders, which API calls are made, and which filter controls are active.

### Class View Mode

Class view mode is active when a grade, class, term, and year are all selected, and no specific student has been chosen from the student search. In this mode, the page renders the ClassMarksTable component, located at components/marks/ClassMarksTable.tsx.

The ClassMarksTable renders a standard HTML table. The header row begins with a "Student" column label, followed by nine subject columns. The subject column headers display the resolved display labels for each subject, meaning that optional subjects such as the second language or elective subject show the label configured in the settings document rather than a generic placeholder. These resolved labels come from the settings fetch at /api/settings, which returns the electiveLabels field among other configuration.

Each data row in ClassMarksTable corresponds to one student in the selected class. Rows are ordered by the student's index number in ascending order, matching the ordering convention used in the Mark Entry page. Each cell in a data row displays the mark for that student in that subject for the selected term, processed through the applyWRule utility. If a student has no MarkRecord for the selected term and year, every cell in their row displays the em dash character "—". If a MarkRecord exists but a specific subject field within it is null or undefined, that individual cell also displays "—". If the value is numeric and below 35, the cell displays "W". If the value is numeric and 35 or above, the cell displays the number as a string.

The "W" display must be visually distinct. The recommended styling is bold text with an amber or orange text color, such as text-amber-600 in Tailwind's utility class vocabulary. The implementation team should choose a shade that meets contrast requirements against the table background. The "—" display should use a muted text color, such as text-gray-400, to indicate the absence of data rather than a failing result.

### Single-Student View Mode

Single-student view mode is active when a specific student has been selected or when the user is a Student role. In this mode, the page renders the StudentMarksTable component, located at components/marks/StudentMarksTable.tsx.

The StudentMarksTable also renders a standard HTML table, but its orientation is transposed relative to ClassMarksTable. The header row contains a "Subject" column label, followed by three columns labeled "Term I", "Term II", and "Term III". Each data row corresponds to one of the nine subjects, with the subject's resolved display label as the row heading. Each of the three term cells in that row shows the mark for that subject in that term, again using applyWRule. The same visual conventions apply — "W" in amber/orange bold, "—" in muted gray, numeric marks in regular text.

The marks data for single-student view comes from a GET request to /api/marks?studentId={studentId}&year={year}, which returns all MarkRecords for that student in the specified year. Because there are exactly three possible terms, this returns between zero and three MarkRecord documents. The component organizes the returned array by term label (Term I, Term II, Term III) and then looks up each subject within each term's record.

If no MarkRecord exists for a given term, the entire term column for that student shows "—" for all subjects. This is expected behavior, for instance when a student is viewing their data mid-year and Term III has not yet been started.

### Mode Transition

The page transitions from class view to single-student view when the user selects a specific student from the student search dropdown. Conversely, it transitions from single-student view back to class view when the user activates the "Back to class view" control, which clears the selected student from state.

During the transition from class to single-student, the previously selected grade, class, and term remain in state but the term selector becomes hidden, since all three terms are shown as columns in single-student view. During the transition back to class view, the term selector reappears and restores its last selected value, so the user returns to the same class view they were in before selecting a student.

The term selector's visibility is therefore driven by the active view mode, not explicitly by a term-visibility state. The component should derive term selector visibility as: show term selector if and only if the current view mode is "class".

---

## Filter Controls

The filter controls panel is rendered as a component named ViewMarksFilters, located at components/marks/ViewMarksFilters.tsx. This component receives the current filter state values and the corresponding setter callbacks as props. It is responsible only for rendering the controls and calling the callbacks — the parent page component holds the actual state and handles data fetching.

### Year Selector

The year selector is a dropdown that lists academic years. On mount, the page fetches the current academic year from GET /api/settings, which returns the currentYear field from the SystemConfig document. This value becomes the default selected year. The dropdown also includes any prior years that have MarkRecord data in the database. To determine available years, the page can use GET /api/marks/years (an endpoint introduced in Task 1 or Task 2 of this phase) which returns an array of distinct years found in MarkRecord documents. The year selector is visible and operational for all roles, including Student.

When the year changes, the page clears the selected class and student state, then re-initiates all relevant data fetches for the new year. The class list itself does not change by year — ClassGroups are not year-scoped — but the marks data is entirely year-scoped, so clearing and refetching is necessary.

### Grade Selector

The grade selector is a static dropdown containing the six grade values: 6, 7, 8, 9, 10, and 11. These are the only grades in the school and do not require dynamic fetching. Selecting a grade triggers a fetch for class groups: GET /api/class-groups?grade={grade}. The returned list populates the class selector. Changing the grade clears the selected class, the selected student, and any currently displayed table data.

The grade selector is hidden when the user is a Student, as part of the general filter control hiding for that role.

### Class Selector

The class selector is a dropdown populated from the GET /api/class-groups?grade={grade} response. Each entry in the dropdown displays the section name of the ClassGroup, such as "6A" or "11C". Internally, the value associated with each option is the ClassGroup's MongoDB ObjectId string, referred to as classId in URL parameters and API calls.

Selecting a class, combined with a selected term and year, triggers the class view data fetch described in the Data Fetching section. Changing the class clears the selected student and refetches class-level data.

The class selector is hidden when the user is a Student.

### Term Selector

The term selector is a dropdown with three options: Term I, Term II, and Term III. Its stored value is one of the string literals "I", "II", or "III", matching the term field format in the MarkRecord schema. The term selector is visible only in class view mode. When single-student view mode becomes active, the term selector is removed from the DOM, since all three terms are simultaneously visible as columns in that mode.

If the user is in class view, has a term selected, then selects a student transitioning to single-student view, the term value remains in state but is not displayed. When the user returns to class view, the term selector reappears with the previously selected value.

### Student Search

The student search is a text input with a results dropdown, implementing a combobox pattern. The input is debounced by 300 milliseconds, meaning the API call fires only after the user has stopped typing for 300ms. The query is sent to GET /api/students?search={query}, which accepts a partial name or partial index number as the search term and returns matching Student documents up to a reasonable limit such as 20 results.

Each result in the dropdown displays the student's index number, full name, grade, and class section — for example "2024001 — Amara Sesay (Grade 9, 9B)". This gives the user enough context to confirm they are selecting the correct student when multiple students have similar names.

Selecting a result stores the student's full document in state, populates the student's display name in the input field, closes the dropdown, and transitions the page to single-student view mode. A clear button (rendered as a small "×" icon inside the input field) allows the user to reset the student selection and return to class view mode.

The student search is hidden when the user is a Student.

---

## Data Fetching

All data fetching in this page is performed using the fetch API from within React useEffect hooks or custom hooks. The Zustand store is not used for this page's fetched data — all fetched state is local to the page component, because the View Marks page is a self-contained read-only display and does not need to share marks data with other pages. The settings fetch result (electiveLabels and currentYear) can be cached in a React ref or a component-level variable to avoid re-fetching on every filter change.

### For Class View

When grade, classId, term, and year are all defined, the page initiates two parallel fetches simultaneously using Promise.all. The first fetch is GET /api/students?classId={classId}, which returns an array of Student documents belonging to the selected class, ordered by index number. The second fetch is GET /api/marks?classId={classId}&term={term}&year={year}, which returns an array of MarkRecord documents for that class, term, and year.

After both fetches resolve, the page merges the two arrays in the client. For each student in the students array, the component searches the marks array for a MarkRecord whose studentId field matches that student's _id. If a match is found, the MarkRecord's subject fields are read and passed through applyWRule for display. If no match is found, all subject cells for that student row show "—".

### For Single-Student View

When a specific student is selected (by search or auto-populated for Student role), the page fetches the student's marks with GET /api/marks?studentId={studentId}&year={year}. This returns all MarkRecords for that student across all terms in the year — zero to three documents. Because the student document is already in state from the search selection or the initial auto-fetch, no separate student fetch is needed.

After the fetch, the page organizes the returned MarkRecords by their term field into a map keyed by "I", "II", and "III". Each of the nine subject fields is then read from the appropriate term's MarkRecord and passed through applyWRule for display in the StudentMarksTable.

### Parallel Fetching

Both the students array and the marks array for class view should be fetched simultaneously via Promise.all. This means a single loading state covers both requests — the loading indicator activates before the calls and deactivates only when both resolve or one rejects. During loading, the table rows are replaced by skeleton placeholder rows. The table header remains visible immediately because the subject columns are derived from the static subject list and the already-fetched settings, requiring no additional network call.

### API Error Handling

If any fetch returns a non-2xx HTTP status code, the page transitions to an error state. The specific status code should be logged to the browser console for debugging purposes. The UI shows a user-facing error message and a retry button. A 404 from GET /api/students?classId={classId} is treated as an empty class (no students enrolled) rather than an error. A 500 from any endpoint is treated as a true error requiring the retry path.

---

## W-Rule Display

The W-rule display is the defining behavior of this page and the reason it exists as a separate page from Mark Entry. On the Mark Entry page, raw numbers are shown so that the teacher can see the value they entered and correct it if needed. On the View Marks page, every mark is processed through the applyWRule function before display, so that the academically correct representation is always shown.

The applyWRule function, defined in lib/w-rule.ts, adheres to the following contract: if the input is null or undefined, it returns the string "—"; if the input is a number less than 35, it returns the string "W"; otherwise it returns the numeric value as a string. This function is the single source of truth for W-rule transformation and must not be duplicated or reimplemented anywhere else. Both the View Marks page and the Progress Report PDF generation (Task 4 of this phase) consume this utility, ensuring absolute consistency between the on-screen view and the printed report.

The visual presentation of the three possible cell states should be clearly distinguishable at a glance. A "W" cell uses bold font weight and a warning color such as amber-600 or orange-600, drawing the reader's attention to underperforming marks. A "—" cell uses a subdued muted color such as gray-400, indicating that the absence of data is an informational state rather than a performance signal. A numeric mark cell uses default text styling, with no additional weight or color decoration.

This three-tier visual language must be consistent across ClassMarksTable and StudentMarksTable, both of which receive applyWRule-processed strings as cell values and apply the same Tailwind utility class logic to determine how to render each cell.

---

## CSV Export

The View Marks page includes a client-side CSV export feature, implemented as the ExportCSVButton component at components/marks/ExportCSVButton.tsx. This button is available exclusively in class view mode — it does not appear in single-student view mode, and it does not appear when the user is a Student.

### When Available and Enabled

The ExportCSVButton component receives the current loading state, the current classId, and the current marks display data as props. The button is rendered in the filter controls area, positioned to the right of the other filter controls or in a header area above the table. The button is disabled when any of the following conditions are true: the classId is null or undefined (no class is selected), the data is still loading, or the fetched data is empty.

When all conditions for enablement are met, the button displays a label such as "Export CSV" and an appropriate icon. Clicking the button immediately invokes the export logic — no additional modal or confirmation step is needed for this action.

### CSV Content Structure

The exported CSV is built entirely on the client from the data already displayed in the ClassMarksTable. The first row of the CSV is the header row. It contains the following column labels in order: "Index Number", "Student Name", and then the display names of the nine subjects in the same order and with the same resolved elective labels as the table headers. There are therefore eleven header columns in total.

Each subsequent row corresponds to one student, in the same sort order as the table (ascending by index number). The first value in each row is the student's index number. The second value is the student's full name. The following nine values are the W-rule-processed mark values for each subject — these are identical to what appears visually in the table. "W" values are written to the CSV as the single character W. Marks that are not entered are written as an empty string (two consecutive commas in the CSV, producing an empty cell when opened in a spreadsheet application). Numeric marks are written as plain numbers without quotation marks.

### Download Mechanism

The CSV string is assembled in JavaScript by iterating over the display data and joining values with commas and rows with newlines. No server API call is made for the export. Once assembled, the string is converted to a Blob object with the MIME type text/csv and UTF-8 encoding. A Blob URL is created from this Blob using the browser's URL.createObjectURL method. A temporary anchor element is created programmatically, its href is set to the Blob URL, and its download attribute is set to the desired filename. The element is appended to the document body, programmatically clicked to trigger the browser's download behavior, and then immediately removed from the document, with the Blob URL revoked to free memory.

The filename format is marks-{className}-term-{term}-{year}.csv. The className value is the section name of the selected ClassGroup, such as "6A". The term value is the Roman numeral string "I", "II", or "III". The year value is the four-digit academic year. A representative filename would be marks-9B-term-II-2025.csv.

### Client-Side CSV Rationale

Generating the CSV purely on the front end is the correct architecture for this feature for two reasons. First, the data is already fetched and displayed in the table — building the CSV is simply a reformatting of data already present in browser memory, requiring no additional network round trip. Second, the exported values are exactly what the user sees on screen, including all W-rule transformations. If the CSV were generated by a server endpoint, the server would need to replicate the W-rule logic and the elective label resolution, creating a risk of divergence between what is displayed and what is exported. The client-side approach guarantees perfect fidelity between the visual table and the exported file.

---

## Loading and Error States

The page can be in one of several distinct states at any given time. Each state requires a specific UI treatment so that the user always understands what is happening.

### Initial State

When the page first loads and no filters have been selected (or when it loads via direct URL with no query parameters), the table area shows an informational empty state. The empty state message reads: "Select a grade and class to view marks, or search for a student." This message is displayed in a centered, muted style within the table area. All filter controls are visible and interactive, waiting for user input.

When the page loads for a Student role, the initial state is different — it immediately shows a loading skeleton because the student data fetch begins automatically on mount.

### Loading State

Once all required filters are selected and a data fetch is in progress, the table area shows a loading skeleton. The table header renders immediately with the correct column labels, because the subject list is static and the settings are already fetched. Below the header, a set of skeleton rows (approximately five to ten rows of gray shimmer placeholders) appear in place of the actual data rows. The filter controls remain visible and unblocked during loading — however, changing a filter while loading is in progress should cancel (or ignore the result of) the in-flight fetch and start a new one with the updated filter values.

To avoid stale data issues, each fetch should be guarded by an AbortController that is cancelled if the component unmounts or if new filter values trigger a new fetch before the previous one completes.

### Empty Data State

If the fetch completes successfully (HTTP 200) but the returned marks array is empty, the page shows a dedicated empty data message within the table area: "No marks have been entered for this selection yet." This is rendered below the table header so the user can see the subject columns and understand that the class and term exist, but simply have no data. This state is intentionally distinct from the initial state because it represents a successful fetch that returned zero records, not a state where no fetch has been attempted.

### Error State

If any fetch returns a network error or a non-2xx, non-404 HTTP status code, the table area displays an error message. The message is generic for the user: "An error occurred while loading marks. Please try again." Below the message is a "Retry" button. Clicking Retry re-executes the same set of fetch calls using the currently selected filter values, without requiring the user to re-select anything. The filter controls remain functional during the error state so the user can also attempt to change their selection.

---

## Accessibility and UX Considerations

The tables in this page must use proper semantic HTML table markup. The outer element is a table element, containing thead and tbody sections. The header row within thead uses th elements with appropriate scope attributes (scope of "col" for column headers, scope of "row" for row headers in StudentMarksTable). Data cells use td elements. This semantic structure ensures that screen readers can correctly announce the relationship between a cell's value and its row and column headers.

Cells displaying "W" should carry an aria-label attribute with a descriptive string such as "Warning — below passing threshold". This ensures that assistive technologies communicate the semantic meaning of "W" rather than simply announcing the letter. Cells displaying "—" should carry an aria-label of "Not entered" for the same reason.

The student search input must follow the ARIA combobox pattern. The input element carries role="combobox" and the aria-expanded attribute reflecting whether the results dropdown is open. The results dropdown carries role="listbox", and each result item carries role="option". The input's aria-controls attribute references the id of the listbox element, and the aria-activedescendant attribute tracks which option is currently keyboard-focused. This pattern supports full keyboard navigation: arrow keys move between options, Enter selects the focused option, and Escape closes the dropdown without selecting.

The CSV export button's aria-label should describe the full context of the export. A suitable label would be "Export marks for class 9B, Term II, 2025 as CSV", constructed dynamically from the current filter state. This prevents the button from being described simply as "Export CSV" without context for assistive technology users.

On small screens and narrow viewports, class view tables may exceed the viewport width because of the number of subject columns. The table container should use horizontal overflow scrolling — apply overflow-x-auto to the wrapping div. This ensures the table remains fully navigable on mobile without breaking the layout.

---

## Role-Specific UX Summary

### Admin Experience

An Admin who navigates to /dashboard/marks/view sees the full filter control panel including grade, class, term, year, and student search. They can select any combination of filters to view class view or single-student view for any student in the school. The CSV export button is available in class view mode. The Admin sees no restrictions on which classes or students they can view.

### Teacher Experience

A Teacher who navigates to this page has the identical experience to an Admin for the current phase. The filter panel is fully visible, and the Teacher can view any class or any student's marks without restriction. A future enhancement could restrict the Teacher to only viewing classes they are assigned to teach, but this restriction is explicitly out of scope for Phase 3 and must not be implemented now to avoid premature complexity.

### Student Experience

A Student who navigates to this page sees a markedly different interface. The filter controls panel is not rendered. The page immediately initiates a fetch for the student's own data using their session's studentId. While this fetch is in progress, a loading skeleton occupies the table area. Once the fetch completes, the StudentMarksTable renders with the student's marks for their current academic year. Only the year selector is visible, allowing the student to view prior years. The CSV export button is never rendered for Student users. The page heading or subtext should contain a personalized message such as "Viewing marks for Amara Sesay" so the student has contextual confirmation they are seeing their own data.

---

## Integration with Student Profile

The Student Profile page, built in Phase 2 at /dashboard/students/[id], includes a marks summary table with placeholder content. In that table, marks are shown using the same applyWRule utility, establishing visual consistency between the Student Profile and the View Marks page.

The View Marks page is the standalone, full-featured marks inspection tool. The Student Profile marks table is a compact, embedded summary. Both consume applyWRule from lib/w-rule.ts and both apply the same visual convention for "W" and "—" values. This shared utility ensures that a mark displayed as "W" on the View Marks page will also appear as "W" on the Student Profile, with no discrepancy possible between the two surfaces.

In Phase 4, the Student Profile page will be enhanced with mark charts and infographics. The data pipeline for those charts will originate from the same marks API endpoints used by the View Marks page. Designers and developers planning Phase 4 should treat the View Marks API calls and data shape as the authoritative source of marks data for display purposes.

---

## URL State Management

The filter selections on the View Marks page must be reflected in the URL's query string parameters. This serves three important purposes: it allows a supervisor to share a link to a specific class and term view with a colleague; it allows the browser's back and forward navigation buttons to work correctly between different filter states; and it ensures the page renders correctly when opened directly via a bookmarked or linked URL.

The URL parameter names and their corresponding values are as follows. The grade parameter holds the numeric grade value as a string, such as "9". The classId parameter holds the MongoDB ObjectId string of the selected ClassGroup. The term parameter holds the term string, one of "I", "II", or "III". The year parameter holds the four-digit academic year string, such as "2025". The studentId parameter is optional and holds the MongoDB ObjectId string of a selected student; its presence signals single-student view mode.

On page mount, the component reads these parameters from the URL using Next.js's useSearchParams hook. If all required parameters are present, the component initializes its filter state from them and immediately triggers the appropriate data fetch, bypassing the initial empty state. If only some parameters are present (for example, grade and classId but no term), the component initializes what it can and waits for the user to supply the missing values before fetching.

When the user interacts with any filter control — changing the grade, selecting a class, switching the term, selecting a student — the component pushes an updated URL to the router using the Next.js router's push method, encoding the new filter state into the query string. This keeps the URL and the component state in sync at all times without requiring a page reload.

---

## Performance Considerations

The data volumes involved in this page are well within the capabilities of a client-side merge approach without pagination.

A single class contains at most 40 to 45 students. Fetching all students for a class via GET /api/students?classId={classId} returns at most 45 documents, each lightweight. Fetching all mark records for a class and term via GET /api/marks?classId={classId}&term={term}&year={year} returns at most 45 MarkRecord documents. Client-side merging of 45 students against 45 MarkRecords is trivially fast and requires no special optimization.

For single-student view, the fetch returns between zero and three MarkRecord documents. This is the smallest dataset the page ever handles.

For the year selector's year list fetch, GET /api/marks/years is a distinct-value aggregation on the year field of the MarkRecord collection. This query is fast regardless of the total number of MarkRecords in the database.

As the school accumulates data over multiple academic years, the year-scoped filtering ensures that each fetch's result set remains bounded to one year's worth of data. Even after five years of operation, a class view fetch for a specific year returns at most 45 MarkRecords, not the cumulative total across all years.

No pagination, virtual scrolling, or lazy loading is required for the table display. All students in a class fit comfortably in one unscrolled or minimally scrolled table view.

---

## File Inventory

The following files are created or modified as part of this task.

The file app/dashboard/marks/view/page.tsx is created new. This is the main page component. It manages all filter state, handles URL parameter reading and writing, coordinates data fetching, determines the current view mode, and renders the ViewMarksFilters component together with either ClassMarksTable or StudentMarksTable depending on the active mode. It also renders loading skeletons, empty state messages, and error messages as appropriate.

The file components/marks/ViewMarksFilters.tsx is created new. This is the filter controls panel component rendered at the top of the View Marks page. It receives current filter values and change callbacks as props and renders the year selector, grade selector, class selector, term selector, and student search, each conditionally shown based on the active role and view mode. It is a pure presentational component — it holds no state of its own and calls its prop callbacks in response to user interactions.

The file components/marks/ClassMarksTable.tsx is created new. This component renders the class view HTML table. It receives the list of students, the list of MarkRecords, the resolved subject labels from settings, and the active term as props. It performs the per-student, per-subject merge and W-rule display logic internally, iterating over students and subjects to build each table row.

The file components/marks/StudentMarksTable.tsx is created new. This component renders the single-student view HTML table. It receives the student document, the array of MarkRecords for that student across all terms, and the resolved subject labels as props. It organizes records by term and renders the subject-row, term-column layout with W-rule display applied to each cell.

The file components/marks/ExportCSVButton.tsx is created new. This component renders the export button and contains the complete CSV generation and download trigger logic. It receives the current class display data (already W-rule processed), the class name, the term, and the year as props. It performs no API calls and produces no side effects beyond the file download.

The file app/dashboard/layout.tsx is modified. A navigation link for "View Marks" pointing to /dashboard/marks/view is added to the sidebar or top navigation. This link is visible to all three roles and does not require a role guard in the layout itself, since the page component handles role-specific UI behaviour internally.

---

## Testing Guidance

The following scenarios must be verified during implementation and review.

The page renders correctly for a user with the Admin role, showing all filter controls — grade, class, term, year, and student search — in their initial unselected state, with the empty state message in the table area.

The page renders correctly for a Teacher role with the same full filter experience as Admin.

When a user with the Student role loads the page, the filter controls panel is absent from the DOM. A loading skeleton appears in the table area immediately on mount while the student's data is being fetched. After the fetch resolves, the StudentMarksTable renders with the student's marks for the current year.

In class view, when a MarkRecord contains a numeric value of 34 or below for any subject, that cell displays the bold "W" in amber color, not the raw number.

In class view, when a student has no MarkRecord for the selected term and year, all cells in their row display the em dash "—" in muted gray.

In single-student view, when no MarkRecord exists for a given term, the entire term column for all subject rows displays "—".

Switching from class view to single-student view by selecting a student from the search hides the term selector and renders the StudentMarksTable with three term columns.

Activating the "Back to class view" control clears the selected student, restores the term selector, and returns to the ClassMarksTable for the previously selected class and term.

The CSV export button is present in class view mode when a class is selected and data has loaded, and absent in single-student view mode and for Student users.

Clicking the CSV export button triggers a file download with the correct filename format, with header and data rows matching the visible table, W values exported as the character W, and empty marks exported as empty strings.

The CSV export button is in a disabled state when classId is null or when data is still loading.

Navigating directly to /dashboard/marks/view?grade=9&classId={aValidObjectId}&term=II&year=2025 causes the page to load with those filters pre-populated and immediately begin the data fetch, displaying the class view table upon successful resolution.

When the marks API returns a 500 error, the table area displays the error message and the Retry button. Clicking Retry re-executes the fetch.

When the marks API returns a 200 response with an empty array, the table area displays the "No marks have been entered for this selection yet" message beneath the table header.

On a viewport narrower than the full table width, the table container allows horizontal scrolling without breaking the surrounding layout.

---

## Summary

The View Marks page is a focused, read-only reporting surface that serves the entire school community — administrators, teachers, and students — through a single route with role-adaptive rendering. Its core responsibility is to present mark data in the academically correct form, always applying the W-rule so that below-threshold marks are shown as "W" rather than exposing raw numbers. Its dual view modes accommodate both the class-level overview a teacher needs and the subject-by-term breakdown a student needs. Its URL-synced filter state, parallel data fetching, client-side CSV export, and comprehensive loading and error handling make it a robust and user-friendly reporting tool that lays the groundwork for the PDF progress reports in Task 4.
