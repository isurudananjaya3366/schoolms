# Task 4.3 — Analytics Chart Components

**Phase:** 4 — Analytics, Infographics and Preview Mode
**Task Number:** 4.3 of 5
**Complexity:** Very High
**Depends On:** Task 4.2 complete (analytics API and page shell operational, data props flowing)

---

## Objective

This task implements all six chart and infographic components that visualise the analytics dataset assembled in Task 4.2. Each component is wired into the analytics page container, and both per-chart PNG export and a full multi-chart PDF download are added to complete the analytics feature.

---

## Deliverables

- components/infographics/GradeDistributionHeatmap.tsx — D3 SVG heatmap showing mark-band frequencies per subject
- components/charts/SubjectAverageBar.tsx — Recharts horizontal bar chart of subject averages with conditional colouring
- components/charts/WRateTracker.tsx — Recharts multi-line chart tracking W-rate across all three terms per subject
- components/infographics/StudentScatterPlot.tsx — D3 SVG scatter plot of student total marks with W-count colour coding
- components/charts/TopBottomPerformers.tsx — Plain HTML table component showing ranked top and bottom performers
- components/charts/ClassComparisonRadar.tsx — Recharts radar chart comparing subject averages across class sections
- app/api/preview/pdf/route.ts — Server-side POST route that assembles a multi-page analytics PDF from base64 chart images
- Updates to the analytics page to mount all six chart components, attach a React ref to each chart wrapper div, and add per-chart PNG download buttons and the full report PDF download button

---

## Technology Summary

| Component | Library | Rendering Mode | Responsiveness Strategy |
|---|---|---|---|
| GradeDistributionHeatmap | D3 | SVG imperative via useEffect | ResizeObserver on wrapper div |
| SubjectAverageBar | Recharts | Declarative JSX | Recharts ResponsiveContainer |
| WRateTracker | Recharts | Declarative JSX | Recharts ResponsiveContainer |
| StudentScatterPlot | D3 | SVG imperative via useEffect | ResizeObserver on wrapper div |
| TopBottomPerformers | None | HTML tables | CSS flex with column fallback |
| ClassComparisonRadar | Recharts | Declarative JSX | Recharts ResponsiveContainer |

---

## Component Prop Interfaces

Each chart component accepts a typed data prop provided exclusively by the analytics container. The shapes are described below. All data transformation — filtering, sorting, and aggregating — is performed in the container before props are passed. Chart components must not mutate or re-derive prop data internally.

| Component | Prop Name | Entry Shape |
|---|---|---|
| GradeDistributionHeatmap | heatmapData | subject, bandLabel, bandRange, count, percentage |
| SubjectAverageBar | subjectAverages | subject, average (number 0–100) |
| WRateTracker | wRatesAllTerms | subject, termLabel, wPercentage |
| StudentScatterPlot | scatterData | id, name, totalMarks, wCount, section, profileUrl |
| TopBottomPerformers | topPerformers / bottomPerformers | rank, indexNo, name, section, totalMarks, wCount, profileUrl |
| ClassComparisonRadar | classComparisons | section, subjectAverages (map of subject → number) |

---

## Dependencies and Package Requirements

The following packages must be present in the project before beginning this task. All versions should align with those used elsewhere in the codebase.

| Package | Version Constraint | Purpose |
|---|---|---|
| recharts | ^2.x | SubjectAverageBar, WRateTracker, ClassComparisonRadar |
| d3 | ^7.x | GradeDistributionHeatmap, StudentScatterPlot |
| html2canvas | ^1.x | Per-chart PNG capture and PDF capture pipeline |
| @react-pdf/renderer | ^3.x | Server-side PDF assembly route |

D3 type definitions should also be installed as a dev dependency if the project uses TypeScript strictly. html2canvas should be imported dynamically (using a dynamic import) inside the download handler function rather than at the module top level, because it is a browser-only module and its presence at module load time causes server-side rendering errors in Next.js. This dynamic import pattern applies both to per-chart PNG download handlers and to the full PDF capture sequence.

---

## Context and Background

Task 4.2 established the analytics API endpoints and the analytics container page. That container is responsible for fetching all required data, holding it in state, applying the grade, term, and section filter selections, and passing the filtered result sets down as typed props. This task builds exclusively on that foundation. None of the chart components introduced here perform any data fetching of their own — they are purely presentational and receive their entire dataset through explicitly defined props.

The six components split across two charting technologies and one plain HTML approach. The Subject Average Bar chart, the W-Rate Tracker, and the Class Comparison Radar chart are implemented with Recharts, which integrates naturally with React's rendering model and handles responsiveness through its built-in ResponsiveContainer wrapper. The Grade Distribution Heatmap and Student Scatter Plot are built with D3 operating in imperative SVG mode, where a useEffect hook drives the D3 rendering code against a DOM node via a ref. D3 is chosen for these two because their visual layouts — a continuous percentage-mapped colour grid and a band-scale scatter plot — are difficult to express cleanly within Recharts' declarative primitive set. The Top/Bottom Performers component uses no charting library; it renders directly as a pair of styled HTML tables with conditional row highlighting.

The PNG download system uses html2canvas to rasterise each chart's wrapper div. html2canvas traverses the live DOM and renders all visible CSS and SVG content to an HTML canvas element, which then yields a PNG data URL. This approach works equally well for D3 SVG output and Recharts SVG output because html2canvas processes the composed DOM rather than the React component tree. A scale factor of 2 is passed to html2canvas so captured images are sharp on standard-density displays. Filenames are constructed dynamically from the current filter state values so that downloaded images are self-describing and do not overwrite each other across different filter combinations.

The full analytics PDF download orchestrates sequential html2canvas captures across all six chart wrappers, accumulates the base64 PNG strings, and sends them in a single POST request to the server-side route at app/api/preview/pdf. That route uses react-pdf/renderer to compose a multi-page PDF document with one chart image per page beneath a consistent school-branded header. The server-side approach is architecturally necessary because react-pdf/renderer does not run in a browser context. Additionally, D3 SVG output cannot be embedded as react-pdf/renderer primitives — rasterising all charts through html2canvas before the POST is therefore a firm requirement rather than an optional optimisation.

---

## Data Flow Overview

The following table maps each chart component to the API endpoint introduced in Task 4.2 that originally sources its data, and to the transformation step the analytics container must apply before passing the prop.

| Chart Component | Source API Endpoint | Container Transformation |
|---|---|---|
| GradeDistributionHeatmap | /api/analytics/grade-distribution | Group by subject and band; compute row counts and percentages |
| SubjectAverageBar | /api/analytics/subject-averages | Pass array directly; already in correct shape |
| WRateTracker | /api/analytics/w-rates (all-terms fetch) | Flatten subject-term pairs; must not be filtered by active term |
| StudentScatterPlot | /api/analytics/student-marks | Aggregate per-student total marks; compute W count; attach profileUrl |
| TopBottomPerformers | /api/analytics/student-marks | Sort descending for top; sort ascending for bottom; slice to count |
| ClassComparisonRadar | /api/analytics/class-comparison | Group per-subject averages by class section |

The analytics container fetches from all relevant endpoints on initial load and on each filter change, with the exception of the all-terms wRates fetch, which is performed once on initial load and is not re-triggered by term filter changes. The container stores the all-terms wRates result separately in state alongside the term-filtered counterpart.

---

## Chart Component Specifications

### 1. Grade Distribution Heatmap — D3 (components/infographics/GradeDistributionHeatmap.tsx)

The heatmap renders a rectangular SVG grid. Rows correspond to the nine curriculum subjects and columns correspond to five mark bands: 0–34, 35–49, 50–64, 65–79, and 80–100. Each cell is filled using a D3 sequential colour scale. The scale input for each cell is its percentage value — the proportion of students in that subject who scored within that band — and the scale domain is computed from the minimum and maximum percentage values present across the entire heatmapData prop so that the full colour range is always utilised. Cells with a raw count of zero receive a neutral flat fill rather than the scale's minimum colour, keeping empty and low-frequency cells visually distinct.

Subject names are drawn as SVG text elements left-aligned on the row axis. A left margin is calculated from the widest subject label to ensure no label is clipped. Column band labels are drawn as SVG text elements above the grid with a rotational transform to prevent overlap at narrow container widths. The SVG's internal margin object must account for all four sides to avoid clipping on any viewport size.

A ResizeObserver is attached to the container div inside a useEffect. When the container's measured width changes, the D3 horizontal scale is recalculated and the SVG dimensions and cell positions are updated by re-running the full D3 rendering block. Every execution of the D3 rendering block must begin with a complete removal of all existing SVG children to prevent duplicate element accumulation across rerenders and prop updates.

A hover tooltip is implemented as an absolutely positioned div within the container div. D3 mouseover event handlers on each rect element unhide the tooltip, position it offset from the mouse coordinates within the container, and populate it with the subject name, band range string, raw student count, and formatted percentage. Mouseout handlers rehide the tooltip. The component receives a single heatmapData prop.

---

### 2. Subject Average Bar Chart — Recharts (components/charts/SubjectAverageBar.tsx)

This chart uses a Recharts BarChart with a horizontal bar layout achieved by setting layout to "vertical". The Y-axis displays subject names and the X-axis runs from 0 to 100. Each bar's fill colour is determined by the subject's average mark using Recharts' Cell sub-component applied inside the Bar: averages below 35 are coloured red, averages between 35 and 49 inclusive are coloured amber, and averages of 50 or above are coloured green. A LabelList is attached to the Bar to print each subject's numeric average at the end of the bar, formatted to one decimal place.

A CartesianGrid with horizontal stroke lines is enabled to help readers compare bar lengths across the vertical axis. Gridlines should be subtle — a light grey at 30% opacity — so they do not compete visually with the coloured bars. The XAxis tick formatter should round displayed values to whole numbers even though the label at the bar end shows one decimal place; this avoids cluttering the axis with fractional tick labels.

The chart is wrapped in a ResponsiveContainer set to 100% width and a fixed height of approximately 360 pixels. Axis tick text is styled to be legible at typical dashboard font sizes. The component receives a subjectAverages prop, which is an array of objects with subject name and average value fields produced by the analytics container.

---

### 3. W-Rate Tracker — Recharts (components/charts/WRateTracker.tsx)

This component renders a Recharts LineChart with one line per subject. The X-axis tick values are the three term labels — Term I, Term II, and Term III. The Y-axis runs from 0 to 100 representing the W percentage. Each subject's line uses the same colour assigned to that subject in the StudentPerformanceBar chart so that colour-to-subject associations remain consistent across the full analytics page. A Legend below the chart maps each line colour to its subject name. An optional horizontal ReferenceLine is drawn at y=50 with a dashed stroke and a muted label to mark the midpoint threshold.

An important architectural constraint governs this component's data source. The W-Rate Tracker is always designed to display trends across all three terms simultaneously, giving the viewer a longitudinal view of W-rate movement. This means it must always receive an all-terms dataset through the wRatesAllTerms prop, regardless of whether a term filter selection is active in the analytics page. The analytics container must derive this prop from the unfiltered, all-terms source of wRates data rather than from the currently filtered single-term slice. The prop name wRatesAllTerms is intentionally distinct from any other wRates key in the container to make this separation visible at the JSX call site. A code comment must accompany this prop assignment in the container to prevent a future developer from mistakenly passing the wrong data.

---

### 4. Student Performance Scatter Plot — D3 (components/infographics/StudentScatterPlot.tsx)

The scatter plot renders an SVG chart. The X-axis is a D3 continuous linear scale whose domain spans from zero to the maximum total marks value present in the scatterData prop. The Y-axis is a D3 band scale with one band per student, sorted alphabetically by student name from top to bottom. Each student is represented by a circle centred at their total marks value on the X-axis and at the vertical midpoint of their band on the Y-axis. The band height is fixed so the chart's total height grows with the number of students; the wrapping card uses overflow with a vertical scroll if the chart exceeds the card's allotted height.

Circle fill colour is mapped to the student's W count across three tiers: students with zero Ws receive a green fill, students with one or two Ws receive an amber fill, and students with three or more Ws receive a red fill. The colour differentiation makes at-risk students visually prominent within the overall score distribution. Clicking on a circle navigates to the corresponding student's profile page using the profileUrl value from the scatterData entry. A hover tooltip shows the student's name, total marks, W count, and class section.

A ResizeObserver is attached to the wrapper div in a useEffect to keep the SVG's horizontal scale responsive when the container width changes. As with the heatmap, the D3 rendering block must clear all SVG children before each execution to prevent element duplication. The component receives a scatterData prop from the analytics container.

---

### 5. Top/Bottom Performers Table (components/charts/TopBottomPerformers.tsx)

This component renders two side-by-side HTML tables within a flex container with a gap between them. On narrow viewports the flex direction switches to column so both tables stack vertically and remain legible. Both tables share the same column structure.

| Column | Notes |
|---|---|
| Rank | Auto-assigned by position in pre-sorted array |
| Index No. | Student identifier from the data prop |
| Name | Rendered as a Next.js Link to the student profile via profileUrl |
| Class | Section or class label |
| Total Marks | Sum of marks in the filtered scope |
| W Count | Red text when value is greater than zero |

The top performers table receives and renders the topPerformers array in the order already supplied by the analytics container — the container is responsible for sorting descending by total marks. The bottom performers table renders the bottomPerformers array as supplied, sorted ascending. The number of rows shown is controlled by a count prop that defaults to five.

The first row of the top table receives a gold background tint applied through a conditional class based on row index 0. The last row of the bottom table receives a red background tint applied through a conditional class comparing the row index to the array length. Any W Count cell whose value exceeds zero receives a red text class regardless of which table it appears in. The component receives two props: topPerformers and bottomPerformers.

---

### 6. Class Comparison Radar Chart — Recharts (components/charts/ClassComparisonRadar.tsx)

This component uses a Recharts RadarChart containing a PolarGrid, a PolarAngleAxis whose keys are the nine subject names, and a PolarRadiusAxis with a domain from 0 to 100. One Radar polygon is rendered per class section present in the filtered dataset. Each section polygon is drawn in a distinct colour taken from a predefined palette, and a Legend component beneath the chart maps colour to section name.

A Tooltip is attached to the chart to show per-subject averages for the hovered polygon. The chart is wrapped in a ResponsiveContainer set to 100% width and a fixed height of approximately 400 pixels. The component receives a classComparisons prop, which is an array of section objects each containing the section name and an array of per-subject average values keyed by subject name.

When the classComparisons prop contains only a single section, the chart should still render normally as a single polygon without throwing a library error. The PolarAngleAxis subject labels should be rendered at a font size small enough to avoid overlap on the outer ring when nine subjects are shown; 11–12px is typically appropriate. The Radar fill opacity should be set to a value around 0.2 so that overlapping polygons remain transparent and distinguishable rather than blocking each other with solid fills.

---

## Colour Palette and Visual Conventions

A consistent colour palette is used across charts so that the same subjects and performance thresholds carry the same visual identity throughout the analytics page.

Subject colour assignments (used in WRateTracker lines, StudentPerformanceBar bars, and ClassComparisonRadar polygons) should follow a fixed index-based palette. The nine subjects always appear in a defined curriculum order and are assigned palette colours by their position in that order. The palette values must be defined once in a shared constants file, for example lib/chartPalette.ts, and imported by each component that needs them. Defining colours separately in each component file would cause drift and inconsistency.

Performance threshold colouring (used in SubjectAverageBar and the scatter plot circle tiers) follows a three-value rule:

| Threshold | Colour | Applies To |
|---|---|---|
| Below 35 (Fail) | Red (#dc2626 or equivalent) | SubjectAverageBar bars, scatter plot circles with 3+ Ws |
| 35–49 (At risk) | Amber (#d97706 or equivalent) | SubjectAverageBar bars, scatter plot circles with 1–2 Ws |
| 50 and above (Pass) | Green (#16a34a or equivalent) | SubjectAverageBar bars, scatter plot circles with 0 Ws |

The Heatmap colour scale is independent of the three-tier palette. It uses a D3 sequential single-hue scale — a light-to-dark blue, purple, or green gradient — driven purely by percentage magnitude. The heatmap is not a pass/fail visualisation; it shows frequency distribution, so the three-tier red/amber/green palette would be misleading here.

All chart backgrounds within their cards should be transparent or match the card background colour so that PNG exports do not include an unexpected white box artifact when the application uses a dark-mode card style.

---

## Analytics Page Layout and Integration

All six chart components are mounted within the analytics page component after Task 4.2's filter controls and summary statistics row. The layout uses a CSS grid or flex approach where charts occupy full-width or half-width columns based on their natural size requirements.

Layout rules for each chart:

- GradeDistributionHeatmap occupies a full-width cell due to the nine-row label axis requiring horizontal space. It is placed first in the grid, immediately beneath the filter bar, to give it the most prominent position on the page.
- SubjectAverageBar and WRateTracker occupy adjacent half-width columns in the second row so their subject-axis labels can be compared side by side.
- StudentScatterPlot occupies a full-width cell because its Y-axis extends proportionally with the number of students. It is placed in its own row with a constrained maximum height and internal vertical scroll.
- TopBottomPerformers and ClassComparisonRadar occupy adjacent half-width columns in the fourth row.
- The card component wrapping each chart provides uniform padding, a visible card title bar, the "Download PNG" button in the top-right corner of the card header, and a subtle border.
- On mobile viewports all cards collapse to full-width single-column stacking.

Ref attachment:

- Each chart card wrapper div receives a React ref created with useRef in the analytics page component.
- The refs are stored in a named object or array, for example chartRefs, keyed by chart name, so the PDF download handler can iterate over them in a defined order.
- Only the card wrapper div needs the ref, not the chart component itself, since html2canvas captures the full card including title and padding.

Loading and empty states:

- While any analytics data fetch is in progress, each chart card renders a skeleton placeholder rather than the chart component.
- If a chart receives an empty array as its data prop (for example when a selected section has no students), the card renders a brief "No data available for the current filter" message in place of the chart.
- The "Download Full Analytics Report" and all per-chart "Download PNG" buttons are disabled while any fetch is in progress.

---

## Filter State Propagation

The analytics page maintains three filter values in local state: the selected grade (number), the selected term (one of Term I, Term II, Term III, or All Terms), and the selected section (a section name string or "All Sections"). These three values are passed as separate props to the analytics container's data-fetching hooks, which re-query the API whenever any of the three changes.

Each chart component receives only the pre-filtered data array relevant to its visualisation. Chart components are not passed the raw filter state values and should not need to know what grade, term, or section is currently selected. The analytics container is the single point where filter state is translated into API queries and data transformations.

The one exception to this rule is that the current grade and term filter values are passed to each chart card's PNG download handler for filename construction purposes. This is a display-layer concern, not a data concern, and does not give chart components access to filter state.

When a filter value changes, the analytics container shows a loading indicator while refetching. Charts that do not change with the new filter — specifically the WRateTracker, which always shows all terms — retain their current rendered state and are not replaced with a skeleton during the refetch, since their underlying data does not change in response to a term filter update.

A "Reset Filters" action should be available to return all three filters to their default values (the first available grade, Term I, and All Sections) in a single interaction, clearing any previous filter combination the user may have applied.

---

## Testing Guidance

The following manual verification steps should be completed before this task is marked done.

1. Navigate to the analytics page as an admin user. Confirm that all six chart cards render with visible chart content and no JavaScript console errors on initial load.
2. Change the grade filter and confirm that all charts except the W-Rate Tracker update their content to reflect the new grade selection.
3. Change the term filter and confirm that the W-Rate Tracker does not change its displayed lines (it should always show all three terms), while the other charts update.
4. Change the section filter and confirm that the Class Comparison Radar chart and the Top/Bottom Performers table both update to reflect the section restriction.
5. Click the "Download PNG" button on the Grade Distribution Heatmap and confirm that a PNG file downloads with the correct filename, that it is sharp at 1× and 2× zoom, and that row labels and cell colours are fully visible with no clipping.
6. Click the "Download PNG" button on the Student Scatter Plot and confirm that circle colours are correctly rendered (not black or transparent) in the downloaded image.
7. Click the "Download PNG" button on each of the three Recharts-based charts and confirm that bars and lines are fully drawn — not mid-animation — in each downloaded image.
8. Click the "Download Full Analytics Report" button and observe that the progress counter advances through "1 of 6" up to "6 of 6" and that a PDF file is subsequently downloaded.
9. Open the downloaded PDF and verify that it contains a title page and six chart pages, that the school name appears in each page header, and that each chart image is clearly legible.
10. Navigate to the analytics page as a student-role user and confirm that the middleware redirects to the unauthorised page before the analytics page content is rendered.
11. Resize the browser viewport to a narrow width (below 768 px) and confirm that D3 charts reflow horizontally and all label text remains visible without clipping or overlap.
12. Select a section filter that results in only one class section and confirm that the ClassComparisonRadar renders a single polygon without error and shows a one-entry legend.

---

## PNG Download Implementation (Per-Chart)

Each chart is mounted inside a wrapper div that carries a stable React ref. A "Download PNG" button is placed in the chart card header on the trailing side of the card title. When a user clicks this button, the handler calls html2canvas against the chart's wrapper div — not the inner SVG — so that the card background, padding, and any visible title text are included in the exported image. The button should display a brief disabled loading state during the capture to communicate that the operation is in progress.

The html2canvas call is asynchronous and receives a scale option set to 2 to produce a high-resolution output. Once the returned promise resolves to a canvas element, the handler calls toDataURL on the canvas with image/png as the MIME type to obtain a base64-encoded PNG data URL. A temporary anchor element is created in memory with href set to the data URL and the download attribute set to the computed filename. The anchor is appended to the document body, clicked programmatically to trigger the browser's file download, and immediately removed from the DOM. No user confirmation dialog or modal is required for per-chart PNG downloads.

Filename construction follows a consistent pattern: the chart's short name in kebab-case, followed by the current grade filter value, followed by the current term filter value, all joined by hyphens and ending with the .png extension. For example, downloading the heatmap while grade 10 and term 2 are active produces grade-distribution-heatmap-grade10-term2.png. This approach encodes the filter context into the filename and prevents collisions when downloading the same chart across multiple filter combinations in the same browser session.

---

## Full Analytics Report PDF Download

### Overview

The "Download Full Analytics Report" button in the analytics page header triggers a sequential capture sequence across all six chart containers. The handler loops through each chart ref, calls html2canvas with scale 2, and collects the resulting data URLs into an array. A loading spinner is displayed in the button during the operation to indicate that processing is underway. A progress indicator text such as "Capturing charts 3 of 6…" updates after each capture completes to give the user visibility of progress.

Once all six captures are complete, the handler sends a POST request to the server-side route at app/api/preview/pdf. The request body contains the array of base64 image strings, the school name, a report title, the report generation date, and the current filter scope description (grade, term, and section values as human-readable strings). When the response is received, it is converted to a Blob and a temporary object URL is created and triggered for download in the same anchor-click pattern used for per-chart PNG downloads. The spinner is dismissed and any error is surfaced via a toast notification.

---

### Client-Side Capture Sequence Detail

The full report capture handler performs captures one at a time in sequential order rather than in parallel. Parallel captures can cause browser rendering issues when multiple html2canvas instances attempt to rasterise large, overlapping, or partially off-screen DOM sections simultaneously, and can also exceed available memory on lower-end devices. Sequential capture with a single active html2canvas call at any moment is more reliable at the cost of slightly longer total capture time.

Before the capture loop begins, the handler sets a shared isCapturing boolean in page state to true. This value is used to disable all filter controls, all per-chart PNG buttons, and the PDF download button during the operation, preventing concurrent state changes that could corrupt a chart's visual state mid-capture. After all captures complete and the POST response is received, isCapturing is reset to false.

If any individual html2canvas call rejects (for example due to a cross-origin resource embedded in a chart), the error is caught, the loop exits early, the spinner is dismissed, and a toast is shown identifying which chart failed and suggesting the user retry. Partial capture arrays are discarded and the POST request is not sent.

---

### Server-Side PDF Assembly Route

The route at app/api/preview/pdf/route.ts handles POST requests only and expects the JSON body structure described above. It uses react-pdf/renderer primitives — Document, Page, View, Text, and Image — to compose the PDF in memory. The document opens with a title page containing the school name, report title, generated date, and filter scope. Each subsequent page renders one chart image using the Image primitive with the base64 data URL, accompanied by a brief caption derived from the chart name and filter scope.

A consistent page header carrying the school name and a horizontal rule is applied on every page except the title page using a fixed-position View. The school logo, if available in SystemConfig, is fetched from the database within the route handler and embedded as a base64 image in the header. The handler returns the PDF as a binary response with the Content-Type header set to application/pdf and the Content-Disposition header set to attachment with a filename incorporating the school name and generation date.

---

### Request Body Structure

The POST body sent by the client to app/api/preview/pdf is a JSON object with the following fields.

| Field | Type | Description |
|---|---|---|
| images | string[] | Array of six base64 PNG data URL strings, one per chart, in page order |
| chartCaptions | string[] | Array of six human-readable chart title strings matching the images order |
| schoolName | string | School name from SystemConfig, embedded in the PDF header |
| reportTitle | string | Title string for the PDF cover page, e.g. "Grade 10 Analytics Report" |
| generatedDate | string | ISO 8601 date string for the cover page generation timestamp |
| filterScope | string | Human-readable filter summary, e.g. "Grade 10 — Term II — All Sections" |

The route validates that images is an array with exactly six entries. If the images array length is not six, the route returns a 400 response with a descriptive error message so that client-side errors caused by partial capture sequences can be diagnosed promptly.

---

### html2canvas Scale Setting

The scale option passed to html2canvas must be set to 2 to account for device pixel ratio and produce sharp images at standard screen densities. Without this setting, the captured image appears blurry when viewed at its natural size in a PDF viewer or image viewer, because html2canvas defaults to capturing at the CSS pixel resolution rather than the physical pixel resolution. On displays with a device pixel ratio higher than 2 the images will still appear adequately sharp, and the fixed value of 2 is used as a practical maximum to balance image clarity against capture time and payload size.

---

## Acceptance Criteria

1. The Grade Distribution Heatmap renders a fully coloured SVG grid with correct subject row labels, band-range column labels, and hover tooltips that display the subject name, band range, student count, and percentage for each cell.
2. The Grade Distribution Heatmap reflows its SVG width correctly when the browser viewport or panel width changes, without producing duplicate axes or data elements on rerender.
3. The Subject Average Bar chart renders horizontal bars with correct conditional colouring — red below 35, amber 35–49, green 50 and above — and a numeric average label positioned at the end of each bar.
4. The W-Rate Tracker renders one line per subject across all three terms in Term I, Term II, Term III order, using the same subject-colour assignments as the StudentPerformanceBar chart.
5. The W-Rate Tracker correctly displays all-terms data regardless of which term filter is active on the analytics page, because it receives the dedicated wRatesAllTerms prop rather than the filtered dataset.
6. The Student Scatter Plot renders one circle per student positioned at their total mark on the horizontal axis, with green, amber, or red fill based on W count, and clicking a circle navigates to the correct student profile page.
7. The Top/Bottom Performers component renders both tables with correct rank order, the gold tint applied to the Rank 1 row in the top table, the red tint on the last rank row in the bottom table, and red text on W Count cells where the value exceeds zero.
8. The Class Comparison Radar chart renders one distinctly coloured polygon per class section with correct per-subject averages from the classComparisons prop, accompanied by a legend and a functional hover tooltip.
9. Each chart's "Download PNG" button produces a PNG file at 2× scale with a filename encoding the chart name and active filter values.
10. The "Download Full Analytics Report" button shows a spinner and a progress counter during the sequential capture sequence and produces a multi-page PDF containing all six charts with school name header and filter scope caption on each page.
11. All six chart components are purely presentational — they render only from props and contain no internal data fetching logic.
12. D3 SVG charts resize responsively when viewport width changes, with no duplicate SVG elements produced across rerenders.
13. The analytics PDF server route returns a valid application/pdf response with a Content-Disposition attachment header, and the downloaded file opens correctly in standard PDF viewers.
14. The analytics page is accessible only to users with the admin or teacher role; requests from student-role users or unauthenticated users are intercepted by middleware and redirected.

---

## Notes and Pitfalls

- D3 charts must explicitly remove all SVG child elements at the beginning of the useEffect D3 rendering block by selecting the container SVG node and removing all its descendants before executing any D3 append or join calls. Placing this cleanup in the useEffect return function is insufficient if the rendering block fires in the same effect cycle due to a dependency change. The safest pattern is to perform the removal as the first line of the rendering block unconditionally on every execution. Failure to do this causes axes, grid lines, and data marks to be appended on top of the previous render's elements, producing corrupted overlapping visuals that persist until the page is hard-reloaded.

- html2canvas does not reliably resolve CSS custom properties (CSS variables) in all browser versions and environments. Chart element styles that reference colours through var(--token-name) syntax may be captured as transparent, black, or an incorrect fallback colour in the exported image. All colours that need to appear in PNG exports or the PDF must be supplied as resolved hex or RGB values. If the design token system defines colours as CSS variables, resolve them through getComputedStyle at the point of component instantiation and pass the resolved string to the D3 attr call or the Recharts colour prop.

- The W-Rate Tracker's all-terms data requirement is a firm architectural constraint that must be enforced at the analytics container level. The analytics container holds two distinct wRates datasets: a filtered dataset used by other charts and an unfiltered all-terms dataset used only by this chart. The prop name wRatesAllTerms is intentionally different from any general filtered wRates property. A comment must appear in the analytics container JSX next to the WRateTracker component invocation explaining why the all-terms source is used, to prevent a future developer from replacing it with the filtered source during a refactor.

- react-pdf/renderer's Image primitive accepts JPEG and PNG data URLs but does not parse or render SVG content. D3-rendered SVG charts cannot be passed as SVG markup to the PDF assembly route and cannot be embedded in react-pdf documents as vector graphics. The html2canvas rasterisation step that converts every chart to a PNG data URL before the POST request is therefore architecturally mandatory for all six charts regardless of their underlying rendering technology. Attempting to extract SVG outerHTML from D3 components and pass it to the PDF route will produce a runtime error or a blank image placeholder in the PDF output.

- Recharts applies CSS transition animations to bars and lines by default. These animations begin when a component mounts or when input data changes and run over several hundred milliseconds. If html2canvas initiates a capture while any Recharts animation is in progress, the exported image will show bars or lines in an incomplete or incorrect intermediate position. Before beginning the PNG download or the PDF capture sequence, set isAnimationActive to false on all Recharts chart sub-components that accept the prop. After all capture promises resolve, restore isAnimationActive to true. A single shared boolean state value in the analytics container can drive this across all Recharts components simultaneously.

- The Next.js default body parser limit of 1 MB is insufficient for the POST body sent to the PDF route. Six chart images captured at 2× scale and encoded as base64 strings can produce a combined payload of 15–25 MB depending on chart complexity and viewport size. The route file must export a Next.js route config object with the api.bodyParser.sizeLimit field set to an appropriate value such as 30mb. Without this configuration the framework will reject the request body before it reaches the handler function, and the error may appear as an empty body or an abrupt connection reset rather than an informative HTTP error response.
