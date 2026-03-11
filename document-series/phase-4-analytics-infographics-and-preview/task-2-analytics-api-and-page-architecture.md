# Task 4.2 — Analytics API Route and Page Architecture

**Phase:** 4 — Analytics, Infographics and Preview Mode
**Task Number:** 4.2 of 5
**Complexity:** High
**Depends On:** Task 4.1 complete, all Phase 1–3 infrastructure operational

---

## Objective

This task implements the server-side analytics aggregation API route and the full
frontend architecture of the analytics dashboard page. The API route accepts filter
parameters, queries the database, and returns pre-shaped data ready for each chart
component to consume directly. The page architecture separates concerns cleanly
between a server component shell that handles initial data fetching and a client
container that manages filter state and subsequent re-fetches.

---

## Deliverables

- `app/api/analytics/summary/route.ts` — the GET handler that validates query
  params, queries MarkRecords, aggregates all metrics in memory, and returns the
  structured JSON response
- `app/dashboard/analytics/page.tsx` — the React Server Component shell that
  checks session role, fetches default analytics data on first render, and passes
  serialised initial data to the client container as props
- `app/dashboard/analytics/AnalyticsContainer.tsx` — the client-side container
  component that owns filter state, manages re-fetch calls when filters change,
  and distributes data slices to each chart sub-component as props
- Updates to `middleware.ts` to redirect STAFF-role users away from the
  `/dashboard/analytics` route before the page renders

---

## Context and Background

The analytics page lives at `/dashboard/analytics` and is accessible only to users
with the ADMIN or SUPERADMIN role. It presents six distinct chart visualisations
that together give school administrators a comprehensive picture of academic
performance across any combination of grade, term, and year. Because the data
underpinning all six charts is derived from the same filtered set of MarkRecords,
the design decision has been made to load everything in a single API call rather
than having each chart fetch independently.

The page follows the hybrid rendering pattern established elsewhere in the application.
The outermost file — `page.tsx` — is a React Server Component that runs exclusively
on the server. On the very first page load, it calls the analytics summary API using
server-side fetch with the appropriate session credentials. The result is passed down
as serialised props to the client container component, meaning the user sees a fully
populated dashboard on first render with no client-side loading delay.

The client analytics container component is a client component marked with the
`use client` directive. It holds the current filter selections — grade, term, and
year — as React state, along with the current data payload. When the user changes
any filter, the container fires a fetch call to `GET /api/analytics/summary` with
the updated parameters, waits for the response, and replaces the data state. None
of the six chart components participate in fetching; they are purely presentational
and receive their data as props from the container. This keeps each chart component
simple, testable in isolation, and free of side effects.

The filter state should also be reflected in the URL as search parameters. This
means that if an administrator bookmarks the page or shares the URL while viewing
Grade 8, Term 2, the recipient will land on the same filtered view. The client
container must synchronise its internal state with the URL on every filter change
using the Next.js `useRouter` and `useSearchParams` hooks. The server component
shell reads those same search params during initial rendering to determine which
default filters to use when performing the server-side data fetch.

---

## Analytics API Route — GET /api/analytics/summary

### Authentication and Role Guard

Every request to this route must carry a valid NextAuth session with a role of
either ADMIN or SUPERADMIN. The middleware layer defined in `middleware.ts` protects
the entire `/api/analytics` path and will redirect unauthenticated requests to the
sign-in page before they reach the handler. However, middleware alone is insufficient
for role differentiation, so the handler itself must also retrieve the session via
`getServerSession` and explicitly check that `session.user.role` is ADMIN or
SUPERADMIN.

If neither condition is satisfied, the handler must return a 403 response with a
JSON body indicating insufficient permissions. This two-layer check ensures that
even if middleware configuration changes in the future, the route itself remains
protected against privilege escalation by a misconfigured matcher pattern.

### Query Parameters

The route accepts three optional query parameters:

- `grade` — a string representing the grade level, expected values are "6", "7", "8", "9", "10", or "11". When absent, the API returns data aggregated across all grades.
- `term` — one of the enum strings "TERM_1", "TERM_2", or "TERM_3". When absent, the API aggregates across all three terms.
- `year` — a four-digit year string such as "2025". When absent, the API uses the current calendar year as the default.

All three parameters must be validated using a Zod schema before any database query
runs. The Zod schema should define `grade` as an optional string that, when present,
must be one of the six valid grade strings. The `term` field must be an optional
string coerced to one of the three accepted enum values. The `year` field must be an
optional string matching a four-digit numeric pattern, defaulting to the current
year's string representation when not supplied. If any parameter fails validation,
the route returns a 400 response with a descriptive error message derived from the
Zod parse result.

### Aggregation Strategy

The handler uses a single `prisma.markRecord.findMany` call with a `where` clause
derived from the validated filter parameters. The `where` clause filters by `term`
and `year` directly on the MarkRecord model. The grade filter cannot be applied
directly to MarkRecord because that model does not store grade — it only stores a
`studentId`. To filter by grade, the query must use a nested `where` on the related
Student record, which itself joins through ClassGroup to reach the grade field. The
correct Prisma pattern traverses student → classGroup → grade inside the MarkRecord
`where` clause, producing a single SQL JOIN rather than multiple round-trips.

Once the records are loaded into memory, all aggregation logic runs in plain
JavaScript without additional database round-trips. This includes computing per-
subject averages, calculating W-rule rates, building comparison datasets, and
extracting top and bottom performers. Critically, the W-rule is applied only when
determining whether a given mark should be counted towards the W-rate metric; it is
never applied when computing average scores. Averages always use the raw integer
mark values to avoid distorting the mean with artificial substitutions.

### Response Data Fields

The route returns a single JSON object containing seven top-level fields. The table below describes each field, its data shape, and how it is computed.

| Field | Shape | Computation |
|---|---|---|
| `subjectAverages` | Array of `{ subject: string, average: number }` | Group records by subject code, sum raw marks for each, divide by count of non-null marks. Exclude null marks from both numerator and denominator. |
| `wRates` | Array of `{ subject: string, wRate: number }` | For each subject, count records where the W-rule condition is triggered (mark below minimum threshold as defined by Task 3.1 utility), divide by total non-null records for that subject. Express as a decimal 0–1. |
| `classComparisons` | Array of `{ grade: string, subject: string, average: number }` | When no grade filter is applied, compute per-subject averages broken down by grade. Allows cross-grade comparison charts. When a grade filter is active, compare terms instead: `{ term: string, subject: string, average: number }`. |
| `topPerformers` | Array of `{ studentId: string, studentName: string, overallAverage: number }` | Compute each student's overall average across all subjects using raw marks. Sort descending. Return top 5 entries only. |
| `bottomPerformers` | Array of `{ studentId: string, studentName: string, overallAverage: number }` | Same computation as topPerformers but sorted ascending. Return bottom 5 entries. Exclude students with fewer than three non-null marks to avoid skewing the list with sparse data. |
| `heatmapData` | Array of `{ studentId: string, subject: string, mark: number \| null }` | Flat list of every student–subject combination in the filtered dataset, preserving null for missing marks. The chart component maps this flat array into a grid. |
| `scatterData` | Array of `{ studentId: string, overallAverage: number, wCount: number }` | Per-student pair of overall average versus number of subjects where the W-rule was triggered. Used to render the correlation scatter chart. |

### Performance Considerations

Loading all matching MarkRecords in a single query is the correct approach for the
scale of data expected in a typical school deployment. With a few hundred students
across six grades and three terms, the total MarkRecord count across a full academic
year will rarely exceed ten thousand rows, which is well within the memory and
latency budget for a server-side API call.

The most important database optimisation is the compound index on the MarkRecord
table covering `studentId`, `term`, and `year`. This index was defined in the Prisma
schema during Phase 2 and must be present for the filtered query to remain fast as
the dataset grows over multiple years. The grade filter, applied through the nested
Student → ClassGroup join, adds a relational traversal that Prisma resolves with an
additional JOIN in the generated SQL. Without the compound index, this JOIN forces a
full table scan on MarkRecord before the grade predicate can narrow the result set.

The developer should verify using Prisma's query event logging or direct SQL EXPLAIN
output that the index is being used as expected before marking this task complete.
This is a mandatory verification step, not an optional optimisation step that can be
deferred to a later phase.

---

## Analytics Page Architecture

### Server Component Shell

The file `app/dashboard/analytics/page.tsx` is a React Server Component and contains
no client-side interactivity. It runs exclusively on the server during every request
to `/dashboard/analytics`. On each render, it reads the incoming URL's search
parameters to determine the initial filter values for grade, term, and year. If none
are provided, it applies the same defaults as the API route — all grades, all terms,
current year.

After resolving the filter parameters, the shell performs a server-side fetch to
`GET /api/analytics/summary` using the resolved params. This fetch must include the
session cookie by using the `cookies()` helper from `next/headers` to forward the
user's cookie header explicitly. The result is awaited and passed as a prop named
`initialData` to the client analytics container component. The shell also renders the
page heading, subtitle, and the breadcrumb navigation before mounting the container,
so the page skeleton is fully server-rendered and no layout shift occurs.

If the session check inside the shell reveals that the user's role is STAFF, the
shell must call `redirect()` from `next/navigation` with the path `/dashboard` and
never render the page body. This is a defence-in-depth measure that complements the
middleware guard and ensures protection even if the middleware matcher is altered.

### Client Analytics Container

The analytics container component declares `use client` at the top and is the sole
owner of mutable runtime state on the analytics page. It initialises its filter
state from the props received from the server shell, ensuring the client state
matches the server-rendered output and avoiding a hydration mismatch. It also
initialises its data state from the `initialData` prop, so all six charts are
populated immediately without a client-side loading flash on first render.

When any filter value changes, the container constructs a new URL query string from
the updated filter values, calls `router.replace` to update the browser URL without
a full navigation event, and simultaneously issues a fetch request to
`GET /api/analytics/summary` with the same updated params. While the fetch is in
flight, the container sets an `isLoading` boolean state to `true`, which causes the
charts grid to render a loading overlay. When the response arrives, the container
updates the data state and sets `isLoading` back to `false`.

The container renders the filter controls component and passes it the current filter
values and the change handler callbacks as props. Below the filter bar it renders
the grid of chart cards, passing each chart component the relevant data slice from
the current data state object. The container does not contain any chart rendering
logic itself — it only routes data slices to the correct child components.

### Filter Controls Component

The filter controls panel renders three dropdown selects in a horizontal row. The
grade dropdown lists options for "All Grades" plus individual grades six through
eleven. The term dropdown lists "All Terms", "Term 1", "Term 2", and "Term 3". The
year dropdown lists the current year and the two preceding years to cover typical
reporting horizons without overwhelming the user with historical options.

All three selects are controlled components — their displayed value comes from the
filter state held in the container, not from internal DOM state. Each select's
`onChange` handler calls the container-provided setter for that specific filter.
Changing any single filter immediately triggers the full re-fetch sequence. The
component also renders a loading indicator — a spinner or a subtle opacity overlay —
positioned over the charts grid while `isLoading` is true, giving the user clear
visual feedback that results are being refreshed in response to their selection.

### Page Layout

The analytics dashboard uses a CSS grid layout defined in the client container's JSX.
On large screens at the lg breakpoint and above, the grid uses two equal-width
columns so that two chart cards sit side by side per row. On medium and small
screens, the grid collapses to a single column to preserve readability on narrower
viewports without horizontal scrolling.

The six chart cards appear in the following order, filling the grid left-to-right
and top-to-bottom: Subject Averages Bar, W-Rate By Subject Bar, Class Comparison
Bar, Performance Heatmap, Top and Bottom Performers Table, and Scatter Correlation.

Each chart card is wrapped in a card container component that supplies consistent
padding, border, background colour, and border-radius. Inside the card, the
structure follows this order from top to bottom:

- A heading element containing the chart title
- A short descriptive paragraph explaining to the administrator what the chart shows
- The chart component itself, sized to fill the available width at a fixed height
- A Download PNG button positioned at the bottom-right corner of the card

The fixed card height ensures that all cards in the same grid row align their tops
and bottoms cleanly, regardless of how much data each chart renders. Cards with less
data must not collapse to a smaller height and break the grid alignment.

### Role Guard Implementation

The STAFF role is denied access to the analytics page through two complementary
mechanisms. First, the `middleware.ts` file must include an entry in its route
matcher that covers `/dashboard/analytics` and checks the authenticated user's role.
Users with the STAFF role are immediately redirected to `/dashboard` by the
middleware before Next.js even begins rendering the page, and before any server
component code executes.

Second, the server component shell performs its own role check against the session
and calls `redirect('/dashboard')` if the role is not ADMIN or SUPERADMIN. This
second check costs only a `getServerSession` call and is essential because middleware
can be bypassed in certain deployment configurations or during development when
matcher patterns are misconfigured. The defence-in-depth approach means a single
point of failure in either guard does not silently expose analytics data to STAFF
users.

---

## Data Flow Summary

When a user navigates to `/dashboard/analytics`, Next.js runs the server component
shell. The shell reads any search parameters from the URL to determine initial filter
values, then performs a server-side fetch to the analytics summary API — passing the
session cookie from `next/headers`. The API authenticates the request, validates the
parameters, queries the database via the compound-indexed MarkRecord query, aggregates
the data across all seven metric fields in memory, and returns the JSON payload. The
shell passes this payload as `initialData` to the client analytics container, which
initialises both its filter state and its data state from these props. Next.js
serialises the complete component tree including the container's already-populated
initial state and sends the fully rendered HTML to the browser.

In the browser, React hydrates the page using the same `initialData` that was used
during server rendering, so all six chart sub-components are immediately populated
and no client-side loading flicker occurs on first view. When the user changes a
filter in the filter controls panel, the container's change handler updates filter
state, pushes the new params to the URL via `router.replace`, sets `isLoading` to
true, and dispatches a fetch request to `GET /api/analytics/summary` with the updated
query parameters. While the request is in flight the charts grid shows a loading
overlay. When the response resolves, the container updates the data state, clears the
loading flag, and React re-renders all six chart sub-components with their new data
slices as props.

---

## Acceptance Criteria

1. A GET request to `/api/analytics/summary` with a valid ADMIN session and correct
   filter parameters returns a 200 response containing all seven required data fields
   with correctly shaped payloads matching the specified types.
2. A request to the same route with a STAFF session returns a 403 response and no
   data payload is included in the response body.
3. An unauthenticated request to the analytics API route is intercepted by middleware
   and redirected to the sign-in page before the handler executes.
4. A request supplying an invalid `term` value outside the three accepted enum strings
   returns a 400 response containing a descriptive Zod validation error message.
5. Navigating to `/dashboard/analytics` as an ADMIN user renders a fully populated
   dashboard on first load without any client-side loading state being visible.
6. Navigating to `/dashboard/analytics` as a STAFF user results in immediate
   redirection to `/dashboard` before the analytics page body is rendered at any
   stage in the request lifecycle.
7. Changing the grade filter updates the URL search parameters, triggers a re-fetch,
   displays a loading overlay on the charts grid while the request is in flight, and
   updates all six charts when the response arrives.
8. The URL search parameters accurately reflect the current filter selections at all
   times; reloading the page with the current URL re-renders the same filtered view
   with the same data without requiring manual re-selection.
9. The compound index on MarkRecord covering `studentId`, `term`, and `year` is
   confirmed to be actively used via Prisma query logging or SQL EXPLAIN output, with
   no full table scans observed on typical filtered queries.
10. Subjects with null marks are excluded from average calculations, and the
    `bottomPerformers` list excludes students with fewer than three non-null marks,
    producing a list free of artificially low outliers caused by sparse data entry.

---

## Notes and Pitfalls

- The grade filter cannot be applied directly to the MarkRecord model because
  MarkRecord does not store a grade field. The filter must pass through the nested
  Prisma relation path: student → classGroup → grade. Omitting this join and
  attempting to filter grade at the MarkRecord level will either produce a Prisma
  type error or silently return incorrect results depending on the Prisma version.
  Verify the generated SQL to confirm the JOIN is present before treating the
  aggregation logic as complete.

- Null subject marks must be explicitly skipped when computing averages and W-rates.
  Treating a null mark as zero will artificially deflate subject averages and inflate
  W-rates for subjects where some marks have not yet been entered by teaching staff.
  The aggregation logic must check for null before including any mark value in a
  running sum or count variable.

- The server-side fetch inside the server component shell must explicitly forward the
  user's session cookie. Next.js server components do not automatically forward
  cookies on internal fetch calls in all deployment environments. Use the `cookies()`
  function from `next/headers` to retrieve the full cookie header string and include
  it in the fetch options headers object before the request is dispatched.

- Filter dropdowns must be controlled components synchronised to both React state and
  URL search params. Relying solely on internal DOM state will cause the URL to drift
  out of sync with the displayed data, silently breaking bookmarking and link sharing.
  Use `useSearchParams` to read initial values on component mount and `router.replace`
  on every filter change to keep both in sync without adding entries to browser history.

- The Download PNG button on each chart card depends on the chart library exposing a
  reference to the underlying canvas or SVG element. Ensure the chart components
  built in Task 4.1 were implemented with `forwardRef` or expose a download method
  via an imperative handle. Retrofitting this capability after all chart components
  are already complete is substantially more disruptive than accounting for it at the
  time each chart component is first authored.
