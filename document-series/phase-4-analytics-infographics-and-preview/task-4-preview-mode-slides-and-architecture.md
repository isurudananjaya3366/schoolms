# Task 4.4 — Preview Mode Slides and Architecture

**Phase:** 4 — Analytics, Infographics and Preview Mode
**Task Number:** 4.4 of 5
**Complexity:** High
**Depends On:** Task 4.1 complete (StudentPerformanceBar available), Task 4.2 complete (auth middleware in place)

---

## Objective

This task implements the full Preview Mode experience — a full-screen, slide-based presentation of a student's academic record accessible from the student profile page. The feature spans a dedicated server-rendered route at `/preview/[studentId]`, a client-side SlideRenderer component that manages slide transitions and animations using Framer Motion, and a minimal standalone layout that is completely separate from the dashboard shell. All eight slides are designed to present different facets of the student record in a visually rich and navigable sequence suitable for parent-facing or governor-review contexts.

---

## Deliverables

- `app/preview/[studentId]/page.tsx` — server component responsible for authentication checks, Prisma data fetching, W-rule enrichment, and prop serialisation
- `app/preview/[studentId]/layout.tsx` — minimal standalone layout file with no sidebar, no dashboard navigation, and only the slide canvas wrapper
- `components/preview/SlideRenderer.tsx` — client component that owns slide index state, theme state, aspect ratio state, and renders slide content with Framer Motion transitions
- `components/preview/PresenterToolbar.tsx` — client component rendered inside SlideRenderer; provides previous/next navigation, slide counter, theme toggle, and aspect ratio toggle
- `components/preview/slides/SlideOverview.tsx` — slide 1 content component
- `components/preview/slides/SlideTermMarks.tsx` — shared slide component used for slides 2, 3, and 4, parameterised by term number
- `components/preview/slides/SlidePerformanceChart.tsx` — slide 5 wrapper around StudentPerformanceBar
- `components/preview/slides/SlideSubjectHighlights.tsx` — slide 6 content component
- `components/preview/slides/SlideWSummary.tsx` — slide 7 content component
- `components/preview/slides/SlideOverallSummary.tsx` — slide 8 content component
- Update `app/dashboard/students/[id]/page.tsx` to add the Preview Mode button that opens `/preview/[studentId]` in a new browser tab

---

## Context and Background

Preview Mode is a standalone presentation layer designed to surface a student's complete academic record in a slide deck format. It is launched from the student profile page via a "Preview Mode" button, which opens the URL in a new browser tab so that the user's current dashboard state — any open modals, scroll position, or table filters — remains completely undisturbed. The preview route is entirely self-contained and does not participate in the dashboard's layout hierarchy.

The page component at `app/preview/[studentId]/page.tsx` is a Next.js server component. Upon being requested, it performs a session check using the authentication helper, fetches the full student record from the database using Prisma including all associated MarkRecords across all three terms, and applies W-rule enrichment server-side across all subject marks before serialising the enriched data structure into props that are forwarded to the client SlideRenderer. This server-side enrichment approach ensures that no mark calculation logic leaks into the client bundle and that the SlideRenderer receives a fully resolved, display-ready data object.

The SlideRenderer is the heart of the client-side experience. It is a client component that manages three pieces of local state: the current slide index, the active presentation theme, and the active aspect ratio mode. It renders one slide at a time by switching on the current index, wrapping the active slide inside Framer Motion's AnimatePresence so that transitions play correctly when the index changes. Navigation is delegated to the PresenterToolbar, which receives the current slide index, total count, and a setter callback from SlideRenderer.

The data flow is strictly one-directional and must be designed with serialisation in mind. Because the page component is a server component and SlideRenderer is a client component, all data passed across the boundary must be fully JSON-serialisable. This means any database ID fields stored as ObjectId or similar non-primitive types must be converted to strings before being included in the props object. Dates should be serialised as ISO strings. The enriched mark data objects must contain only plain primitives, arrays, and nested plain objects.

---

## Page and Route Setup

### Route Structure

The route lives at `app/preview/[studentId]/page.tsx` and receives the `studentId` path parameter from Next.js's params object. The server component uses that parameter to call Prisma's `findUnique` on the Student model, including all related MarkRecord rows through the relational `include` clause. If the query returns null — meaning no student exists with that ID — the component immediately returns a Next.js `notFound()` response, which triggers the nearest not-found boundary. If the session check returns no session, the component redirects the user to the sign-in page. On success, the component builds the enriched props object and renders the SlideRenderer client component, passing the entire enriched data structure as a single serialised prop.

This route does not use the dashboard layout. The `app/preview/[studentId]/layout.tsx` file provides a bare-bones wrapper with only a full-viewport container, a neutral background colour variable, and no navigation chrome. This layout must explicitly not import the dashboard's RootLayout or Sidebar components. If any shared fonts or global CSS are needed, they should be imported directly within this layout file rather than inherited from the dashboard layout tree.

### Server-Side W-Rule Enrichment

After the student and their MarkRecords are retrieved from the database, the server component iterates over each MarkRecord. For every MarkRecord, it loops across all nine subject mark fields. For each field value, it evaluates whether the mark qualifies as a W grade according to the shared W-rule utility introduced in Task 3.1. The enrichment process attaches a companion boolean field — named with a consistent suffix such as `isW` — directly adjacent to the raw mark value in a new plain object structure. The result is an array of enriched term objects, each containing a term identifier and an array of enriched subject entries where each entry carries both the raw mark value and the resolved W status flag.

This enriched structure is what flows downstream into every slide that works with mark data. The SlideRenderer itself does not need to know anything about the W-rule threshold — it simply reads the `isW` flag to decide on visual treatment. The same structure is shared between the term mark slides, the subject highlights slide, the W summary slide, and the overall summary slide, so all mark-related visual logic can rely on a single consistent data shape.

### Authentication

Any authenticated user regardless of role may access `/preview/[studentId]`. The existing middleware configuration must be reviewed to confirm that it does not inadvertently block users with the Student or Parent role from accessing paths under `/preview`. If the middleware has role-level path restrictions, the `/preview` prefix should be added to the list of paths that only require an active session rather than an elevated role. The session check within the page component itself is purely binary — authenticated or not — and does not inspect the user's role. The "Preview Mode" button on the student profile page uses `window.open` with `_blank` as the target, ensuring the link opens in a new tab without affecting the current page state.

---

## Framer Motion Slide Transitions

### AnimatePresence Setup

All eight slides are wrapped inside a single instance of Framer Motion's `AnimatePresence` component rendered within SlideRenderer. The child element — whichever slide component is currently active — must be assigned a `key` prop equal to the current slide index. AnimatePresence detects key changes and coordinates the exit animation of the outgoing element with the entry animation of the incoming element, so both can be in the DOM simultaneously for the duration of the transition.

The standard transition used for all slides is a combination of opacity fade and a Y-axis translation. Slides enter from a position slightly below their final resting position — approximately 20 pixels offset — and animate upward to zero offset while fading in from zero to full opacity. On exit, the slide moves upward by approximately 20 pixels while fading out. The transition duration should be set to around 350 milliseconds with an ease-out curve on entry and an ease-in curve on exit. This timing is short enough to feel responsive but long enough to communicate directional movement between slides.

### Performance Chart Slide Animation

Slide 5 renders the StudentPerformanceBar component imported from Task 4.1. Recharts provides built-in bar entrance animation through props on the Bar primitive. The `isAnimationActive` prop must be explicitly set to true and the `animationDuration` prop should be set to approximately 800 milliseconds. To prevent the bar animation from competing visually with the Framer Motion slide transition, the chart wrapper element inside the slide should carry a Framer Motion delay. A delay of approximately 400 milliseconds on the wrapper's entry animation ensures the slide fade-in completes before the bars begin their own animation sequence. Without this sequencing, the bar and slide animations overlap in a way that looks unpolished.

---

## Slide Specifications

### Slide 1 — Student Overview

This slide acts as a title card for the presentation and displays the student's essential identity information. The student's full name is rendered in the largest typography on the page, centred both horizontally and vertically. Below the name sits the index number in a smaller but still prominent size. A badge-style element displays the student's grade and class together. The academic year is shown beneath that. If the SystemConfig table contains a school logo URL, the logo is rendered at the top of the slide above the name. No marks data appears on this slide. The visual intent is to clearly identify whose record is being presented before any data appears.

### Slides 2, 3, 4 — Term Marks Tables

Slides 2, 3, and 4 each display the full marks table for a single term — Term 1, Term 2, and Term 3 respectively. All three slides are rendered using the same `SlideTermMarks` component, which accepts a term number and the enriched marks array for that term as props. Each slide shows a full-width two-column table with Subject in the left column and Mark in the right column. If a subject's mark is present and the `isW` flag is true, the table row for that subject is highlighted in red — using either a red background tint or red text depending on the active theme. If a subject mark is absent from the record, the mark cell displays an em dash. The slide heading at the top clearly identifies which term is being shown.

### Slide 5 — Performance Chart

This slide renders the `StudentPerformanceBar` chart component scaled to fill as much of the slide canvas as possible. The `ResponsiveContainer` is set to 100 percent width and a height sufficient to make the chart prominent — the height should take up the majority of the vertical canvas space. Bar entrance animation is enabled as described in the Framer Motion section above. The W threshold reference line introduced in Task 4.1 must remain visible. The chart legend is positioned below the bar group. The slide has no prose content other than a brief heading at the top identifying it as a performance overview.

### Slide 6 — Subject Highlights

This slide uses a two-column layout to spotlight the student's best and worst performing subjects. The left column shows the strongest subject — determined by the highest average mark across all three terms for that subject, considering only entries where a mark was actually recorded. The right column shows the weakest subject — the lowest average or, in cases where multiple subjects share a similar low average, the subject with the most W grades breaks the tie. Each column shows the subject name in a prominent style, a small colour swatch using the same colour that subject was assigned in the bar chart palette from Task 4.1 for visual continuity, and the calculated average mark value. The mark value animates from zero to its actual value on slide entry using a Framer Motion spring or timeline animation, giving a count-up effect over approximately one second.

### Slide 7 — W Summary

This slide has two distinct presentation states determined by the enriched data. When the student has no W grades across any term, the slide renders a full-canvas congratulations card with a positive message and no table. When W grades exist, the slide renders a list grouped by term. Under each term heading, the subjects with W grades are listed alongside their term identifier and the raw mark value that triggered the W classification. A fixed recommendation note appears below the list — it does not change based on the data and acts as a standardised advisory message visible whenever W grades are present. The visual treatment of W-grade entries should match the red highlight convention used in the term mark table slides for consistency.

### Slide 8 — Overall Summary

This slide provides a top-level summary of the student's performance across all recorded data. The total marks sum is calculated by adding all non-null mark values across all subjects and all three terms. If the SystemConfig has class rank display enabled, the class rank is shown — this rank must have been computed server-side and passed as part of the enriched props, not derived client-side. A qualitative performance descriptor is displayed in the largest typography on the slide and is colour-coded: Excellent for averages at or above 80 percent renders in green, Good for 60 to 79 percent in amber, Needs Improvement for 45 to 59 percent in orange, and Critical for below 45 percent in red. The descriptor label and its colour are both determined server-side based on the computed overall average before being included in the serialised props.

---

## SlideRenderer Component Design

### State Management

`SlideRenderer` is a client component and the sole owner of all presentation state. It initialises a `slideIndex` state starting at 0, a `theme` state defaulting to `"light"`, and an `aspectRatio` state defaulting to `"16:9"`. The component renders the slide corresponding to the current index by switching over the index value. The rendered slide is wrapped in AnimatePresence as described above. SlideRenderer also renders the `PresenterToolbar` component, passing it the current `slideIndex`, the total slide count constant of 8, a `setSlideIndex` callback for navigation, the current `theme` value and a `setTheme` toggle callback, and the current `aspectRatio` value and its setter. SlideRenderer does not contain any mark-processing logic — all data it works with arrives through the props passed from the server component.

### Aspect Ratio Handling

The slide canvas wrapper div supports two visual modes controlled by the `aspectRatio` state. In `"16:9"` mode, the canvas uses a CSS `aspect-ratio` property of `16 / 9` applied within a full-viewport-width container, causing the canvas height to be derived automatically. In `"A4"` mode, the canvas is sized to approximate an A4 page in portrait orientation — approximately 794 pixels wide by 1123 pixels tall — with overflow hidden and the slide content scaled to fit. The active aspect ratio is applied as a CSS utility class on the canvas wrapper div, and the two class names carry different sizing rules defined in the preview-specific stylesheet. This allows slide content components to remain unaware of the aspect ratio and rely on percentage-based sizing within their container.

### Theme Handling

SlideRenderer holds a `theme` state that is either `"dark"` or `"light"`. The current theme value is applied as a class on the outermost canvas wrapper element. All slide content components, including their headings, table cells, backgrounds, and text, must use CSS custom properties — variables — for all colour values rather than hardcoded Tailwind colour classes. The preview-specific stylesheet or a dedicated CSS module defines these variables with two rule sets, one scoped to the dark theme class and one to the light theme class, so that toggling the class on the wrapper automatically cascades the correct colour values through all child components without any JavaScript logic in the individual slide components.

---

## Acceptance Criteria

1. Navigating to `/preview/[studentId]` with a valid authenticated session returns a fully rendered page with the slide canvas visible and Slide 1 displayed by default.
2. Navigating to `/preview/[studentId]` with an invalid or non-existent student ID triggers a 404 response.
3. Navigating to `/preview/[studentId]` without an active session redirects the user to the sign-in page.
4. The preview page renders without any dashboard sidebar, header bar, or navigation chrome.
5. All eight slides are reachable via the PresenterToolbar navigation controls and each displays the correct content for its specified purpose.
6. Slide transitions play a visible fade-and-translate animation when moving between any two adjacent slides.
7. Slide 5 displays the StudentPerformanceBar component with bar entrance animations that begin after the slide fade-in animation completes.
8. W-grade marks are visually highlighted in red in both the term mark table slides and the W summary slide, and this highlighting is consistent across both light and dark themes.
9. Toggling the theme via the PresenterToolbar switches the entire slide canvas colour scheme without requiring a page reload or re-render of the server component.
10. Toggling the aspect ratio between 16:9 and A4 via the PresenterToolbar resizes the canvas wrapper correctly without distorting slide content.
11. The "Preview Mode" button on the student profile page opens the preview URL in a new browser tab and does not navigate the current dashboard tab.
12. All props passed from the server page component to SlideRenderer are fully JSON-serialisable — no raw ObjectId values, no Date objects, and no circular references are present in the serialised data.

---

## Notes and Pitfalls

- AnimatePresence requires the animated child element to change its `key` prop when the slide changes — using the slide index as the key is acceptable, but the component returned for each slide must not be the same stable component instance across different indices; always render a fresh element so AnimatePresence can detect the unmount and mount cycle correctly.
- The server component at `app/preview/[studentId]/page.tsx` must never import Framer Motion, Recharts, or any other browser-only or client-only library — all animation and chart logic must stay inside the client SlideRenderer and its child slide components; importing a client library in a server component will cause a runtime build error in Next.js.
- Class rank calculation requires knowing the rank of the current student among all other students in the same class and term — this cross-student query must be executed server-side inside the page component when building the enriched props rather than approximated or deferred to the client; computing it client-side would require sending all students' marks to the browser, which is a data exposure concern.
- The preview page's `layout.tsx` must be an entirely independent layout file; if it accidentally inherits or imports the dashboard's root layout, the sidebar and top navigation will render inside the presentation view, breaking the full-screen canvas design.
- When building the serialised props object from the Prisma query result, proactively convert all ID fields — including the student ID, any MarkRecord IDs, and any relational foreign key IDs — to strings using `.toString()` before constructing the props object; Prisma may return these as internal numeric or object types depending on the database adapter, and Next.js will throw a serialisation error at runtime if a non-plain value crosses the server-to-client component boundary.
