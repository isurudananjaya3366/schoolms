# Phase 2 / Task 1 — Dashboard Layout Shell and Navigation

**Phase:** 2 — Core Dashboard and Student Management
**Task:** 1 of 5
**Title:** Dashboard Layout Shell and Navigation
**Estimated Complexity:** Medium

---

## Task Summary

This task constructs the persistent shell of the authenticated dashboard experience. It establishes the root layout for all pages under the `/dashboard` route, building the sidebar, topbar, mobile drawer, and routing infrastructure that every subsequent Phase 2 and later task will depend on.

In addition to the shell, this task delivers the Dashboard Overview page at `/dashboard/page.tsx`, which serves as the landing page after login. This page presents four KPI cards summarising student enrolment, mark records, pending entry, and overall W-rate for the current term. It also includes a scrollable Recent Activity Feed drawn from the AuditLog collection and a Quick Actions section with a search-driven report dialog.

Finally, this task adds the AuditLog Prisma model to the database schema and generates the corresponding migration. This model underpins audit trails created in Phase 1's authentication system and extended through every write operation in later phases.

By the end of this task, every authenticated user who visits any `/dashboard/*` route will experience a fully-functional navigation shell, even if the destination page is a placeholder. The Dashboard Overview page will display live data pulled from the database in parallel server-side queries.

---

## Prerequisites

- Phase 1 is fully complete and all acceptance criteria have been verified.
- The MongoDB Atlas cluster is reachable from the Next.js application environment and connection strings are stored in `.env.local` under the keys specified in Phase 1.
- At least one user with the `SUPERADMIN` role exists in the `User` collection. This is required for testing role-conditional navigation rendering.
- At least one `ClassGroup` record exists in the database. ClassGroup records are referenced by the dashboard's KPI queries and their absence will affect the Pending Mark Entry calculation.
- The Phase 1 placeholder pages (stub files under `/dashboard/marks`, `/dashboard/reports`, `/dashboard/analytics`, `/dashboard/backup`, `/dashboard/settings/audit`) may exist as empty files or simple stubs. This task replaces them with proper placeholder UI.
- `shadcn/ui` has been initialised in the project as per Phase 1 tooling. The `Sheet`, `Dialog`, `Button`, `Card`, `Badge`, and `Separator` components must be added to `components/ui/` using the shadcn CLI if they are not already present.
- `date-fns` must be installed as a dependency for relative timestamp formatting in the Activity Feed.

---

## Task Scope

**In scope:**
- Adding the `AuditLog` Prisma model to `prisma/schema.prisma` and running `prisma migrate dev` (or `prisma db push` for MongoDB) to register the schema change.
- Implementing `app/dashboard/layout.tsx` as a React Server Component.
- Building `components/dashboard/Sidebar.tsx` with server and client sub-components.
- Building `components/dashboard/Topbar.tsx` as a Client Component.
- Building `components/dashboard/MobileNav.tsx` as the Sheet-based mobile drawer.
- Implementing `app/dashboard/page.tsx` as the Dashboard Overview Server Component.
- Building `components/dashboard/KpiCard.tsx`, `components/dashboard/ActivityFeed.tsx`, and `components/dashboard/QuickActions.tsx`.
- Implementing all six placeholder pages with proper layout-consistent UI and Back to Overview navigation links.
- Wiring the student search dialog in Quick Actions to the existing `GET /api/students` endpoint.

**Out of scope:**
- Mark entry, mark viewing, or any marks-related API routes — those belong to Phase 3.
- Report generation — Phase 3.
- Analytics charts or data visualisation — Phase 4.
- Backup and restore functionality — Phase 5.
- Audit Log browsing UI — Phase 5.
- The Student Management pages (`/dashboard/students`) — those are Task 2 and Task 3 of Phase 2.
- Writing to the AuditLog collection from within this task. The model is created here; the first writes are performed in Phase 2 Task 2 onwards.
- Any API routes for KPI data. All KPI queries are server-side Prisma calls within the page component itself, not API endpoints.

---

## Acceptance Criteria

1. Navigating to `/dashboard` as any authenticated user renders the full shell: sidebar on desktop (≥1024 px), topbar with breadcrumb and user identity, and the Dashboard Overview content.
2. The sidebar on desktop is persistent and does not require user interaction to appear. On viewports below 1024 px, the sidebar is hidden and a hamburger button is visible in the topbar.
3. Tapping the hamburger button on mobile opens the Sheet drawer containing the full sidebar content. Tapping outside the drawer or selecting a navigation item closes it.
4. Each navigation item is visible only to users whose role meets the minimum role requirement. Navigating to the page source confirms the HTML contains no anchor elements for items the current user's role does not qualify for.
5. The currently active route is visually distinguished in the sidebar with a highlighted background or accent colour. Navigating between routes updates the active highlight without a full page reload.
6. The topbar breadcrumb correctly reflects the current path as human-readable labels for all routes in the navigation map.
7. The logout button in the topbar invokes NextAuth `signOut` and redirects to the sign-in page.
8. All six placeholder pages render a properly structured card UI within the dashboard shell, each with a descriptive label indicating the planned phase of implementation, and a Back to Overview link.
9. The Dashboard Overview page renders four KPI cards. Each card displays its computed value. If a Prisma query fails for any individual card, that card displays a dash and "Data unavailable" rather than throwing an unhandled error.
10. The Recent Activity Feed renders the 20 most recent AuditLog entries as human-readable sentences with relative timestamps. If the AuditLog collection is empty, the feed shows "No recent activity".
11. The Quick Actions section displays three buttons. The "Enter Marks" and "Add Student" buttons navigate to their respective routes. The "Generate Report" button opens a Dialog with a functional student search input.
12. The student search within the Quick Actions dialog calls `GET /api/students?search=query` and displays matching results. Clicking a result navigates to that student's detail page.
13. The `AuditLog` model is present in `prisma/schema.prisma` with all specified fields, an index on `timestamp`, and the schema change has been applied to the database.
14. The application has no TypeScript compilation errors after this task is complete (`tsc --noEmit` passes cleanly).
15. The layout renders without hydration errors in the browser console.

---

## AuditLog Model Addition

The `AuditLog` model is introduced in this task rather than Phase 1 because its presence is tightly coupled to the Dashboard Overview's Activity Feed, which is the first UI that reads from it. Phase 1 created the database connectivity and user management infrastructure; this task is the first to require a readable audit history.

The model is stored in the same `prisma/schema.prisma` file as all other models. Add it after the existing model definitions.

The model fields are:

- `id` — The document's primary key, mapped to MongoDB's `_id` ObjectId field. Uses `@default(auto())` and `@db.ObjectId`. Type is `String`.
- `timestamp` — A `DateTime` field with `@default(now())`. This represents when the action occurred and is the primary sort field for the feed.
- `userId` — An optional `String` with `@db.ObjectId`. Nullable because automated system actions (such as scheduled backup tasks in Phase 5) will have no associated user. This is a reference to the `User` model's `id` field but is stored as a plain string without a Prisma relation directive, because audit log entries must survive user deletion without cascading.
- `userDisplayName` — A non-nullable `String`. This is a denormalised copy of the user's display name at the moment the action was performed. It ensures the feed still renders human-readable sentences even after the referenced user account has been deleted or renamed.
- `action` — A non-nullable `String`. This holds the action type constant (e.g., `STUDENT_CREATED`, `MARK_UPDATED`). The set of recognised action types grows across phases; using a string rather than a Prisma enum allows new types to be added without schema migrations.
- `targetId` — An optional `String` with `@db.ObjectId`. The database ID of the primary entity affected by the action. Settings-only changes will leave this null.
- `targetType` — An optional `String`. A human-readable category for the target entity, such as `"STUDENT"`, `"USER"`, or `"SETTINGS"`. Used by the feed formatter to construct contextually relevant sentences.
- `ipAddress` — An optional `String`. The IP address of the originating request. Populated by middleware or API handlers in later phases.
- `details` — A non-nullable `String`. A JSON-serialised object containing action-specific metadata. For `STUDENT_UPDATED`, this might encode the changed field names and previous/new values as a stringified JSON object. For `MARK_UPDATED`, it might include subject name and class group. The feed formatter parses this string selectively using `JSON.parse` with a try-catch guard.

After adding the model, add a compound index on `timestamp` in descending order. For MongoDB with Prisma, this is declared using the `@@index` attribute on the model with the field name and sort direction. This index ensures that the most-recent-first query for the Activity Feed is performant even as the collection grows large over time.

Run `prisma db push` (for MongoDB Atlas, which does not support migration history in the same way as relational databases) after adding the model to register the schema change.

---

## Implementation Steps

### Step 1: app/dashboard/layout.tsx — Server Component Shell

The file at `app/dashboard/layout.tsx` is the root layout for the entire authenticated dashboard. It is a React Server Component and must not contain `"use client"` at the top.

Its primary responsibilities are: reading the authenticated session from NextAuth, extracting the user's role from the session, and composing the `Sidebar`, `Topbar`, and content area into a single layout tree.

Import NextAuth's `auth()` function. This is a server-only call. Call `await auth()` at the top of the layout function to retrieve the current session. If `session` is null or `session.user` is undefined, redirect to the sign-in page using Next.js's `redirect()` function from `next/navigation`. This is a secondary guard; the primary protection is the middleware from Phase 1, but both layers are maintained for defence in depth.

Extract `session.user.role` and `session.user.name` (or `displayName` — match the field name established in Phase 1's auth configuration) for passing to child components.

The layout renders a full-height flex container. On desktop, the sidebar occupies a fixed-width left column (typically 240 to 256 px) and the right side fills the remaining width as a column containing the topbar and the scrollable main content area. Use Tailwind's `lg:flex`, `lg:w-64`, and `flex-1` utilities to achieve this two-column structure.

Pass `role` as a prop to the `Sidebar` and `Topbar` components. Do not pass the entire session object. This keeps the client-side components from having access to unexposed session fields and keeps the prop interface clean.

The `{children}` slot is rendered inside a `main` element with `flex-1 overflow-y-auto` and appropriate padding so that page content never obscures or underlaps the topbar.

The `MobileNav` component receives the same `role` prop and also receives the sidebar's nav item tree so that it can render the same content without duplication.

### Step 2: Sidebar Component — Server and Client Architecture

The sidebar is split into two files. The outer file (`Sidebar.tsx`) is a Server Component that receives `role` as a prop, filters the navigation items array down to only those the user's role permits, and passes the filtered list to an inner Client Component responsible for rendering with active state.

Define a `navItems` constant array at the module level. Each item in the array is an object with at minimum: `label` (string), `href` (string), and `minRole` (a value from the role hierarchy: `"ALL"`, `"ADMIN"`, or `"SUPERADMIN"`). Optionally include an `icon` field (a Lucide React icon component reference) and a `group` field (string such as `"main"` or `"admin"`) for visual grouping with a separator.

The role hierarchy is: `VIEWER` < `TEACHER` < `ADMIN` < `SUPERADMIN`. Define a utility function (or a record keyed by role) that maps each role to a numeric priority so that filtering can be expressed as a numeric comparison rather than a chain of string checks.

The Server Component filters the array: for each nav item, the user's role priority must be greater than or equal to the item's minimum role priority. Items that do not pass are excluded entirely from the array before it is passed to the Client Component. This means they never appear in the rendered HTML.

The inner Client Component (`SidebarNav.tsx` or a named export within `Sidebar.tsx`) imports `usePathname` from `next/navigation`. For each nav item in the filtered list, it compares the item's `href` against the current pathname to determine whether it is active. An item is considered active if the pathname exactly equals the href, or if the href is not `/dashboard` and the pathname starts with the href (to handle nested routes like `/dashboard/students/new` correctly highlighting the Students item).

At the top of the sidebar, render the SchoolMS logo and application name using Tailwind typography and a school-building or graduation cap icon from Lucide. Below it, render the navigation list. Group items using the `group` field: insert a shadcn `Separator` between groups. Admin-level items appear at the bottom of the sidebar separated visually from the main group.

Active items are styled with a filled background using the application's primary colour token. Inactive items show a hover state with a lighter background. Both states use Tailwind classes applied conditionally based on the `isActive` boolean.

### Step 3: Topbar Component

`Topbar.tsx` is a Client Component (`"use client"` at the top) because it uses `usePathname` for breadcrumb rendering and must handle the hamburger click event.

The topbar is a full-width horizontal bar fixed to the top of the content area (or sticky within its scroll container). It has three zones: left, centre, and right.

The left zone contains the hamburger `<button>` element (visible only on mobile via `lg:hidden`) and the breadcrumb navigation. When the hamburger button is clicked, it triggers a state update that opens the `MobileNav` Sheet. This state must be lifted to the parent layout or managed via a shared context. The recommended approach for this task is to manage the `isOpen` boolean as state within the `Topbar` and pass the setter down to `MobileNav`, or to use a lightweight Zustand slice if the project already has Zustand installed. If neither applies, a React context provider scoped to the dashboard layout is acceptable.

The breadcrumb builds a mapping from URL path segments to human-readable labels. Define a `breadcrumbLabels` record object in the same file: map path segments such as `"dashboard"`, `"students"`, `"marks"`, `"entry"`, `"view"`, `"reports"`, `"analytics"`, `"backup"`, `"settings"`, `"users"`, `"audit"` to their display labels. Split `usePathname()` on `/`, filter empty strings, and produce an array of `{ label, href }` pairs where each `href` is the cumulative path up to that segment. Render each pair as a breadcrumb item. The last item is non-linked (current page).

The right zone renders: the current user's display name in a `<span>`, a `<Badge>` showing their role (styled with a colour appropriate to their role level), a bell icon `<button>` for future notifications (renders the icon but has no action in Phase 2, with a `title` of "Notifications — coming soon"), and a logout `<button>` that calls NextAuth's `signOut()` with `{ callbackUrl: "/auth/signin" }` on click.

The `role` and `displayName` values are received as props from the server layout. Do not call `useSession()` in the Topbar — the layout already reads the session server-side and passes what is needed as plain props.

### Step 4: Mobile Sheet Drawer

`MobileNav.tsx` wraps the shadcn `Sheet` component from `components/ui/sheet`. It receives: `role` (the user's role string), `isOpen` (boolean), and `onClose` (callback function).

The sheet is opened with `open={isOpen}` and the `onOpenChange` prop is wired to `onClose` so that clicking outside dismisses it. The `side` prop is set to `"left"`.

Inside the `SheetContent`, render the same sidebar structure as the desktop sidebar: the logo at the top, followed by the role-filtered navigation list. The navigation items are the same `navItems` array filtered by role. Clicking a nav item must call `onClose()` before navigation occurs, so the drawer closes cleanly. Achieve this by wrapping each nav item's `onClick` to call `onClose()` in addition to allowing the default link navigation.

The Sheet's close button (provided automatically by shadcn's SheetContent) also invokes `onClose` via `onOpenChange`. Do not render a duplicate close button.

The `isOpen` / `onClose` state bridge between `Topbar` and `MobileNav` is managed at the `layout.tsx` level. Because `layout.tsx` is a Server Component, this state must live in a thin Client Component wrapper. Create a very small `DashboardShell.tsx` Client Component in `components/dashboard/` that holds the `isOpen` state, renders `<Topbar>` and `<MobileNav>` as siblings, and passes the state and setter through props. The Server Component `layout.tsx` renders `<DashboardShell>` in place of rendering `<Topbar>` and `<MobileNav>` directly.

### Step 5: Placeholder Pages

Each placeholder page is a Server Component file at its respective route. All six pages follow an identical structural pattern.

The page renders a centred card using shadcn's `Card`, `CardHeader`, `CardTitle`, `CardDescription`, and `CardContent` components. The card's title matches the feature name (e.g., "Mark Entry"). The description states which phase will implement the feature and one sentence describing what the completed feature will do. Below the description, a secondary line reads the implementing phase in a `<Badge>` styled with a muted colour variant.

At the bottom of the card content, render a `<Link>` pointing to `/dashboard` with the label "Back to Overview". Style it as a ghost `Button` or a plain anchor with an arrow-left Lucide icon prefix.

The pages must still be wrapped by `app/dashboard/layout.tsx` (they are, by virtue of their route position). This means they will automatically receive the sidebar and topbar — no additional layout wrapping is needed inside the placeholder files.

The six files and their card titles:
- `app/dashboard/marks/entry/page.tsx` — "Mark Entry"
- `app/dashboard/marks/view/page.tsx` — "View Marks"
- `app/dashboard/reports/page.tsx` — "Progress Reports"
- `app/dashboard/analytics/page.tsx` — "Analytics"
- `app/dashboard/backup/page.tsx` — "Backup and Restore"
- `app/dashboard/settings/audit/page.tsx` — "Audit Log"

### Step 6: Dashboard Overview — KPI Card Design

`KpiCard.tsx` is a reusable component stored at `components/dashboard/KpiCard.tsx`. It accepts the following props: `title` (string), `value` (string or number, or null to indicate loading/error), `subtitle` (string, optional), `icon` (a Lucide React icon component, optional), `isLoading` (boolean, defaults to false), and `isError` (boolean, defaults to false).

When `isLoading` is true, render a skeleton shimmer in place of the value. Use Tailwind's `animate-pulse` class on placeholder `div` elements sized to match the value and subtitle regions.

When `isError` is true, render a dash character ("—") as the value and "Data unavailable" as the subtitle, styled in a muted colour. Override any subtitle prop passed in when `isError` is true.

When neither loading nor error, render the `value` prominently (large font, bold) and the `subtitle` below it in a smaller muted style.

The card shell uses shadcn's `Card` with `CardContent`. The icon (if provided) is rendered in the top-right corner of the card content area, sized at 24 px, with a muted colour. The `title` is rendered above the value in a small caps or uppercase muted label style.

For the four specific KPI cards on the Dashboard Overview page:
- Total Students: use a users/people Lucide icon.
- Mark Records This Term: use a clipboard or file-text icon.
- Pending Mark Entry: use an alert-circle or clock icon.
- W-Rate This Term: use a trending-down or percent icon.

### Step 7: Dashboard Overview — Data Queries

All four KPI queries are performed inside `app/dashboard/page.tsx` as a Server Component. Use `Promise.all` to run all four queries in parallel, reducing the total round-trip time to the duration of the slowest individual query.

Each individual Prisma query must be wrapped in its own try-catch block within the `Promise.all` array so that one failed query does not fail all four. Each query returns a result object shaped as `{ value: number | null, error: boolean }`. If the try block succeeds, `error` is `false` and `value` holds the computed number. If the catch block is reached, `error` is `true` and `value` is `null`.

**KPI 1 — Total Students Enrolled:** Query `prisma.student.count({ where: { isDeleted: false } })`. For the delta calculation, also query `prisma.student.count({ where: { isDeleted: false, academicYear: previousYear } })` where `previousYear` is derived from the current academic year string by decrementing the year component. If no students match the previous year query (either because the field does not exist or returns zero), skip the delta label on the card subtitle.

**KPI 2 — Mark Records This Term:** Fetch the current academic year and term from `SystemConfig`. Query `prisma.systemConfig.findMany({ where: { key: { in: ["academic_year", "current_term"] } } })` and extract the values into a map. If either key is missing, fall back to a hardcoded default (current calendar year as `"YYYY/YYYY+1"` and `"1"` for term). Then query `prisma.markRecord.count({ where: { academicYear: currentYear, term: currentTerm } })`. Use the year and term string as the `subtitle` prop on the card.

**KPI 3 — Pending Mark Entry:** This requires two counts: total active students and students who have at least one MarkRecord for the current term/year. Students who have no MarkRecord for the current term are "pending". Compute: `totalStudents - studentsWithRecords`. Present the raw count as the value and the percentage of total students (formatted as `"X% of enrolled students"`) as the subtitle. Guard against division by zero if total students is zero.

**KPI 4 — W-Rate This Term:** Query all `MarkRecord` documents for the current term/year. Each `MarkRecord` contains multiple subject mark fields. Count the total number of individual mark fields across all records and separately count how many of those fields hold a value below 35. The percentage is `(belowThreshold / total) * 100`. If no mark records exist at all, set the value to `"0%"` with subtitle `"No marks entered yet"`. The raw count of below-threshold marks is used as the subtitle when marks do exist.

After the `Promise.all` resolves, pass each result's `value`, `error` state, and computed subtitle into the corresponding `KpiCard` component.

### Step 8: Dashboard Overview — Activity Feed

`ActivityFeed.tsx` in `components/dashboard/` receives an array of `AuditLog` objects as a prop. It is a Client Component because it uses `date-fns` for relative time formatting, which needs the current time at render (`new Date()` must run client-side to avoid hydration mismatches from server-time-vs-client-time deltas).

Define a `formatAuditEntry` utility function, either within the component file or in `lib/formatAuditEntry.ts`. The function receives a single `AuditLog` object and returns a formatted sentence string. Use a `switch` statement on the `action` field:

- `STUDENT_CREATED`: Construct the sentence from `userDisplayName` and `details`. Parse `details` as JSON to extract `targetName`. If parsing fails, fall back to "a student".
- `STUDENT_UPDATED`: Extract the array of changed field names from parsed `details.fields`. Format them as a comma-separated list. If the list exceeds three items, show two names and "and N others".
- `STUDENT_DELETED`: Use `userDisplayName` and the `targetName` from parsed `details`.
- `USER_CREATED`: Extract `targetEmail` and `role` from parsed `details`.
- `USER_UPDATED`: Use `userDisplayName` and `targetEmail` from parsed `details`.
- `USER_DEACTIVATED`: Use `userDisplayName` and `targetEmail` from parsed `details`.
- `SETTINGS_UPDATED`: Only `userDisplayName` is needed; no entity target.
- `MARK_UPDATED`: Extract `subject` and `className` from parsed `details`.
- Default (unrecognised action): Return `userDisplayName + " performed an action"`.

All `JSON.parse` calls on `details` must be wrapped in try-catch blocks returning an empty object on failure. The formatter must never throw.

For relative timestamps, use `date-fns` `formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })`. This produces strings like "3 minutes ago" or "2 days ago".

The component renders a scrollable `<ul>` with `max-h-96 overflow-y-auto`. Each list item shows the formatted sentence on one line and the relative timestamp in a smaller muted colour below it. An avatar or action-type icon to the left of each item is optional but recommended.

When the `entries` prop array is empty, render a centred "No recent activity" paragraph in a muted colour.

In `app/dashboard/page.tsx`, query `prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 20 })` server-side, catching errors. Pass the result array (or an empty array on error) to `<ActivityFeed>`.

### Step 9: Dashboard Overview — Quick Actions and Search Dialog

`QuickActions.tsx` in `components/dashboard/` is a Client Component. It renders three action buttons in a horizontal row (wrapping to a second row on narrow viewports).

The first two buttons are Next.js `<Link>` components styled as `Button` with a default or secondary variant: "Enter Marks" links to `/dashboard/marks/entry` and "Add Student" links to `/dashboard/students/new`.

The third button, "Generate Report", is a plain `<button>` (or `Button` variant) that sets a boolean state to open the shadcn `Dialog`. The Dialog's trigger is this button.

Inside the Dialog content:
- Title: "Generate Student Report"
- Description: "Search for a student by name or index number to view their profile and generate a report."
- A controlled text input (using React state) labelled "Search students". As the user types (with a debounce of 300 ms or on explicit input event), call `GET /api/students?search={query}` using the browser `fetch` API. Do not use SWR or React Query for this single dialog search — a plain `useEffect` or `onChange` handler with `AbortController` is sufficient.
- Display loading state while the fetch is in progress (a spinner or "Searching..." text).
- Display results as a list of clickable items, each showing the student's full name and index number. On click, close the Dialog and navigate to `/dashboard/students/{studentId}` using the Next.js `useRouter` hook's `push` method.
- If the query returns zero results, show "No students found matching your search."
- If the fetch fails, show "Search unavailable. Please try again."
- Leave the input and results list empty when the search field is empty (no automatic fetch for blank queries).

The Dialog is closed by the shadcn Dialog's built-in overlay click and escape key handling, as well as explicitly when a student result is selected.

---

## shadcn/ui Components Required

The following shadcn/ui components must be available in `components/ui/` before implementation begins. Add any that are missing using `npx shadcn@latest add <component-name>`:

- `sheet` — used by `MobileNav.tsx` for the mobile sidebar drawer.
- `dialog` — used by `QuickActions.tsx` for the report search dialog.
- `button` — used across the layout, placeholders, and overview page.
- `card` — used by `KpiCard.tsx`, `ActivityFeed.tsx`, placeholder pages, and `QuickActions.tsx`.
- `badge` — used by `Topbar.tsx` for the role label and by placeholder pages for the phase label.
- `separator` — used by `Sidebar.tsx` to divide navigation groups.
- `skeleton` — used by `KpiCard.tsx` for the loading shimmer state.
- `input` — used inside the Quick Actions dialog's student search field.

---

## Role Enforcement in the Layout

The sidebar's role enforcement is implemented at the data layer, not the rendering layer. The `navItems` array is filtered before it is passed to any Client Component. This means the HTML sent to the browser for a `TEACHER` role user will contain no anchor element pointing to `/dashboard/analytics` or `/dashboard/backup`. A user cannot reveal hidden nav items by manipulating CSS or JavaScript in their browser.

This is the correct approach for navigation visibility. It does not replace route-level protection (which is handled by the middleware from Phase 1) but it ensures that the UI does not expose routes that the user should not know about or be tempted to access directly.

The role hierarchy used for filtering must be consistent with the role constants defined in Phase 1. Reference the same `UserRole` enum or string union type from Phase 1's shared type definitions rather than redefining it in this task.

The `SUPERADMIN` role must not appear in the nav for `ADMIN` users, and neither `ADMIN` nor `SUPERADMIN` items must appear for `TEACHER` or `VIEWER` roles.

---

## TypeScript Considerations

Define a `NavItem` interface or type alias in a shared location (such as `types/navigation.ts` or co-located in `components/dashboard/Sidebar.tsx`) covering: `label: string`, `href: string`, `minRole: UserRole | "ALL"`, `icon?: LucideIcon`, `group?: string`. Use this type for the `navItems` array to ensure all items are correctly typed at compile time.

The `formatAuditEntry` function should be typed with a parameter of type `AuditLog` (from the Prisma client's generated types) and a return type of `string`. Import `AuditLog` from `@prisma/client`.

The `KpiCard` component props should be defined as a TypeScript interface. The `value` prop should be typed as `string | number | null` to accommodate all four card scenarios.

The `DashboardShell` Client Component must type its props appropriately: `role: UserRole`, `displayName: string`, and `children: React.ReactNode`.

Avoid using `any` casts when parsing `details` from the AuditLog. Type the parsed object as `Record<string, unknown>` and use type guards or optional chaining when accessing specific fields.

---

## File Inventory

The following files are created or modified in this task:

- `prisma/schema.prisma` — modified to add the `AuditLog` model.
- `app/dashboard/layout.tsx` — created as the dashboard root layout Server Component.
- `app/dashboard/page.tsx` — created as the Dashboard Overview Server Component.
- `app/dashboard/marks/entry/page.tsx` — created as a placeholder page.
- `app/dashboard/marks/view/page.tsx` — created as a placeholder page.
- `app/dashboard/reports/page.tsx` — created as a placeholder page.
- `app/dashboard/analytics/page.tsx` — created as a placeholder page.
- `app/dashboard/backup/page.tsx` — created as a placeholder page.
- `app/dashboard/settings/audit/page.tsx` — created as a placeholder page.
- `components/dashboard/Sidebar.tsx` — created; contains both the server outer component and exports the inner client nav component.
- `components/dashboard/SidebarNav.tsx` — created as the Client Component inner part of the sidebar (alternatively named export within `Sidebar.tsx`).
- `components/dashboard/Topbar.tsx` — created as a Client Component.
- `components/dashboard/MobileNav.tsx` — created as a Client Component wrapping the Sheet drawer.
- `components/dashboard/DashboardShell.tsx` — created as a thin Client Component to hold mobile drawer open/close state.
- `components/dashboard/KpiCard.tsx` — created as the reusable KPI card component.
- `components/dashboard/ActivityFeed.tsx` — created as a Client Component rendering the audit log feed.
- `components/dashboard/QuickActions.tsx` — created as a Client Component with the Dialog.
- `lib/formatAuditEntry.ts` — created as the audit log sentence formatter utility.
- `types/navigation.ts` — created to hold the `NavItem` type definition.

---

## Integration Points with Other Tasks

**Phase 2, Task 2 (Student List Page):** Depends on the dashboard layout shell being fully functional. The student list page at `/dashboard/students` slots into the `{children}` area of the layout created here. Active route highlighting in the sidebar will need to correctly identify `/dashboard/students` and its nested routes. The `Add Student` Quick Actions button links to `/dashboard/students/new`, which is implemented in Task 3.

**Phase 2, Task 3 (Add and Edit Student):** The student search dialog in `QuickActions.tsx` navigates to `/dashboard/students/{studentId}`. This route is implemented in Task 3. In Phase 2 Task 1, the navigation to that route will succeed but will land on a not-yet-implemented page; this is acceptable within the phase.

**Phase 3 (Marks Entry and Reports):** The placeholder pages created here will be replaced by fully functional pages in Phase 3. The placeholder files will be overwritten entirely. Phase 3 implementors should consider the layout shell established here as a fixed dependency and should not modify `app/dashboard/layout.tsx`.

**Phase 5 (Backup, Security, and Audit Log):** The placeholder pages for backup and audit log created here will be replaced in Phase 5. The `AuditLog` Prisma model added in this task is the foundation that all write operations in Phase 2 through Phase 4 will build upon. Any Phase that creates or modifies student, user, or settings records must write an `AuditLog` entry at the time of the action.

---

## Common Pitfalls

**Server vs Client component boundary for active route state:** The `usePathname` hook only works inside Client Components. Do not attempt to call it inside `app/dashboard/layout.tsx` or `components/dashboard/Sidebar.tsx` if those files are Server Components. The active state logic must live in the inner Client Component (`SidebarNav.tsx` or `DashboardShell.tsx`). Forgetting the `"use client"` directive in `SidebarNav.tsx` or importing it into a Server Component without proper dynamic importing will cause a build error.

**Passing role without passing the full session to Client Components:** Never pass the entire `Session` object from the Server Component layout to a Client Component. The session may contain tokens or sensitive fields. Extract only `role` (string) and `displayName` (string) and pass those as explicit typed props.

**AuditLog query before any entries exist:** The `findMany` query on an empty collection returns an empty array, not an error. The Activity Feed component must handle the empty array gracefully by showing "No recent activity". Do not assume any entries exist when writing the initial query.

**SystemConfig missing keys for current term/year:** If the database was seeded without `academic_year` or `current_term` keys in the `SystemConfig` collection, the KPI queries for Mark Records and Pending Entry will use fallback values. Ensure the fallback logic is explicit and does not produce `NaN`, `undefined`, or empty strings that could break downstream query filtering. Log a warning to the server console when a fallback is invoked so the issue is detectable.

**Hydration mismatch from relative timestamps:** Relative time strings (e.g., "3 minutes ago") computed client-side will differ from any server-rendered value if the server renders the Activity Feed with static timestamps. Ensure `ActivityFeed.tsx` is a Client Component so that `formatDistanceToNow` runs only in the browser, or use `suppressHydrationWarning` on the timestamp element as a last resort.

**Mobile drawer state scope:** If the `isOpen` state for the Sheet drawer is placed inside either `Topbar.tsx` or `MobileNav.tsx` alone, it cannot be shared between the two. Place this state in the shared `DashboardShell.tsx` Client Component wrapper that renders both. Failing to do this will result in a hamburger button that cannot communicate with the drawer.

**Nav item filtering and the `"ALL"` sentinel:** The `minRole` field on nav items that are visible to all authenticated users should use a sentinel value such as `"ALL"` rather than the lowest-privilege role name. This prevents future role additions from accidentally hiding items that should be universally visible. The filter logic must handle the `"ALL"` sentinel by always returning `true` for those items regardless of the user's actual role.
