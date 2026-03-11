# Phase 4: Analytics, Infographics & Preview Mode

**Document Version:** 1.0  
**Phase Number:** 4 of 5  
**Recommended Task Documents: 5**  
**Status:** Pending Implementation  
**Last Updated:** 2026-03-11

---

## Phase Summary

Phase 4 is the most visually complex phase of the SchoolMS project. It builds directly on the data infrastructure, student management, and mark entry systems established in Phases 1 through 3, transforming raw mark records into interactive visual insights and polished presentation artefacts.

This phase has three major pillars:

The first pillar is the individual student performance chart — a grouped bar chart embedded directly into the student profile page. It provides a per-student visual summary of marks across all nine subjects over all three terms, clearly highlighting W-grade marks and the threshold line at mark 35.

The second pillar is the Analytics page, a dedicated, admin-only dashboard section that provides cohort-level visualisations across six distinct chart types. These charts give school administrators a systemic view of grade performance, subject W-rates, class comparisons, and individual student rankings. The analytics data is served through a purpose-built API aggregation route that processes raw mark records from MongoDB Atlas via Prisma and returns pre-computed summaries to the client.

The third pillar is Preview Mode — a full-screen, slide-deck-style presentation environment that renders a single student's progress data as an eight-slide visual presentation. Preview Mode is designed for teacher-parent meetings or classroom displays and offers export as a multi-page PDF, keyboard navigation, theme toggles, fullscreen, and a presenter toolbar.

Phase 4 also introduces the infographic export system: every chart component in the analytics page exposes a PNG download via html2canvas, and a dedicated "Download Full Analytics Report" button assembles all captured chart snapshots into a single structured PDF via react-pdf/renderer. The Preview Mode independently has its own PDF export pathway.

---

## Phase Scope

### In Scope

- Individual student performance grouped bar chart embedded in the student profile page
- Analytics page at the /dashboard/analytics route, accessible to ADMIN and SUPERADMIN roles only
- Analytics API route at GET /api/analytics/summary with grade, term, and year filter parameters
- Six analytics visualisations: Grade Distribution Heatmap, Subject Average Bar Chart, W-Rate Tracker Line Chart, Student Performance Scatter Plot, Top/Bottom Performers Table, Class Comparison Radar Chart
- Per-chart PNG download functionality using html2canvas
- Full Analytics Report PDF download using react-pdf/renderer with embedded chart snapshots
- Preview Mode at /preview/[studentId], opening in a new browser tab
- An eight-slide deck for Preview Mode with Framer Motion slide transitions
- Presenter toolbar with navigation, keyboard controls, font size, theme, aspect ratio, print, PDF export, and fullscreen
- New component files under components/charts and components/preview

### Out of Scope

- Any changes to the mark entry, student management, or user management systems from Phases 1–3
- Attendance tracking or any non-mark-based academic data
- Email or push notifications of analytics
- Real-time data streaming or WebSocket-based live updates
- Multi-language (i18n) support
- Student-facing or parent-facing portals
- Mobile-native apps

---

## Phase Goals — Acceptance Criteria

The following outcomes define phase completion:

1. The student performance bar chart renders correctly on the student profile page with all nine subjects grouped by term, W threshold reference line visible, correct conditional bar colouring, correct data labels (numeric or "W"), and proper handling of terms with no data.

2. The Analytics page loads correctly for ADMIN and SUPERADMIN users and is inaccessible to TEACHER and lower roles.

3. All six analytics chart components render using data from the analytics API summary route. Filter controls (Grade, Term, Year) update all charts when changed.

4. The analytics API route returns the correct pre-computed data shapes for all six visualisation types, computed from raw integer mark values only (no W-rule applied to averages).

5. Every individual chart component on the analytics page exposes a working "Download PNG" button using html2canvas that triggers a PNG file download with the correct filename format.

6. The "Download Full Analytics Report (PDF)" button assembles all chart snapshots into a multi-page PDF and triggers a download.

7. Preview Mode opens in a new tab at /preview/[studentId], displays all eight slides correctly, and all slide content (marks tables, performance chart, highlights, W summary, overall summary) is populated from server-fetched data.

8. Framer Motion transitions animate each slide entry correctly. The performance chart slide has animated bar entrance.

9. The presenter toolbar functions correctly: arrow navigation, keyboard left/right, slide counter, thumbnail strip, font size controls, theme toggle, aspect ratio toggle, print, PDF export, fullscreen, and close.

10. Preview Mode PDF export generates a multi-page PDF via react-pdf/renderer with one slide per page.

---

## Phase Prerequisites

Phase 4 assumes the following are fully operational from earlier phases:

- The database schema is deployed: User, ClassGroup, Student, MarkRecord, and SystemConfig models exist and are functional.
- All student management pages are complete including the student profile page at /dashboard/students/[id], which will receive the performance bar chart in this phase.
- The mark entry system is operational and MarkRecord documents are being written to MongoDB Atlas via Prisma.
- The W-rule utility at lib/w-rule.ts is implemented and tested.
- The PDF progress report from Phase 3 is working, confirming react-pdf/renderer is installed and integrated.
- NextAuth.js session and role-based middleware are configured and protect admin routes.
- Recharts, D3.js version 7.x, html2canvas, and Framer Motion must be installed as npm dependencies before Phase 4 implementation begins.
- The SystemConfig model contains elective category labels used as subject names in charts.

---

## Charting Technology Overview

Phase 4 uses two distinct charting libraries with clearly separated responsibilities. Understanding when to use each is critical to implementing this phase correctly.

### When to Use Recharts

Recharts is the primary charting library for all standard React-renderable chart types. It is used when the chart can be expressed as a configuration of data arrays and React component props without needing imperative DOM manipulation. In Phase 4, Recharts is used for the student performance grouped bar chart, the subject average horizontal bar chart, the W-rate tracker multi-line chart, and the class comparison radar chart.

All Recharts components must be wrapped in a ResponsiveContainer with width set to 100% and an explicit pixel height. This ensures charts scale correctly within their parent containers across different screen widths. The ResponsiveContainer handles resize observation internally, so no manual ResizeObserver is needed.

Recharts exports individual chart primitives — BarChart, LineChart, RadarChart, Bar, Line, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, and ResponsiveContainer — that are composed declaratively in JSX. All custom rendering logic within Recharts (such as custom bar colours or custom data label rendering) is achieved through render props — specifically the "cell" sub-component for conditional bar colouring and the "label" prop on Bar for custom data label content.

### When to Use D3.js

D3.js is used for two bespoke visualisations that cannot be expressed through Recharts' component model: the Grade Distribution Heatmap and the Student Performance Scatter Plot. D3 is chosen for these because they require full positional control over SVG elements, custom colour scales derived from continuous data ranges, and interaction handling (hover tooltips, click navigation) that operates directly on SVG nodes.

D3 components in this project are implemented as React components that use a useEffect hook to run D3 imperatively against a ref-attached SVG element. The D3 code creates scales, axes, groups, rectangles, circles, and text nodes by manipulating the SVG DOM directly. The SVG element is sized using explicit width and height state derived from the parent container's clientWidth via a ResizeObserver, making D3 charts responsive.

D3 tooltips are implemented as a positioned div appended to the chart's parent container, shown and hidden on mouseenter and mouseleave events on SVG elements. The tooltip element is styled with absolute positioning and a high z-index.

### html2canvas for Export

html2canvas is used to capture rendered chart DOM nodes as PNG images. It works by traversing the DOM subtree of a given element and drawing it onto an HTML canvas. The resulting canvas is then converted to a PNG data URL via the toDataURL method and either downloaded directly or collected as a base64 image string for embedding in a PDF.

For Recharts components, the chart SVG is embedded inside a React-managed div, and html2canvas captures the entire div container including any axis labels outside the SVG boundary. For D3 components, the SVG element itself is the capture target.

The PNG filename format for analytics chart downloads follows the pattern: chart-name-grade-term.png (for example: subject-averages-grade10-term1.png). This is constructed client-side at download time using the current filter state.

---

## Individual Student Performance Bar Chart

The student performance bar chart is a Recharts-based grouped bar chart embedded directly into the student profile page at /dashboard/students/[id]. It is the only chart visible outside the analytics section and is also reused in Preview Mode slide 5.

The chart resides in the file components/charts/StudentPerformanceBar.tsx. It receives the student's mark data as props — pre-fetched server-side and serialised before being passed to this client component. The component accepts an array of term mark objects, each containing subject names and their corresponding raw mark values.

### Chart Layout and Structure

The chart uses a grouped (clustered) layout where bars for the same term are side by side. The X-axis presents three groups: Term I, Term II, and Term III. Within each group, there are up to nine bars — one for each subject (six core subjects and three elective category subjects whose labels come from SystemConfig). Each bar represents a single subject's mark for that term.

The Y-axis spans from 0 to 100 with gridlines rendered at 20, 50, and 75. A special reference line is rendered at Y equal to 35 using Recharts' ReferenceLine component. This line is styled as a dashed red line and carries a label reading "W threshold" positioned at the right end of the line. This visual boundary helps viewers immediately identify marks that fall below the W-grade threshold.

The chart is wrapped in a ResponsiveContainer set to 100% width and a fixed height of 380 pixels. This makes it fluid on the student profile page layout regardless of sidebar state or screen size.

### Colour Logic

Every subject is assigned a unique colour from a persistent palette. The palette is a fixed mapping keyed on subject name — meaning the same subject always receives the same colour across all chart instances, whether in the student profile or in Preview Mode. This consistency makes the legend meaningful.

There is one override to this subject-colour rule: any bar whose mark value is below 35 (a W grade) is rendered in a red or pink hue regardless of its assigned subject colour. This override is applied using Recharts' Cell sub-component inside each Bar definition, which iterates over the data entries and selects the appropriate fill colour conditionally. The red/pink colour used for W bars should be visually distinct enough from the normal subject colours to stand out immediately.

### Data Labels

Each bar has a custom label rendered above it. The label logic is as follows: if the mark value is 35 or above, the numeric score is displayed in a small text label above the bar. If the mark value is below 35, the label displays "W" in red bold text. This makes W grades visible even at a glance without needing to hover for a tooltip.

### Tooltip

On hover, the Recharts tooltip shows the subject name, raw mark value, and W status. The W status field displays either "W" or "—" (not W) so the hover detail is unambiguous.

### Legend

A horizontal legend sits below the chart area mapping each colour to its corresponding subject name. The legend uses Recharts' Legend component in horizontal layout. Each legend item displays the colour swatch and subject label. This legend is shared across all three term groups since the subject-to-colour mapping is consistent.

### Missing Terms Handling

If Term II or Term III have no mark data for the student, the corresponding group on the X-axis still renders. However, the bars for that group are empty (zero-height stubs or simply absent depending on implementation) and a "No data" text label is displayed within the group area. This communicates the absence of data explicitly rather than silently compressing the X-axis.

---

## Analytics Page Architecture

The analytics page at /dashboard/analytics is built using the Next.js 14 server component and client component hybrid pattern.

The page component itself (app/dashboard/analytics/page.tsx) is a React Server Component. On initial load, it performs a server-side fetch of the analytics summary data for the default filter values (the current academic year, the first available grade, Term I). It then renders the page shell — heading, filter controls, and the grid of chart components — passing the fetched data as serialised props to each chart component.

The filter controls (Grade selector, Term selector, Year selector) are rendered as a client component. When a user changes any filter, the client component performs a client-side fetch to GET /api/analytics/summary with the updated query parameters. The response replaces the current data state, and all chart components re-render with the new data.

Each of the six analytics visualisations is implemented as its own client component. They receive data as props and do not independently fetch data. All data flows downward from the filter state through the parent analytics page container to each chart component.

The analytics page layout uses a CSS grid with two columns on large screens and a single column on smaller screens. Each chart card has a consistent visual treatment: a card container with a heading, a description line, the chart itself, and a "Download PNG" button at the bottom of the card.

### Role Guard

The analytics page is protected at the middleware level. Only authenticated users with the ADMIN or SUPERADMIN role may access /dashboard/analytics. TEACHER-role users are redirected to their permitted dashboard section. Unauthenticated users are redirected to the sign-in page.

### Data Flow Diagram (Described in Prose)

On first page render, the server component fetches from the analytics API using server-side credentials, receives the summary payload, and injects it as props into the client analytics container. The client analytics container holds the filter state and the current data payload in React state. When a filter changes, the container calls the analytics API via fetch with the new filter parameters, then updates both the filter state and the data state simultaneously. Each chart sub-component observes the data as a prop and re-renders whenever the data prop changes, with no internal data fetching.

---

## Analytics API Route Design

The analytics API route is a GET handler at /api/analytics/summary. It is protected and requires an authenticated ADMIN or SUPERADMIN session.

### Query Parameters

The route accepts three query parameters: grade (a string representing the grade number, e.g., "10"), term (a string representing the term identifier, e.g., "I", "II", or "III"), and year (a four-digit string representing the academic year, e.g., "2025").

When a parameter is absent, the route applies a sensible default: the current academic year from SystemConfig, all grades combined, or Term I. Filter combinations are validated before querying.

### Aggregation Strategy

The route uses Prisma to query the MarkRecord collection. It finds all mark records matching the given grade, term, and year filters, then performs in-memory aggregation to produce the required data shapes. The route never applies the W-rule to computed averages — all calculations are performed on raw integer mark values.

### Returned Data Shape

The API returns a single JSON object containing the following fields, each described in detail:

**subjectAverages** — An array of objects, one per subject. Each object contains the subject name, the computed average of raw marks across all matching students, and the count of students contributing to that average. Subjects with zero entries for the filtered criteria still appear in the array with a null average and zero count.

**wRates** — An array of objects, one per subject. Each object contains the subject name, the count of students with a mark below 35 in that subject for the filtered term/grade/year, the total number of students with marks entered for that subject, and the computed W percentage (W count divided by total, multiplied by 100, rounded to one decimal place).

**classComparisons** — An array of objects, one per class section within the filtered grade. Each object contains the section label (e.g., "10A", "10B") and a nested array of subject averages in the same structure as subjectAverages but scoped to that section's students only.

**topPerformers** — An array of up to ten objects representing the students with the highest total marks for the filtered grade and term. Each object contains the student's index number, full name, class label, total raw marks summed across all nine subjects, and total W count.

**bottomPerformers** — An array of up to ten objects in the same structure as topPerformers, ordered ascending by total marks (lowest first).

**heatmapData** — A two-dimensional matrix representing grade distribution across subjects and mark ranges. The outer array is indexed by subject. Each subject entry contains five objects — one for each mark range band (0–34, 35–49, 50–64, 65–79, 80–100) — each containing the count of students in that band for that subject, and the percentage of the total cohort that count represents.

**scatterData** — An array of objects, one per student in the filtered grade/class/term/year. Each object contains the student's index number, name, the URL path to their profile page (/dashboard/students/[id]), their total raw marks summed across all subjects and terms entered, and their total W count.

---

## Grade Distribution Heatmap Design

The Grade Distribution Heatmap is a D3.js visualisation implemented as a React component in components/infographics/GradeDistributionHeatmap.tsx.

### SVG Structure

The heatmap renders as a single SVG element with explicit margins for axis labels. The grid rows correspond to the nine subjects (six core subjects and three elective categories from SystemConfig). The grid columns correspond to five mark range bands: 0–34, 35–49, 50–64, 65–79, and 80–100.

Each cell in the grid is a D3-rendered SVG rectangle. Cell width and height are computed from the SVG dimensions and the number of rows and columns. The SVG dimensions are determined reactively using a ResizeObserver on the component's container div, so the chart reflows when the container resizes.

### Colour Scale

The cell fill colour is determined by a D3 sequential colour scale (scaleSequential) mapping the percentage value of students in that cell's range from 0% to 100%. Low-density cells (near 0%) are filled with a very light tint. High-density cells (near 100%) are filled with a saturated dark colour. A suitable sequential colour scheme from D3's chromatic module (such as Blues or YlOrRd) can be used. The colour scale must be computed from the full range of values in the current filtered dataset, not hardcoded.

### Row and Column Labels

Row labels (subject names) are rendered as SVG text elements on the left side of the grid. Column labels (mark range strings) are rendered as SVG text elements along the top of the grid, rotated if needed for legibility. Both axis label groups are positioned within the defined SVG margins.

### Hover Tooltip

When the user hovers over any grid cell, a positioned tooltip div is shown adjacent to the pointer. The tooltip displays the subject name, the mark range label, the count of students in that cell, and the percentage of the cohort. The tooltip is hidden on mouseleave. The tooltip element is managed as a React ref to a div styled with absolute positioning, so it does not cause re-renders on every position update.

### Filter Controls

The heatmap has its own inline filter row above the chart: a Grade selector (grades 6–11), a Term selector (Term I, Term II, Term III), and a Year selector. Changing any filter triggers a re-fetch via the parent analytics container's filter state update mechanism, and the heatmap re-renders with the new heatmapData prop.

### Export

The "Download PNG" button below the heatmap card uses html2canvas to capture the heatmap's container div (including axis labels and the SVG grid) and downloads the result as a PNG named according to the current filter state.

---

## Subject Average Bar Chart Design

The Subject Average Bar Chart is a Recharts component implemented in components/charts/SubjectAverageBar.tsx.

This chart uses a horizontal bar layout (Recharts BarChart with layout set to "vertical"). In this layout, the Y-axis lists subject names (categorical) and the X-axis shows mark values from 0 to 100. Each bar extends horizontally from 0 to the computed average mark for that subject across all students matching the current filters.

### Conditional Bar Colouring

Bar colours are conditionally assigned based on the average value: bars with an average below 35 are filled red, indicating critical performance. Bars with an average between 35 and 50 (inclusive of 35, exclusive of 50) are filled amber, indicating borderline performance. Bars with an average of 50 or above are filled green, indicating acceptable or strong performance. This conditional colouring is applied using the Recharts Cell sub-component inside the Bar definition.

### Annotations

The numeric average value is displayed at the end of each bar as a data label. This allows the viewer to read exact values without hovering.

### Layout

The chart is wrapped in a ResponsiveContainer at 100% width. The height is set to accommodate all subject labels without truncation — typically around 360 pixels for nine subjects.

### Filter Controls

The Subject Average Bar Chart shares the analytics page filter state (Grade, Term, Year). When the filter changes, the component receives new subjectAverages data as props and re-renders.

---

## W-Rate Tracker Line Chart Design

The W-Rate Tracker is a Recharts multi-line chart implemented in components/charts/WRateTracker.tsx. Its purpose is to visualise, for a selected grade and year, how the percentage of students earning a W grade in each subject has changed across Term I, Term II, and Term III.

### Data Shape

The chart operates on the wRates data from the analytics API, but requires all three terms' data simultaneously. This means when the W-Rate Tracker is active, the analytics container fetches wRates for all three terms for the selected grade and year, rather than for a single selected term. The filter for this chart has only Grade and Year selectors — Term is not a filter for this chart because the X-axis is the term progression itself.

The X-axis of the chart has three tick values: Term I, Term II, Term III. The Y-axis represents the W percentage from 0 to 100, labelled as a percentage. Each line in the chart represents one subject. For a given subject, the line connects three data points — one per term — showing the W percentage at each term.

### Visual Design

Each subject line is assigned the same subject colour used in the student performance bar chart palette for consistency. A Recharts CartesianGrid provides horizontal reference lines. The Recharts Legend identifies each line by subject name. The Recharts Tooltip shows the subject name, term, and W percentage on hover.

A horizontal reference line is optionally drawn at Y equal to 50% to visually indicate when more than half the students in the cohort have a W grade for a subject — a critical threshold that should trigger intervention.

### Purpose and Use

The chart is intended to help administrators identify subjects where W rates are systematically worsening across terms, or subjects that are consistently problematic regardless of term. A subject with a rising line slope over all three terms is a signal of curriculum or pedagogical issues.

---

## Student Performance Scatter Plot Design

The Student Performance Scatter Plot is a D3.js visualisation implemented in components/infographics/StudentScatterPlot.tsx.

### SVG Structure and Axes

The plot renders an SVG with margins for axis labels. The X-axis represents total marks — the sum of all nine subjects' raw marks across all entered terms for each student. The Y-axis plots students sorted alphabetically, with each student occupying one discrete vertical position. Because the Y-axis is categorical (student identifiers) in a continuous layout, it uses a D3 band scale mapping student index numbers to Y positions.

### Point Rendering

Each data point is a filled circle. The circle's X position is determined by the student's total marks on the continuous X scale. The Y position is determined by the student's rank in the alphabetical ordering using the band scale. Point radius is fixed at 5 pixels.

### Point Colour Coding by W Count

Colour is assigned based on the student's total count of W grades across all subjects and terms in the current filter scope: students with zero W grades are coloured green. Students with 1 or 2 W grades are coloured amber. Students with 3 or more W grades are coloured red. This colour coding immediately communicates the student's academic risk level.

### Click Navigation

Each data point is interactive. When clicked, D3's click event handler uses the student's profile URL from the scatterData item to navigate the browser to the student's profile page (/dashboard/students/[id]). The cursor property on the SVG circles is set to "pointer" to communicate interactivity.

A hover tooltip appears on mouseenter, showing the student's name, index number, total marks, and W count. It hides on mouseleave.

### Filter Controls

The scatter plot has Grade, Class (section within the grade), Term, and Year selectors. The Class selector is populated dynamically based on the selected Grade — it lists all sections of that grade. These filters drive the data fetched from the analytics API's scatterData field.

---

## Top/Bottom Performers Table Design

The Top/Bottom Performers section is implemented in the analytics page without a dedicated Recharts chart. It renders two plain HTML tables side by side — one for the top 10 performers and one for the bottom 10 performers — based on total raw marks for the filtered grade and term.

### Table Columns

Both tables share the same column structure: Rank (1–10), Index Number, Student Name, Class, Total Marks, and W Count. The Rank column is computed client-side from the sorted position in the array. The Student Name cell is a hyperlink navigating to the student's profile page.

### Sorting Logic

The top performers table lists students in descending order of total marks (highest first). The bottom performers table lists students in ascending order of total marks (lowest first). If two students share the same total marks, they are sub-sorted alphabetically by name.

### Visual Treatment

The top performers table uses a subtle gold/green background tint on the first row (rank 1) to highlight the highest performer. The bottom performers table uses a subtle red tint on the last row (rank 10, the lowest performer). Rows with a W Count above zero have the W Count cell rendered in red to draw attention to at-risk students even among high performers.

### Filter Controls

Grade, Term, and Year selectors control this section. The data comes from topPerformers and bottomPerformers in the analytics API response.

---

## Class Comparison Radar Chart Design

The Class Comparison Radar Chart is a Recharts component implemented in components/charts/ClassComparisonRadar.tsx.

This chart uses Recharts' RadarChart component to render a spider/radar plot where each axis corresponds to one of the nine subjects. For each axis, the metric plotted is the average raw mark of the subject across all students in the class section for the selected grade and term.

### Multi-Polygon Layout

Each class section within the selected grade is represented as a separate coloured polygon (Recharts' Radar component). For example, if Grade 10 has sections 10A, 10B, and 10C, three overlapping polygons are drawn. The Recharts PolarGrid renders the underlying grid lines. PolarAngleAxis renders the subject name labels on each axis spoke. PolarRadiusAxis renders the concentric scale rings from 0 to 100.

### Colour Legend

Each polygon is assigned a distinct colour from a palette. The Recharts Legend component below the chart maps colours to class section labels. The Recharts Tooltip shows per-subject average values for all classes on hover of the chart area.

### Responsiveness

The RadarChart is wrapped in a ResponsiveContainer at 100% width and approximately 400 pixels height.

### Filter Controls

Grade (which determines which sections are shown — all sections of the selected grade are overlaid), Term, and Year selectors control the data. The data source is classComparisons from the analytics API.

---

## Infographic Export Design

### Per-Chart PNG Download

Each analytics chart card has a "Download PNG" button at its bottom-right. When clicked, the button handler uses html2canvas to capture the chart's wrapper div — including the chart title, SVG or canvas content, and any axis labels — and converts the rendered output to a PNG.

The captured canvas is turned into a data URL using the toDataURL method. A temporary anchor element is created programmatically, its href attribute is set to the data URL, its download attribute is set to the filename string (constructed from the chart type, current grade filter, and current term filter), and then the anchor's click method is triggered. The anchor element is removed from the DOM immediately after.

This entire sequence is synchronous from the user's perspective — clicking the button triggers a brief pause while html2canvas renders, then the browser's native file save dialog appears.

### Full Analytics Report PDF Download

The "Download Full Analytics Report (PDF)" button triggers a multi-step process:

First, html2canvas is called sequentially on each of the six chart containers, capturing their current rendered state as base64 PNG strings. During this capture phase, a loading spinner or progress indicator is shown to the user.

Once all chart images are captured, they are sent to a server-side PDF assembly route. The server-side route uses react-pdf/renderer to compose a multi-page PDF document. Each page in the PDF contains one chart image (embedded via the Image component from react-pdf/renderer), a page heading, and the current filter values as a subtitle. A summary page is included at the front of the PDF with the school name (from SystemConfig), the report title, the date of generation, and the filter scope applied.

The server-side route returns the PDF as a binary response with the appropriate Content-Type and Content-Disposition headers. The client receives this binary response and triggers a download.

Because the PDF contains rasterised chart images rather than vector data, the image quality depends on the resolution passed to html2canvas. The scale option of html2canvas should be set to 2 (device pixel ratio multiplier) to produce sharp images at typical screen densities.

---

## Preview Mode Architecture

Preview Mode is a self-contained section of the application living at the /preview/[studentId] route. It is a separate page from the main dashboard — it does not render the dashboard sidebar or topbar.

### Server-Side Data Fetching

The page component at app/preview/[studentId]/page.tsx is a React Server Component. It uses the [studentId] route parameter to fetch the student's full record from the database via Prisma, including all three terms' mark records. The W-rule is applied server-side before the data is passed to the client: each mark value is evaluated against the threshold and tagged with its W status. This means the client component receives a fully enriched data object and performs no additional DB queries.

The page component passes the enriched student and marks data as serialised props to the preview client component, which manages slide state.

### Authentication

The Preview Mode route requires an authenticated session. Any authenticated user — regardless of role — can access /preview/[studentId]. However, the route returns a 404 for invalid student IDs and a 401 for unauthenticated requests. Since the page is opened via a "Preview Mode" button on the student profile page (which is itself admin-protected), unauthorised deep-linking is an edge case handled by the auth middleware redirect.

### New Tab Behaviour

The "Preview Mode" button on the student profile page sets its target to "_blank" (or uses window.open) to open the Preview URL in a new browser tab. This means the preview experience is fully separate from the dashboard session and does not disturb any unsaved state in the dashboard.

### Framer Motion Integration

The client component that manages slide state imports AnimatePresence and motion from the Framer Motion library. AnimatePresence wraps the current slide renderer component so that when the slide index changes, the exiting slide plays its exit animation and the entering slide plays its entry animation concurrently. The default animation for slide transitions is a fade combined with a slight vertical translate (the slide enters moving upward from a slight downward offset). The performance chart slide (slide 5) also triggers a bar entrance animation in the StudentPerformanceBar component upon mount — this is achieved by animating the initial chart width from zero to full width via Recharts' animation props.

---

## Slide Deck Design

The eight slides of the Preview Mode deck are as follows:

### Slide 1 — Student Overview

Slide 1 is the title slide. It displays the student's full name in large, prominent typography. Below the name, the student's index number is shown. A grade and class badge (e.g., "Grade 10 — Section B") is displayed prominently. The academic year is shown. If a school logo URL is configured in SystemConfig, the logo image is rendered in the corner of the slide. This slide is purely informational and contains no marks data.

### Slides 2, 3, 4 — Term Marks Tables

Slides 2, 3, and 4 each present the marks table for Term I, Term II, and Term III respectively. All three slides use an identical visual layout: a full-width styled table with two columns — Subject and Mark. The table lists all nine subjects (six core and three elective categories). Mark cells containing W-grade values are highlighted with a red background or red text to draw the viewer's attention. Subjects for which no mark has been entered are displayed as an em dash ("—") to distinguish absent data from a zero mark.

The slide heading clearly identifies the term (e.g., "Term II Marks"). A subtle divider separates the heading from the table. The table typography is sized for legibility on a projector screen.

### Slide 5 — Performance Chart

Slide 5 renders the StudentPerformanceBar.tsx component at full-slide scale. The ResponsiveContainer occupies the full width and an increased height to fill the slide canvas. The bars animate on entry — using Recharts' built-in animation duration prop set to an appropriate duration for a presentation context (approximately 800 milliseconds). The W threshold reference line is visible. The legend is displayed below the chart. This slide provides the most visually dense summary of the student's performance across all terms.

### Slide 6 — Subject Highlights

Slide 6 uses a two-column layout within the slide canvas. The left column highlights the student's strongest subject — defined as the subject with the highest average mark across all entered terms. The right column highlights the weakest subject — defined as the subject with the lowest average across all entered terms, or the subject with the most W grades if there are any. Each column displays the subject name, a colour swatch matching its bar chart colour, and the mark value. The mark value is rendered with a Framer Motion animated count-up: starting from zero and counting up to the actual value over approximately one second on slide entry.

### Slide 7 — W Summary

Slide 7 has two possible states depending on the student's W record. If the student has no W grades across all entered terms, the slide renders a full-slide congratulations card with a positive message and visual treatment. If the student has one or more W grades, the slide renders a list of affected subjects grouped by term. For each W entry, the subject name, the term it occurred in, and the raw mark value are displayed. Below the list, a brief recommendation text is shown — a fixed string noting that W grades may require supplementary assessment or teacher consultation.

### Slide 8 — Overall Summary

Slide 8 is the closing summary slide. It displays the student's total marks — the sum of all raw marks across all nine subjects and all entered terms. It displays the student's class rank if the class ranking feature is enabled in SystemConfig settings. The student is assigned a qualitative performance descriptor based on their average mark across all entered subjects and terms: "Excellent" for an average of 80% or above, "Good" for 60–79%, "Needs Improvement" for 45–59%, and "Critical" for below 45%. The descriptor is displayed in large typography with a colour coding matching its severity (green for Excellent, amber for Good, orange for Needs Improvement, red for Critical).

---

## Presenter Toolbar Design

The presenter toolbar is a floating control strip that appears at the bottom of the Preview Mode window. It is implemented in components/preview/PresenterToolbar.tsx and is always visible (does not auto-hide) unless the fullscreen mode is active and the user has moved the cursor away from the bottom edge, in which case it auto-hides and reveals on hover.

### Navigation Controls

A left arrow button navigates to the previous slide. A right arrow button navigates to the next slide. At the first slide, the left arrow is disabled but still visible. At the last slide, the right arrow is disabled. Both arrow keys on the keyboard (left and right) trigger the same navigation actions — this is achieved via a useEffect that attaches a keydown event listener to the window object on component mount.

### Slide Counter

The centre of the toolbar displays the current slide number as a fraction: "3 / 8". Clicking the slide counter opens the thumbnail strip panel (component: SlideThumbnailStrip.tsx). The thumbnail strip slides up from the bottom of the screen and shows miniature previews of all eight slides. Clicking any thumbnail jumps directly to that slide.

### Font Size Control

Two buttons — a smaller "A" and a larger "A" — allow the user to decrease or increase a font size multiplier. This multiplier is applied to the base font size on the slide canvas container, causing all text within the slides to scale proportionally. The scale steps in increments of 0.1, with a minimum of 0.7 and a maximum of 1.5. This is intended for accessibility and projector distance adjustment.

### Theme Toggle

A sun/moon toggle button switches the slide canvas between a dark-mode theme (dark background, light text) and a light-mode theme (white background, dark text). The default theme is dark. The toggle is implemented by swapping a CSS class on the slide canvas container, and all slide content uses theme-aware CSS variables for colours.

### Aspect Ratio Toggle

A toggle button switches the slide canvas container between 16:9 dimensions (landscape, typical projector format) and A4 proportions (portrait, typical print format). A4 is 210mm wide by 297mm tall, which translates to approximately 794 pixels wide by 1123 pixels tall at 96 dpi. This affects the canvas container's aspect-ratio CSS property. All slide content is designed to be legible in both modes, though some slides may require scrolling in A4 mode.

### Print Button

Clicking the print button calls window.print(). A print stylesheet (loaded only in the Preview Mode page) transforms the slide deck into a printable multi-page document, one slide per page, suppressing the toolbar and applying print-appropriate margins.

### Download PDF Button

Clicking the "Download PDF" button triggers the Preview Mode PDF export. This is implemented client-side using react-pdf/renderer to generate a multi-page PDF, one slide per page. Because react-pdf/renderer renders PDF content using a separate virtual DOM (not the browser DOM), slide content must be re-expressed as react-pdf/renderer primitives (View, Text, Image). The performance chart slide is captured using html2canvas first, and the resulting image is embedded in the corresponding PDF page. All other slides are expressed purely as react-pdf text and layout primitives.

### Fullscreen Button

Clicking the fullscreen button calls document.documentElement.requestFullscreen(). This expands the entire page to occupy the physical display. A subsequent click (or pressing Escape) calls document.exitFullscreen(). The toolbar listens to the fullscreenchange event to update the button icon between "enter fullscreen" and "exit fullscreen" states.

### Close Button

Clicking the close button calls window.close(). Because the Preview Mode opens in a new tab spawned by the dashboard (using window.open), window.close() successfully closes the tab and returns the user to the dashboard. If the tab was opened by typing the URL directly (not from the dashboard), window.close() may be blocked by the browser — in this case, a fallback text message advises the user to close the tab manually.

---

## Preview Mode PDF Export

The PDF export from Preview Mode produces a self-contained, multi-page PDF document with one slide per page.

The document is generated entirely client-side using react-pdf/renderer. Each slide type is mapped to a react-pdf View layout that mirrors the visual structure of the on-screen slide, expressed using the primitive components available in react-pdf/renderer: Document, Page, View, Text, and Image.

For slides 2, 3, and 4 (the marks tables), the PDF equivalent is a View containing a grid of nested Views forming rows and columns, styled with react-pdf style objects.

For slide 5 (the performance chart), the StudentPerformanceBar component is captured using html2canvas before PDF generation begins, and the resulting base64 PNG string is embedded in the corresponding PDF page using the Image component.

For slides 6 and 8 (Subject Highlights and Overall Summary), the PDF renders static text equivalents of the count-up animated values — showing the final values without animation.

The PDF page size is set to A4 in landscape orientation for 16:9 aspect ratio mode, and A4 in portrait orientation for A4 aspect ratio mode — matching the selected aspect ratio in the toolbar at the time the export is triggered. The school name and logo (from SystemConfig) are embedded in a header on each page.

---

## Component Organisation

The following new components are created in Phase 4. Each is listed with its file path relative to the project root and its responsibility.

| Component File | Type | Responsibility |
|---|---|---|
| components/charts/StudentPerformanceBar.tsx | Client | Grouped bar chart for one student's marks across all terms and subjects. Used in student profile page and Preview Mode slide 5. |
| components/charts/SubjectAverageBar.tsx | Client | Horizontal bar chart showing average mark per subject for a cohort. Used on analytics page. |
| components/charts/WRateTracker.tsx | Client | Multi-line chart tracking W percentage per subject across all three terms. Used on analytics page. |
| components/charts/ClassComparisonRadar.tsx | Client | Radar chart comparing average subject marks across class sections within a grade. Used on analytics page. |
| components/infographics/GradeDistributionHeatmap.tsx | Client | D3 SVG heatmap showing student count distribution across mark ranges per subject. Used on analytics page. |
| components/infographics/StudentScatterPlot.tsx | Client | D3 scatter plot mapping students by total marks and W count. Used on analytics page. |
| components/preview/SlideRenderer.tsx | Client | Renders the content of each individual slide type based on a slide index prop. Used in the Preview Mode page. |
| components/preview/PresenterToolbar.tsx | Client | Floating toolbar with all presenter controls. Used in the Preview Mode page. |
| components/preview/SlideThumbnailStrip.tsx | Client | Thumbnail grid for jumping to a specific slide. Used within PresenterToolbar. |

Additionally, the following API route and page files are created:

- app/api/analytics/summary/route.ts — The analytics aggregation API route.
- app/api/preview/pdf/route.ts — The server-side PDF assembly route for the full analytics report PDF.
- app/dashboard/analytics/page.tsx — The analytics dashboard page (server component shell).
- app/preview/[studentId]/page.tsx — The Preview Mode page (server component).

---

## Recommended Task Documents

Phase 4 is split into five task documents reflecting its three major pillars and the complexity of each visual component group.

### Task 4.1 — Student Performance Bar Chart and Student Profile Integration

**Scope:** Implement the StudentPerformanceBar.tsx component in full. Integrate it into the student profile page (/dashboard/students/[id]). Implement all colour logic, W threshold reference line, conditional data labels, tooltip, legend, and missing terms handling. Verify the chart is correctly populated from the server-fetched student marks data.  
**Complexity:** Medium. Relies on Recharts knowledge and careful conditional rendering logic.

### Task 4.2 — Analytics API Route and Page Architecture

**Scope:** Implement the GET /api/analytics/summary route. Implement all six data aggregation functions (subjectAverages, wRates, classComparisons, topPerformers, bottomPerformers, heatmapData, scatterData). Build the analytics page shell with filter controls and the client/server component split. Implement role guard. Wire filter state to API re-fetch.  
**Complexity:** High. Requires Prisma aggregation design, careful handling of null/missing data, and the dual server/client component architecture.

### Task 4.3 — Analytics Chart Components

**Scope:** Implement all six analytics visualisation components: GradeDistributionHeatmap (D3), SubjectAverageBar (Recharts), WRateTracker (Recharts), StudentScatterPlot (D3), Top/Bottom Performers Table, ClassComparisonRadar (Recharts). Implement the per-chart PNG download button using html2canvas. Implement the "Download Full Analytics Report (PDF)" button and its server-side assembly route.  
**Complexity:** Very High. Requires both D3 and Recharts expertise, careful responsive layout work, html2canvas integration, and pdf assembly.

### Task 4.4 — Preview Mode Slides and Architecture

**Scope:** Build the /preview/[studentId] page. Implement server-side data fetching and W-rule enrichment. Set up the Framer Motion AnimatePresence slide transition system. Implement all eight SlideRenderer slide variants. Implement the slide 5 bar chart animation. Implement the slide 6 count-up animation.  
**Complexity:** High. Requires Framer Motion integration, careful slide layout design for both 16:9 and A4 aspect ratios, and W-rule data enrichment.

### Task 4.5 — Preview Mode Presenter Toolbar and PDF Export

**Scope:** Implement PresenterToolbar.tsx with all controls: arrow navigation, keyboard event listeners, slide counter, SlideThumbnailStrip.tsx, font size control, theme toggle, aspect ratio toggle, print button (window.print), Download PDF button (react-pdf/renderer multi-page), fullscreen button (Fullscreen API), and close button. Implement the Preview Mode PDF export including html2canvas capture of the performance chart slide.  
**Complexity:** High. Requires browser API integration (Fullscreen API, keyboard events, window.print), Framer Motion for thumbnail strip animation, and react-pdf multi-page document composition.

---

## Phase Completion Checklist

The following items must all be verified before Phase 4 is considered complete:

- [ ] StudentPerformanceBar renders on the student profile page with correct data, colours, labels, W threshold line, and missing term handling
- [ ] Analytics page is accessible to ADMIN and SUPERADMIN only
- [ ] Analytics page filter controls (Grade, Term, Year) update all charts on change
- [ ] GET /api/analytics/summary returns all seven data fields with correct aggregated values
- [ ] GradeDistributionHeatmap renders as a D3 SVG grid with correct colour scaling and hover tooltip
- [ ] SubjectAverageBar renders horizontal bars with correct conditional colouring and numeric labels
- [ ] WRateTracker renders multi-line chart with correct W percentage data across all three terms
- [ ] StudentScatterPlot renders D3 scatter plot with correct point colouring by W count and click-to-profile navigation
- [ ] Top/Bottom Performers tables render with correct ranking, links to profiles, and red W count highlighting
- [ ] ClassComparisonRadar renders multi-polygon radar chart for all sections in the selected grade
- [ ] Per-chart PNG download works for all six chart components and produces correctly named files
- [ ] Full Analytics Report PDF download captures all six charts and assembles them into a multi-page PDF
- [ ] Preview Mode page opens in a new tab at /preview/[studentId]
- [ ] All eight Preview Mode slides render with correct content from server-fetched data
- [ ] Slide transitions animate correctly with Framer Motion (fade + translate)
- [ ] Performance chart slide (slide 5) has animated bar entrance
- [ ] Subject Highlights slide (slide 6) has animated count-up for mark values
- [ ] PresenterToolbar: arrow buttons navigate slides correctly
- [ ] PresenterToolbar: keyboard left/right keys navigate slides
- [ ] PresenterToolbar: slide counter click opens SlideThumbnailStrip
- [ ] PresenterToolbar: font size increase/decrease controls work
- [ ] PresenterToolbar: theme toggle switches between dark and light modes
- [ ] PresenterToolbar: aspect ratio toggle switches between 16:9 and A4
- [ ] PresenterToolbar: print button triggers window.print()
- [ ] PresenterToolbar: fullscreen button uses Fullscreen API correctly
- [ ] PresenterToolbar: close button calls window.close()
- [ ] Preview Mode PDF export generates a multi-page PDF with one slide per page including the chart image on slide 5

---

## Dependencies for Phase 5

Phase 5 covers backup, security hardening, and end-to-end testing. The following Phase 4 deliverables are depended on by Phase 5:

- The analytics API route must be stable and tested before Phase 5 writes integration tests against it.
- The Preview Mode page must be implemented before Phase 5 writes Playwright or Cypress end-to-end tests for the slide deck.
- The per-chart PNG export and full PDF download must be working before Phase 5 writes smoke tests for export functionality.
- All new Phase 4 API routes must have authentication and authorisation confirmed working before Phase 5 security review.
- The StudentPerformanceBar component must be stable before Phase 5 visual regression testing is configured.
