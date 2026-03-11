# Task 2: Mark Entry Page

## Overview

**Phase:** 3 — Marks Entry and Progress Reports  
**Task:** 2 of N  
**Route:** `/dashboard/marks/entry`  
**Primary File:** `app/dashboard/marks/entry/page.tsx`  
**Complexity:** High — significant client-side state management, parallel data fetching, dirty tracking, and navigation interception  

---

## Purpose and Scope

The Mark Entry page is the primary data-entry surface of SchoolMS. It gives Admins and Teachers a structured interface for entering and updating student marks for a selected class, term, and subject in a single workflow. Rather than navigating to individual student profiles, this page presents the entire class roster in a data grid, allowing the user to enter or adjust marks for every student in one sitting and commit the entire batch in a single save operation.

The page is built as a client component because its behavior is inherently interactive: it maintains controlled inputs for each row, tracks unsaved changes per student, manages dependent dropdown state across four cascading filter selectors, and attaches browser-level navigation guards when there are pending edits. None of this can be done in a React Server Component.

The Mark Entry page fulfills the following high-level requirements:

- Present four cascading filter selectors (grade, class, term, subject) at the top of the page that control which data is loaded into the grid.
- After all four filters are selected, fetch the class roster and any existing mark records in parallel, then merge the results into a populated data grid.
- Allow the teacher to edit individual mark inputs per row, which are validated client-side for range and type.
- Track which rows have been modified since the last save using a dirty map keyed by student ID.
- Provide a batch save action that sends only the changed entries to the API, then reconciles the initial mark state on success.
- Display visual indicators for marks below the passing threshold and for invalid input values.
- Warn the user before navigation if unsaved changes exist in the dirty map.

---

## Route and Access Control

The page lives at the route `/dashboard/marks/entry`, and its page file is `app/dashboard/marks/entry/page.tsx`. It is protected by the same middleware that guards the entire `/dashboard` subtree, meaning only authenticated users can reach it. However, authentication alone is insufficient — role-based enforcement is also required at the page level.

### Permitted Roles

Only users with the role `Admin` or `Teacher` may use this page. Students are explicitly excluded. The sidebar navigation must reflect this: the "Mark Entry" link should be rendered conditionally and will only appear for Admin and Teacher sessions. The sidebar link should be labeled something like "Mark Entry" and grouped under a "Marks" section in the navigation hierarchy. It should not appear at all when the active session belongs to a Student.

### Page-Level Role Check

Because routing alone is not sufficient defense, the page component itself must check the session role on mount. If the session indicates the current user's role is `Student`, the page must render a 403 Forbidden message inline within the dashboard layout rather than the page content. This message should clearly state that the user does not have permission to access this page. It should not redirect — it should display within the existing shell so the student sees the sidebar and header but a permission error in the main content area.

This two-layer approach (sidebar hiding plus page-level check) constitutes defense in depth. Even if a student manually types the URL, they will see the 403 component. The API routes further enforce the same restriction at the persistence layer.

---

## Page Initialization

On first mount, before any user interaction, the page must fetch the SystemConfig document from `GET /api/settings`. This config drives two critical pieces of data used throughout the page:

- The `electiveLabels` array, which contains the display names for the three elective subjects. Without this, the subject selector cannot be populated correctly.
- The `currentAcademicYear` value (e.g., `2026`), which is embedded in every mark record and must be sent with API requests.

Both values should be stored in component state as soon as the settings fetch resolves. While the settings are being fetched, a full-page loading spinner should be shown so the user does not interact with an incomplete interface. If the settings fetch fails, display a full-page error state with a "Retry" button — the page cannot function without the system configuration.

---

## Filter Selectors UI

The top section of the Mark Entry page contains four cascading filter selectors arranged horizontally. These selectors drive which data populates the grid below. Each selector is a `Select` component from the shadcn/ui library. They are arranged in logical dependency order: grade comes first, then class, then term, then subject. However, term and subject are independent of each other and either can be selected before the other.

### Grade Selector

The grade selector is a static dropdown containing exactly six options: Grade 6, Grade 7, Grade 8, Grade 9, Grade 10, and Grade 11. These values are hardcoded in the component — they do not require any API call to populate. The option values stored in state should be the plain integers 6 through 11. When rendered, each option displays as "Grade X" where X is the number.

Selecting a new grade immediately resets the class selector to its initial empty/placeholder state. The class selector is re-enabled and repopulated based on the new grade. Any data currently in the grid should be cleared, the dirty map should be emptied, and the initial mark values should be discarded. This prevents stale data from a previous selection from remaining visible while a new class loads.

### Class Selector

The class selector is disabled until a grade has been selected. Once a grade is chosen, the selector fetches all ClassGroup records matching that grade from the endpoint `GET /api/class-groups?grade={grade}`. This endpoint was implemented in Phase 2 and returns an array of class group objects, each containing a `_id` field and a `section` string (e.g., "6A", "6B", "6Science").

Each option in the class selector displays the `section` value as its label. The option values stored in state should be the raw ClassGroup `_id` strings so they can be passed directly to subsequent API calls. The page component should maintain both the selected `classId` and the selected `section` label in state — the `classId` for API usage and the `section` for display elsewhere on the page.

While the class options are loading (after a grade is selected), the class selector should display a loading state — either a spinner replacing the trigger or a "Loading classes…" placeholder option. If the class fetch fails, display an inline error message beneath the selector.

Selecting a class triggers an immediate data fetch for students and marks if term and subject are also already selected. If term or subject is not yet chosen, the page waits. Every change to the class selection clears the current grid and dirty state.

### Term Selector

The term selector contains three options: "Term I", "Term II", and "Term III". The internal values stored in state should be the string identifiers `"1"`, `"2"`, and `"3"` (or `"Term1"`, `"Term2"`, `"Term3"` — consistent with whatever the `MarkRecord` schema uses for the `term` field, as defined in the Prisma schema in Phase 2). The term selector is enabled at all times — users may select a term before or after selecting a grade and class.

If a term is changed while grade, class, and subject are all already selected, the page triggers a fresh data fetch for the new term. The grid should refresh to show the marks for the newly selected term. This does NOT clear the class or grade selection. Before re-fetching, the dirty map must be checked — if unsaved changes exist, show a confirmation modal asking the user to save or discard before the term is changed.

### Subject Selector

The subject selector contains nine options total. Six are core subjects and three are electives. The core subjects and their display names are fixed:

- English
- Mathematics
- Science
- History
- Geography
- Information Technology

The three elective display names come from the `electiveLabels` array in SystemConfig, fetched on page mount. The elective option values stored in state are the canonical keys used in the `marks` map on the MarkRecord schema — typically `"elective1"`, `"elective2"`, and `"elective3"`. The display label shown in the dropdown for each elective is the corresponding value from `electiveLabels` (e.g., "Art", "Music", "Physical Education").

The core subject keys used internally follow the pattern: `"english"`, `"mathematics"`, `"science"`, `"history"`, `"geography"`, `"informationTechnology"`. These keys must match exactly the field names in the MarkRecord's `marks` object as defined by the Prisma schema, including capitalization.

Just like the term selector, the subject selector is enabled at all times. Changing the subject while grade, class, and term are already selected triggers a fresh data fetch. The same dirty-map check applies before any re-fetch.

### Filter State Management Summary

All four filter values — grade, class, term, and subject — are managed using React `useState` hooks within the `useMarkEntryState` custom hook described later in this document. Together they form a derived "filter state" that determines whether a data fetch is warranted.

A data fetch for the grid is triggered if and only if all four values are non-null. When grade or class changes, the grid is fully cleared and all dirty state is discarded (with appropriate unsaved-changes warnings if applicable). When term or subject changes, the student roster is preserved in state but the marks column is re-fetched and merged back into the existing rows.

---

## Data Fetching Strategy

Once all four filter selections are active (grade, class, term, and subject are all set), the page initiates a data fetch to populate the grid. Data fetching is decomposed into two independent calls that run in parallel.

### Students Fetch

The page calls `GET /api/students?classId={classId}` to retrieve all students enrolled in the selected class group. The response is an array of student summary objects, each containing at minimum the student's `_id`, `name`, and `indexNumber` fields. After receiving the response, the page sorts the students by `indexNumber` ascending so that the grid always presents a consistent, ordered roster.

### Marks Fetch

Simultaneously, the page calls `GET /api/marks?classId={classId}&term={term}&year={currentAcademicYear}&subject={subject}` to retrieve any existing mark records for that class, term, year, and subject combination. The response is an array of MarkRecord objects. Each MarkRecord contains a `studentId` field and a `marks` object. The page extracts only the value for the selected subject key from each record's `marks` object.

The `currentAcademicYear` used in this request is the value loaded from SystemConfig on page mount and stored in state. It should not be recalculated or re-fetched on every filter change — it is a stable value for the duration of the page session.

### Parallel Execution

Both the students fetch and the marks fetch are initiated simultaneously using `Promise.all`. This reduces total wait time compared to sequential fetching, which is important when the class roster is large. The page displays a skeleton loader across the entire grid area while the parallel fetch is in progress.

### Merging the Results

After both fetches resolve, the page merges the results by `studentId`. For each student in the roster array, the merge logic searches the marks results for a MarkRecord whose `studentId` matches the current student's `_id`. If a match is found, the `initialMark` for that row is set to the numeric value of the selected subject's field from the matched record. If no match is found — meaning no mark has been entered for this student for the current subject/term/year — the `initialMark` is set to `null`.

The merged result is stored as an array of row descriptor objects. Each row descriptor contains the following fields: `studentId` (string), `studentName` (string), `indexNumber` (string or number), and `initialMark` (number or null). The `markRecordId` (the `_id` of the MarkRecord, if one exists) may also be included in the row descriptor for use in the PATCH request, though the batch endpoint can look up the record by student/class/term/year if the ID is not provided.

---

## Data Grid Design

The data grid is the central element of the Mark Entry page. It occupies the majority of the page's vertical space below the filter panel.

### Grid Structure

The grid is a table-like layout where each row represents one student in the selected class. The grid has four columns:

- **Index Number** — Read-only. Displays the student's index number. Left-aligned.
- **Student Name** — Read-only. Displays the student's full name. Left-aligned.
- **Mark Input** — Editable. A number input field for the mark value.
- **Status** — A column showing visual indicators (caution or invalid markers). Can be empty if the row has no issues.

The grid header row shows column titles. Rows are ordered by index number ascending and do not support manual sorting. The total number of rows equals the number of students in the selected class, typically between 25 and 40.

### Mark Input Field

Each row's mark input is a controlled `input` element of type `"number"`. The displayed and stored value is always the string representation of the current input content (to correctly handle the empty string case), though it is validated and submitted as a number or null.

The input accepts integer values between 0 and 100 inclusive. If the user types a value outside this range (e.g., 150) or a non-integer (e.g., "50.5" or text characters), the input should display a red border and a brief inline error message below the field. The invalid value should not prevent further typing — the user is allowed to continue editing, but the Save button will be disabled as long as any row contains an invalid value.

When the grid first renders from a merged result, each input is pre-filled with its row's `initialMark` value. If `initialMark` is `null`, the input is empty (the empty string). An empty input represents "no mark entered" and is a valid, saveable state. On save, an empty input maps to `null` in the database.

### Caution Indicator

A yellow caution indicator appears alongside the mark input when the entered value is a valid integer and is strictly less than 35. The value 35 is the W_THRESHOLD defined in the system. Marks below this threshold are treated as "W" marks in all display contexts outside of the Mark Entry page, but on this page the teacher always sees and edits the raw numeric value — the conversion to "W" is a display concern handled elsewhere.

The indicator should be a small yellow `AlertTriangle` icon from the Lucide icon library, or a small yellow badge with the label "Below threshold". It should appear in the Status column of the affected row, or inline to the right of the input field. Its purpose is informational: it warns the teacher that this student's mark is below the threshold without blocking the save operation.

The yellow indicator should carry `role="status"` and an `aria-label` or visually hidden text description such as "Mark is below the passing threshold" for screen reader users.

Crucially, the yellow indicator must not display the letter "W". The "W" representation is a read-only display transformation for the View Marks and Reports pages. This page always shows the numeric value. The caution indicator only signals that the threshold would be triggered.

### Invalid Input Indicator

A red border on the input and a small error label below it (e.g., "Must be 0–100" or "Must be a whole number") appear when the entered value fails validation. The Save button is disabled while any row is in the invalid state. This prevents partial or malformed data from reaching the API.

### Empty and Clean Rows

A row whose input is an empty string is not invalid — it represents an intentional absence of a mark. It displays no indicator in the Status column. An empty input that was previously populated with an `initialMark` value is considered dirty (it has changed from a number to null). An empty input that started with a `null` initial value is considered clean.

---

## Dirty State Tracking

Dirty state tracking is the most important state management concept on this page. It determines what gets saved, whether the save button is active, whether navigation should be blocked, and what visual feedback to show the teacher.

### The Dirty Map Structure

The dirty map is a `Map` whose keys are `studentId` strings and whose values are either a number (the new mark value) or `null` (mark cleared). It lives in the `useMarkEntryState` hook. The dirty map represents the set of students whose current input value differs from their `initialMark` value.

When a user edits a mark input in a row, the change handler compares the new value against the row's `initialMark`. If the new value is different, the student's ID is inserted or updated in the dirty map with the new value. If the new value matches the `initialMark` exactly — meaning the user has reverted their change — the student's ID is removed from the dirty map.

### Why the Dirty Map Matters

The batch save endpoint, `PATCH /api/marks/batch`, accepts a list of individual change entries in its request body. Sending only the changed entries means fewer database write operations per save. It also means the audit log (if one is implemented) captures only genuine changes. Sending all 35 students' marks every time a single mark is changed would be wasteful and would pollute any future audit trail.

The dirty map also drives the save button's enabled state, the "X unsaved changes" label, the row-level visual indicator for unsaved rows, and the beforeunload navigation guard. Without it, none of these features could work correctly.

### Dirty Row Visualization

Rows in the dirty map should receive a subtle visual treatment to help the teacher see at a glance which rows have pending edits. A thin colored left border (amber or blue, depending on the design language) applied to the row is a good approach. This does not conflict with the yellow caution indicator — both can be displayed simultaneously on the same row.

---

## Save Flow

### Save Button State and Placement

The "Save Marks" button is a prominent, clearly labeled action button placed above or below the data grid. It should remain visible without scrolling in typical viewport heights, or it can be sticky to the bottom of the viewport for large classes. It displays the label "Save Marks" and includes a spinner icon during the save operation.

The save button is disabled under three conditions: the dirty map is empty (nothing has changed), a save operation is currently in progress, or at least one row in the grid contains an invalid mark value. A small informational label adjacent to the button shows "X unsaved changes" where X is the current size of the dirty map, giving the teacher constant awareness of their pending edits. When there are no unsaved changes, this label can be hidden or replaced with a neutral placeholder.

### Save Operation Steps

When the user clicks "Save Marks", the following sequence occurs:

The page reads all entries from the dirty map and converts them into an array of individual change objects, each containing a `studentId` field and a `markValue` field (number or null). This array contains only the modified rows.

The page then constructs the full request body for `PATCH /api/marks/batch`. The body includes the following fields: `classId` (the selected class group ID), `term` (the selected term identifier), `year` (the current academic year from SystemConfig state), `subject` (the selected subject key such as `"mathematics"` or `"elective2"`), and `entries` (the array of changed entries described above).

The page sets the saving flag to true (to disable the button and show the spinner) and fires the PATCH request.

### Handling a Successful Save (HTTP 200)

On a 200 response, the page interprets the operation as a complete success. For every entry in the dirty map, the `initialMark` of the corresponding row is updated to the saved value. The dirty map is then cleared entirely. A success toast notification is shown to the user confirming that the marks were saved, including the count of updated entries (e.g., "12 marks saved successfully").

### Handling a Partial Save (HTTP 207)

A 207 Multi-Status response indicates that some entries were saved and some failed. The response body should contain a breakdown of which student IDs succeeded and which failed. The page updates the `initialMark` for the students that succeeded and removes them from the dirty map, but leaves the failed entries in the dirty map with their edited values. A warning toast displays alongside the success toast, listing the student IDs (or names) for which saving failed, prompting the teacher to review and retry.

### Handling a Failed Save (HTTP 400 or 500)

On a 400 or 500 error response, the page shows an error toast with the error message from the API response body. The dirty map is NOT cleared — the teacher's unsaved edits are preserved in both the dirty map and the visible input values. This is essential: if saving fails, the teacher should not have to re-enter all their marks from scratch. The saving flag is set back to false so the button becomes clickable again.

---

## Unsaved Changes Warning

### Browser-Level Guard (beforeunload)

Whenever the dirty map contains at least one entry, the page attaches a `beforeunload` event listener to the global `window` object. The listener calls `event.preventDefault()` and sets `event.returnValue` to an empty string. This triggers the browser's built-in "Leave site?" confirmation dialog when the user attempts to close the tab, close the browser, or navigate to an external URL.

The listener must be registered and de-registered in a `useEffect` that depends on the dirty map's size. When the dirty map becomes empty — either through a successful save or through the user reverting all changes — the `beforeunload` listener must be removed to avoid spuriously blocking navigation after everything is saved.

The listener should be registered as a named function (not an anonymous arrow function) so that the exact same function reference can be passed to both `addEventListener` and `removeEventListener`. Passing different function references is a common bug that leaves orphaned listeners.

### Next.js Client-Side Navigation Guard

The `beforeunload` event does not fire for Next.js client-side navigation because the browser never leaves the page for in-app route changes. To handle this case, the page must intercept navigation events using the Next.js router. When the router detects a route change and the dirty map is non-empty, the navigation should be cancelled and a custom modal should appear.

The modal presents the user with three options: "Save and Leave" (which triggers the save operation and then navigates), "Discard and Leave" (which clears the dirty map and proceeds with navigation), and "Stay" (which dismisses the modal and returns the user to the Mark Entry page with their edits intact).

The "Save and Leave" branch must wait for the save operation to complete. If the save succeeds, navigation proceeds. If the save fails, the modal closes but navigation is cancelled, and an error toast informs the user that their data could not be saved.

---

## Page-Level Loading and Error States

The page manages multiple distinct loading and error states that must all be represented clearly in the UI:

**Initial page load** — While the SystemConfig settings are being fetched on mount, a full-page centered loading spinner should be shown. No filter selectors or grid should be visible until the settings are loaded.

**Class options loading** — After a grade is selected, while the class dropdown options are being fetched from `GET /api/class-groups`, the class selector trigger should show a loading spinner or "Loading…" placeholder and should be disabled until the fetch completes.

**Grid data loading** — After all four filters are selected and the parallel data fetch is in progress, a skeleton loader should fill the grid area. The skeleton should resemble the final table structure: a series of placeholder rows with shimmer animations.

**Students fetch failure** — If the call to `GET /api/students` fails, the grid area should display an error message explaining that the class roster could not be loaded, along with a "Retry" button that re-initiates both fetches.

**Marks fetch failure with successful students fetch** — If the marks fetch fails but the students fetch succeeds, the grid should still render with the student roster, but all mark inputs should be empty (null initial marks). A non-blocking warning banner above the grid should inform the teacher that existing marks could not be loaded, so they may be overwriting previously saved data. The teacher can still choose to dismiss the warning and proceed with entering marks.

**Empty class** — If the selected class group contains no students (the students fetch returns an empty array), the grid area should display an empty state illustration or message: "No students found in this class group."

---

## Component Structure

The Mark Entry page is broken into three principle components and one custom hook. This separation keeps each piece focused and testable in isolation.

### MarkEntryPage

This is the root page component located at `app/dashboard/marks/entry/page.tsx`. It is marked as a client component with the `"use client"` directive. It holds no significant logic itself — it delegates state management to the `useMarkEntryState` hook and delegates rendering to its sub-components. MarkEntryPage renders the overall layout: the page title heading, the FilterPanel, the grid loading/error/empty states, the MarkEntryGrid (when data is ready), and the SavePanel.

### FilterPanel

Located at `components/marks/FilterPanel.tsx`, this component receives all four current filter values and their setter callbacks as props, plus the available class options and the system config's elective labels. It renders the four shadcn `Select` components side by side. It is a purely presentational component — it owns no state of its own and fires only the callbacks received via props. This design makes it straightforward to test in isolation and easy to reuse if similar filter UIs are needed elsewhere.

### MarkEntryGrid

Located at `components/marks/MarkEntryGrid.tsx`, this component receives the array of merged row descriptors and a single `onMarkChange` callback as props. It renders the table structure (header row plus one `MarkEntryRow` per student). It applies no business logic — it maps over the rows array and renders each as a `MarkEntryRow`, passing the individual row data and the change callback through.

### MarkEntryRow

Located at `components/marks/MarkEntryRow.tsx`, this is the most granular component. It receives a single row descriptor, the current edited value for that row (from the dirty map, or the `initialMark` if not dirty), and the `onMarkChange` callback. It renders the index number cell, the name cell, the mark input, and the status indicator cell. It is responsible for all per-row validation logic (checking for out-of-range or non-integer values), the dirty visual treatment (left border), the yellow caution indicator, and the red invalid indicator.

### SavePanel

Located at `components/marks/SavePanel.tsx`, this component receives the dirty map size, the saving flag, the has-invalid-rows flag, and the `onSave` callback. It renders the "Save Marks" button with the appropriate disabled state and spinner, and the "X unsaved changes" label. Like FilterPanel, it is purely presentational.

### useMarkEntryState Custom Hook

Located at `hooks/useMarkEntryState.ts`, this hook centralizes all state variables and side effects for the Mark Entry page. It is responsible for managing:

- The four filter selector values (grade, class, term, subject).
- The list of ClassGroup options (fetched when grade changes).
- The system config values (electiveLabels, currentAcademicYear).
- The rows array (merged student + mark data).
- The dirty map (Map of studentId to current value).
- Loading and error flags for settings, class options, and grid data.
- The saving flag.

It exposes handlers for filter changes, individual mark input changes, and the save action. The page component only needs to call this hook and wire its return values into the sub-components, making the page component itself very thin.

---

## Accessibility Considerations

Each mark input must include an `aria-label` attribute that identifies the student and subject to screen reader users. The format should be descriptive, for example: "Mark for Alice Mensah — Mathematics". This allows a keyboard-only or screen-reader user to understand the context of each input without the surrounding table structure.

The yellow caution indicator element should include `role="status"` so that when it appears dynamically (after a user types a below-threshold value), screen readers announce its presence. A visually hidden span adjacent to the icon may carry the text "This mark is below the passing threshold" for SR-only context, since the visual icon alone does not convey meaning to blind users.

When the save operation is in progress, the "Save Marks" button should have `aria-busy="true"` and `aria-disabled="true"` set programmatically. The spinner inside the button should have `aria-hidden="true"` since it is a decorative animation.

The tab order of the form must follow the visual layout: mark inputs should be reachable by pressing Tab in index number order, from the first row to the last. The filter selectors should also be in their visual order in the tab sequence. The Save button should be reachable either before or after the grid, as long as it is not buried after 40 rows without a way to skip.

---

## Modified Files

### New Files

- `app/dashboard/marks/entry/page.tsx` — The main page component. Marked `"use client"`. Uses `useMarkEntryState` and composes `FilterPanel`, the grid loading/error/empty states, `MarkEntryGrid`, and `SavePanel`. Handles the access control check for Student roles at the top of its render output.

- `components/marks/FilterPanel.tsx` — Renders the four shadcn `Select` components. Purely presentational — all state and callbacks are passed in as props.

- `components/marks/MarkEntryGrid.tsx` — Renders the table layout and maps over the rows array to produce a `MarkEntryRow` for each student. Receives row data and the change callback as props.

- `components/marks/MarkEntryRow.tsx` — Renders a single student row: index number, name, controlled mark input, and status indicator. Handles per-row validation and dirty/caution/invalid visual states.

- `components/marks/SavePanel.tsx` — Renders the "Save Marks" button and the "X unsaved changes" label. Purely presentational.

- `hooks/useMarkEntryState.ts` — Custom hook owning all state, effects, and handlers for the page. Exposes filter setters, row data, dirty map information, loading/saving flags, and the `handleSave` action.

### Modified Files

- `app/dashboard/layout.tsx` — The dashboard layout's sidebar navigation configuration must be updated to include a "Mark Entry" navigation link pointing to `/dashboard/marks/entry`. This link must be conditionally rendered so that it only appears for sessions with the `Admin` or `Teacher` role. The link should be absent from the sidebar when the session belongs to a `Student`. The link should be grouped under a "Marks" section in the sidebar, consistent with the navigation structure established in Phase 2.

---

## Testing Guidance

The following test cases define the expected behavior for integration and unit testing of the Mark Entry page. Each case describes the scenario, the action, and the expected outcome.

**Initial state with no filters selected** — On page load (after settings fetch completes), the page renders four Select components showing their placeholder values. No data grid is visible. The Save Marks button is absent or disabled. No API calls to the students or marks endpoints have been made.

**Grade selection unlocks the class dropdown** — When the user selects a grade, the class selector becomes enabled and fires a request to `GET /api/class-groups?grade={grade}`. Once the response arrives, the class dropdown is populated with the returned section names. The other selectors and the grid are unaffected.

**Full filter selection triggers parallel fetch** — When the user selects a grade, class, term, and subject (in any order), the page fires both `GET /api/students?classId={classId}` and the marks fetch simultaneously. After both resolve, the grid is populated with one row per student, with mark inputs pre-filled from the merged data.

**Editing a mark adds it to the dirty map** — When the user changes a mark input value that differs from the row's `initialMark`, that student's ID appears in the dirty map with the new value. The "unsaved changes" count increments. The row receives the dirty visual treatment.

**Reverting a mark removes it from the dirty map** — When the user changes a mark input back to its original `initialMark` value after having edited it, the student's ID is removed from the dirty map. If this was the only dirty entry, the unsaved changes count drops to zero and the Save button becomes disabled.

**Save button remains disabled when no dirty entries exist** — Immediately after grid population (before any edits), the Save button is disabled. After a successful save that clears all dirty entries, the button returns to the disabled state.

**Yellow caution indicator appears for values below 35** — Entering the value 34 into a mark input causes the yellow `AlertTriangle` icon to appear in the Status column for that row. Entering the value 35 does not trigger the indicator. The indicator is absent for empty inputs.

**Yellow caution indicator shows only the raw number, not "W"** — When the mark input contains 34 and the caution indicator is visible, the rendered input still shows "34" and does not render the letter "W". The "W" display is reserved for read-only views outside this page.

**Red invalid indicator for out-of-range values** — Entering 101 into a mark input causes a red border and an inline error message. The Save button becomes disabled while any row has an invalid value.

**Successful save clears dirty map and updates initialMark** — After a 200 response from `PATCH /api/marks/batch`, the dirty map is empty, the "unsaved changes" count returns to zero, each saved row's `initialMark` is updated to its newly saved value, and a success toast appears.

**Failed save preserves dirty map and shows error toast** — After a 500 response, the dirty map retains all its previous entries, the mark inputs retain their edited values, no `initialMark` values change, and an error toast describes what went wrong.

**beforeunload listener is active when dirty map is non-empty** — While the dirty map has at least one entry, the global `window` object must have a `beforeunload` listener registered. This can be verified in tests by inspecting the event listener registry or by simulating the event.

**beforeunload listener is removed after successful save** — After a successful save that empties the dirty map, the `beforeunload` listener is removed. A subsequent simulated beforeunload does not show the confirmation dialog.

**Student role sees 403 instead of page content** — When the session role is `Student`, the page renders an access denied message within the dashboard shell. No filter selectors, grid, or save button are rendered. No API calls to students or marks endpoints are made.

**Changing grade clears the grid and dirty map** — If the user has loaded a class and made edits, then changes the grade selector, all row data is cleared from state, the dirty map is emptied, and the grid area returns to a blank state pending new filter selections.

---

## Summary

The Mark Entry page is the most interactive single page in the SchoolMS application. Its correct implementation depends on careful state management (four interdependent filter selectors, a dirty map, per-row validation, and parallel data fetching), well-structured component decomposition (the `useMarkEntryState` hook keeping business logic out of the rendering tree), reliable API integration (the `PATCH /api/marks/batch` endpoint from Task 1 of this phase), and thorough UX consideration (loading states, error recovery, navigation guards, and accessibility). Implementing it faithfully according to this specification will produce a professional, teacher-friendly data entry tool at the heart of SchoolMS's academic workflow.
