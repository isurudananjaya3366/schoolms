# Task 4.1 — Student Performance Bar Chart and Student Profile Integration

**Phase:** 4 — Analytics, Infographics and Preview Mode
**Task Number:** 4.1 of 5
**Complexity:** Medium
**Depends On:** Phase 3 complete (marks API, W-rule utility, student profile page exists)

---

## Objective

This task introduces the `StudentPerformanceBar` chart component, a grouped bar chart that visualises a student's subject marks across all three academic terms. The component is embedded in the student profile page to give teachers and administrators an at-a-glance view of performance trends and W-threshold breaches. It is also designed to be reused without modification as a slide inside Preview Mode in a later task.

---

## Deliverables

- Create the new chart component at `components/charts/StudentPerformanceBar.tsx`
- Modify the student profile page at `app/dashboard/students/[id]/page.tsx` to fetch and pass mark data to the chart
- Create a colour palette utility or constant file at `lib/chartPalette.ts` that maps subject names to consistent hex colours
- Add any required Recharts type declarations or helper interfaces to `types/charts.ts` if that file does not already exist
- Update the index or barrel export at `components/charts/index.ts` to include the new component
- Verify that `recharts` is listed as a dependency in `package.json`; add it if missing

---

## Context and Background

The `StudentPerformanceBar` component lives inside the `components/charts/` directory, keeping all Recharts-based visuals in one place and making them easy to locate when Preview Mode is assembled in Task 4.3. The component is a pure client component — it is decorated with the `"use client"` directive — because Recharts relies on browser APIs and cannot render on the server. All data fetching happens in the server component (the profile page), which then passes the transformed mark array down as serialised props.

The component receives a single prop representing an array of term-mark objects. Each object in the array describes one academic term and contains a numeric mark for every subject that has a recorded value for that term. Subjects with no mark for a given term are represented as `null` rather than being omitted entirely, which allows the chart to maintain consistent bar groupings across all three terms even when data is incomplete.

The reason the chart is introduced in Phase 4 rather than Phase 2 or 3 is that it depends on the full marks dataset being reliably available from the API established in Phase 3. Without that API and the W-rule utility, it would not be possible to determine which bars require the W visual override. The chart does not call `applyWRule` directly; instead, it performs a raw numeric comparison against the threshold of 35 internally to decide how each bar should be coloured and labelled.

Preview Mode, addressed in Task 4.3, will import this exact component and embed it as slide 5 of a scrollable infographic. Because the component accepts props rather than fetching its own data, it is completely portable — the Preview Mode page simply passes the same serialised mark data through the same prop interface. No modifications to the component itself will be needed when that reuse occurs, which is the primary reason for designing it as a proppable, stateless visual.

The chart is intentionally kept visually lightweight. It does not include interactive filtering controls, date range pickers, or pagination. Its role is purely presentational: render the marks for the currently loaded student, highlight W breaches visually, and provide a tooltip on hover for detail. Any richer filtering functionality is out of scope for this task.

---

## Chart Configuration Details

### Layout and Axes

The chart uses a `ResponsiveContainer` set to 100% width and a fixed height of 380 pixels. This ensures the chart fills its container column on the profile page without overflowing on smaller screens. The inner `BarChart` component uses the grouped (clustered) layout, meaning all subject bars for a given term appear side-by-side within the same X-axis slot rather than stacked.

The X-axis represents the three term groups — Term I, Term II, and Term III — displayed as category labels. The Y-axis runs from 0 to 100 with a tick interval of 25, producing visible gridlines at 0, 25, 50, 75, and 100. Additional `CartesianGrid` horizontal lines should be configured at 20, 50, and 75 to provide finer visual reference without cluttering the chart.

A `ReferenceLine` is drawn horizontally at Y = 35 using a dashed red stroke. This line is labelled "W threshold" and positioned at the right end of the line. It serves as a persistent visual cue that any bar falling below this line will receive a W designation. The dashed style distinguishes the threshold from regular gridlines and draws the eye to failure-risk marks immediately.

Left-side Y-axis margins should be generous enough to prevent axis labels from being clipped, and bottom margins should accommodate X-axis tick labels. The chart should have a small uniform padding on the left and right of the bar groups so the first and last term groups are not flush against the chart edges.

### Colour Logic

Each subject in the dataset is assigned a persistent hex colour from a predefined palette. The palette is defined in `lib/chartPalette.ts` as a plain object keyed by normalised subject name — normalisation means converting to lowercase and trimming whitespace before the lookup. A fixed array of distinct hex colours is used in rotation when the number of subjects exceeds the palette size, though in practice the typical subject count of six to eight will never exhaust a twelve-colour palette.

When a bar represents a mark below 35, the fill colour for that specific bar is overridden using the Recharts `Cell` sub-component. The override colour is a vivid red or deep coral hue that clearly contrasts with the subject's normal colour. This override is applied at the individual bar level, not at the series level, so only the failing bar changes colour while the same subject's passing bars in other terms retain their palette colour.

### Data Labels

Each bar carries a numeric label rendered just above the bar. When the raw mark value is 35 or higher, the label displays the integer value. When the raw mark value is below 35, the label displays the letter "W" styled in red bold text. These labels are rendered using the Recharts `LabelList` component attached to each `Bar` definition, with a custom content renderer function that applies the conditional formatting logic.

Labels should be positioned so they do not overlap a neighbour's label when bars are narrow. A small vertical offset above the bar top is sufficient. The font size for labels should be small enough — around 11 to 12 pixels — to remain legible without being cramped inside a grouped layout.

### Tooltip

The chart includes a custom `Tooltip` component. On hover over any bar, the tooltip displays three pieces of information: the subject name, the raw numeric mark, and the W status ("W — Below Threshold" or "Pass"). The tooltip background should be white or very light grey with a subtle shadow, consistent with the rest of the application's UI language. No action is triggered by clicking a bar; the tooltip is purely informational.

### Legend

A horizontal `Legend` is placed below the chart. Each entry in the legend maps a subject name to its palette colour using a coloured square swatch. The legend does not include any entry for the W-override colour, because that override is a state indicator rather than a distinct data series. The legend is rendered using the built-in Recharts `Legend` component with `verticalAlign` set to bottom and `align` set to center.

### Missing Term Handling

When Term II or Term III have no recorded marks for a student — for example, at the start of the academic year — those term groups must still appear on the X-axis as empty tick positions. The term group label remains visible even though no bars are drawn for that slot. A small "No data" text label should be rendered below the empty group to make the absence intentional rather than appearing as a rendering error. The axis must not collapse or skip the missing term; doing so would make Term III appear visually adjacent to Term I, which would misrepresent the academic timeline.

---

## Student Profile Page Integration

### Where to Integrate

The chart is inserted into the existing student profile page located at `app/dashboard/students/[id]/page.tsx`. This is a server component that already fetches the full student record including associated marks from Prisma. The chart is placed below the existing marks table in the page layout, inside a clearly labelled section heading such as "Performance Chart." The section should use the same card or panel wrapper styling used elsewhere on the profile page to maintain visual consistency.

Because the chart component itself is a client component, it cannot be imported directly into a server component without the Next.js `"use client"` boundary being respected. The import chain is already correct as long as only the chart component carries the `"use client"` directive — the profile page remains a server component and simply passes the serialised data prop down.

### Data Preparation

The server component must transform raw Prisma mark records into the shape the chart component expects before passing them as props. The raw records from the database contain individual fields such as `term`, `categoryImarks`, `categoryIImarks`, `categoryIIImarks`, and the associated subject identifiers. These must be grouped by term and shaped into an array of objects where each object represents one term and each subject's mark is a named numeric field or null.

The transformation logic must also resolve the human-readable elective subject labels. In the SchoolMS schema, categoryI, categoryII, and categoryIII elective subjects are not stored directly on the mark record — they are resolved from the `SystemConfig` table, which holds the school's configured subject list. The server component must fetch the relevant `SystemConfig` entry and use it to produce the correct subject label strings before building the chart data array. Hardcoding subject names in the transformation function is not acceptable and will cause the chart to break whenever a school configures non-default subjects.

The final prop value passed to the chart should be a plain serialisable array — no Date objects, no Prisma model instances, and no circular references. Next.js will warn in development if non-serialisable values are passed from a server component to a client component, and the build will fail in production if those violations are not resolved.

### W-Rule Clarification

The W-rule utility introduced in Phase 3 Task 1 converts a numeric mark into a string output — either the numeric value formatted as a string or the literal `"W"` — for display in the marks table and PDF reports. The `StudentPerformanceBar` component does not use this utility. The chart receives raw numeric integers and performs its own threshold comparison internally to decide how to colour and label each bar. This is an intentional separation: the marks table and PDF use the utility for formatted text output, while the chart needs the raw number to determine bar height on the Y-axis. If the chart received a `"W"` string, it would have no numerical value to plot and the bar would collapse to zero height, which is semantically incorrect — the mark was recorded but failed the threshold, not missing.

---

## Acceptance Criteria

1. The `StudentPerformanceBar` component renders without errors in both development and production builds when supplied with a valid data prop.
2. Three term groups appear on the X-axis in the correct order — Term I, Term II, Term III — regardless of the order in which term records are returned from the database.
3. Each subject is consistently assigned a single palette colour across all three term groups and across multiple renders.
4. Any bar with a raw mark below 35 is rendered in the W-override colour, not the subject's palette colour.
5. The "W" label appears above any bar whose mark is below 35, styled in red bold text, and a numeric label appears above bars at or above 35.
6. The `ReferenceLine` at Y = 35 is visible as a dashed red horizontal line with the label "W threshold."
7. When a term group has no mark data, the group slot remains visible on the X-axis with a "No data" indicator and does not collapse the axis or shift adjacent groups.
8. The custom tooltip correctly displays the subject name, raw mark, and W status when hovering over any bar.
9. The chart is fully embedded on the student profile page below the marks table, visible after scrolling on smaller screens, and respects the page's existing card-panel styling.
10. The elective subject labels displayed in the chart are pulled from `SystemConfig` and match the labels shown in the marks table on the same profile page.

---

## Notes and Pitfalls

- Recharts applies CSS transition animations by default for bar entry. These animations can cause false failures in automated visual regression or component tests because the bars are not in their final position at the time the snapshot is taken. Disable the `isAnimationActive` prop on each `Bar` when the component is being tested, or accept a small delay in snapshot tests.
- The `ResponsiveContainer` component requires its immediate parent element to have an explicit height set in CSS. If the parent container relies entirely on content height, `ResponsiveContainer` will resolve to zero height and the chart will be invisible. The profile page section wrapping the chart must set a minimum height of at least 400 pixels or a fixed height that accommodates the chart and its legend.
- Elective subject labels must always be sourced from `SystemConfig` at render time. Never hardcode subject names such as "Art" or "Home Science" in the chart's data transformation logic or palette configuration. Schools using the system may configure entirely different optional subjects, and hardcoded labels will silently produce incorrect groupings or palette key mismatches.
- The palette lookup key must use a normalised subject name — lowercase, trimmed — to avoid colour inconsistency caused by case differences between the value stored in `SystemConfig` and the value assembled during data transformation. A subject stored as "English" and referenced as "english" should resolve to the same palette colour, not two different ones.
- When Term II and Term III are both empty at the start of the year, the chart should still be rendered rather than hidden with a conditional check. Rendering an empty chart with axis labels and the "No data" placeholder is more informative than showing nothing and leaving users uncertain whether the chart failed to load.
