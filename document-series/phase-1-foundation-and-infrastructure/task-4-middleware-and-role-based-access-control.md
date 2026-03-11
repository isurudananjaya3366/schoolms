# Task 4: Middleware and Role-Based Access Control

| Field | Value |
|---|---|
| Phase | 1 — Foundation and Infrastructure |
| Task Number | 4 of 5 |
| Title | Middleware and Role-Based Access Control |
| Estimated Complexity | Medium-High |
| Depends On | Task 1 (scaffolding), Task 2 (Prisma schema), Task 3 (NextAuth authentication) |

---

## Task Summary

This task establishes the security perimeter for the entire SchoolMS application. It authors the `middleware.ts` file at the project root, which acts as the first interception layer for all incoming requests to protected paths. It implements a reusable authentication and role-validation helper at `lib/auth-guard.ts` for use inside API route handlers. It creates stub implementations for all dashboard pages and API routes so that the protection layer can be verified end-to-end before any real feature logic is written. Finally, it defines and documents the three-layer role enforcement model that all subsequent phases will depend on.

The complexity of this task is rated Medium-High because of one fundamental constraint: the Next.js Edge Runtime in which middleware executes is a restricted serverless environment with no access to Node.js built-in modules. This rules out Prisma, bcrypt, and most database clients. The middleware can only inspect the JWT contents embedded in the NextAuth session cookie. The `/config` path access rule introduces a secondary complexity because it requires knowledge of whether the database has been configured, which would normally demand a Prisma query — a query that cannot legally run in middleware. Handling this constraint correctly requires deliberate design.

---

## Prerequisites

Before beginning Task 4, confirm that all of the following are true:

- Task 1 is complete: the project directory exists, TypeScript strict mode is configured, path aliases including `@/lib/*` resolve correctly, and `eslint` and `prettier` are functional.
- Task 2 is complete: the Prisma schema is authored, `SystemConfig`, `User`, and all other models are defined, the `Role` enum contains `STAFF`, `ADMIN`, and `SUPERADMIN`, and `prisma generate` has been run successfully.
- Task 3 is complete: `lib/auth.ts` exports `auth`, `signIn`, `signOut`, and `handlers`; the JWT callback stores `role`, `id`, and `sessionInvalidatedAt` in the token; the session callback surfaces `id` and `role` on the session user object; and NextAuth is mounted at `app/api/auth/[...nextauth]/route.ts`.

Do not proceed with this task until all three prerequisites are confirmed, as `lib/auth-guard.ts` imports from `lib/auth.ts` and the middleware imports the `auth` wrapper from the same file.

---

## Task Scope

### In Scope

- Authoring `middleware.ts` at the project root with the correct NextAuth v5 integration pattern.
- Defining the matcher configuration for `/dashboard/:path*`, `/api/:path*`, and `/config`.
- Implementing the three distinct access-control rule sets for those three path groups.
- Documenting and implementing the environment variable approach for detecting database configuration status on the Edge.
- Authoring `lib/auth-guard.ts` with the `requireAuth` helper function and the role hierarchy logic.
- Creating stub dashboard pages for all seven dashboard routes and the dashboard layout.
- Creating stub API route handlers for all seven API resource paths.
- Writing integration tests for the middleware logic and for the `requireAuth` helper.

### Out of Scope

- The actual feature implementations for any dashboard page (Phase 2 and beyond).
- The actual feature implementations for any API route handler (Phases 2–5).
- The `/api/config/health` and `/api/config/connect` endpoint implementations (Task 5).
- The full sidebar and topbar UI components (Phase 2).
- Writing to the `NEXT_PUBLIC_DB_CONFIGURED` environment variable at runtime from an API handler (Task 5 triggers this, but this task only reads it).
- Any CSRF protection layer (handled by NextAuth).
- Rate limiting or IP-based blocking.

---

## Acceptance Criteria

1. `middleware.ts` exists at the project root and exports a named `middleware` function and a `config` object with a `matcher` array.
2. Unauthenticated requests to any path under `/dashboard/` are redirected to `/login` with a `callbackUrl` query parameter containing the originally requested path.
3. Unauthenticated requests to any path under `/api/` (excluding the public exceptions) receive a 401 JSON response with the body `{ "error": "Unauthorized" }`.
4. Requests to `/api/auth/` are not intercepted by the custom middleware — they pass directly to the NextAuth handler.
5. Requests to `/api/config/health` are not intercepted and do not require authentication.
6. When `NEXT_PUBLIC_DB_CONFIGURED` is absent or equals `"false"`, requests to `/config` pass through without any authentication check.
7. When `NEXT_PUBLIC_DB_CONFIGURED` equals `"true"` and a request to `/config` has no session, it is redirected to `/login`.
8. When `NEXT_PUBLIC_DB_CONFIGURED` equals `"true"` and the session role is `ADMIN`, the request to `/config` is redirected to `/dashboard`.
9. When `NEXT_PUBLIC_DB_CONFIGURED` equals `"true"` and the session role is `SUPERADMIN`, the request to `/config` is allowed through.
10. `lib/auth-guard.ts` exports a `requireAuth` async function that returns the session user object when authentication and role checks pass.
11. `requireAuth` returns a `NextResponse` with status 401 when no session is present.
12. `requireAuth` returns a `NextResponse` with status 403 when the session user's role is below the required minimum.
13. `SUPERADMIN` satisfies any minimum role requirement, including `ADMIN` and `STAFF`.
14. `ADMIN` satisfies `STAFF` minimum but does not satisfy `SUPERADMIN` minimum.
15. All seven stub dashboard pages exist and render the session user's name and role.
16. The dashboard `layout.tsx` exists and reads the session server-side.
17. All seven stub API route handlers exist, call `requireAuth`, and return a 200 JSON stub response if the caller is authenticated.
18. All integration tests in the test file pass.

---

## Implementation Guide

### Step 1: Understanding Edge Runtime Constraints

Next.js middleware runs on the Vercel Edge Runtime, which is a V8-based serverless environment that deliberately excludes the Node.js standard library. This is not a configuration choice — it is a hard architectural boundary enforced by the runtime. The implications for this task are significant.

Prisma Client establishes a TCP connection to the database using Node.js networking APIs. These APIs do not exist in the Edge Runtime. Attempting to import or instantiate the Prisma Client inside `middleware.ts` will cause a build error or a silent failure at runtime, depending on the version and configuration. The Prisma Client must never be imported in `middleware.ts`.

The `crypto` module from Node.js is also unavailable, as is the `fs` module and `bcrypt`. NextAuth v5 is fully Edge-compatible when configured correctly, and `auth()` from `lib/auth.ts` is safe to call in middleware as long as `lib/auth.ts` itself does not indirectly import Prisma at the module level. Confirm that the Prisma adapter in `lib/auth.ts` is imported in a way that does not cause the Prisma client to be bundled into the Edge chunk.

The practical consequence is that middleware can only make decisions based on the contents of the JWT cookie. The JWT is signed and verified using Web Crypto API, which is available in Edge. The session data stored in the JWT — specifically `id`, `role`, and `email` as set up in Task 3's JWT callback — is fully accessible via `request.auth` in the middleware callback. No database lookup is possible or necessary in the middleware for standard authenticated-user decisions.

The one case where this constraint becomes architecturally awkward is the `/config` path, which requires knowledge of whether the database has been initialised. This is addressed in Step 2.

When building the middleware, think of it as a pure function over JWT claims and environment variables. Any decision that requires a database query belongs in the API route handler layer, not middleware.

### Step 2: The /config Access Problem

The `/config` page exists for the initial application setup. During first-time deployment, no users exist in the database and no authentication is possible. The `/config` page must be completely open before any user has been created. Once the initial `SUPERADMIN` account is created through `/config`, the page must be locked down to `SUPERADMIN` only.

The problem is: how does middleware know whether the database has been configured? The obvious approach — query the `SystemConfig` collection via Prisma — is forbidden in the Edge Runtime. Two alternatives exist.

The first alternative is to call the `/api/config/health` endpoint from within middleware, using the `fetch` API (which is available in Edge). However, this introduces a synchronous HTTP request on every request to `/config`, adds latency, creates a circular dependency risk if the health endpoint itself is protected, and is fragile in development environments where the server may not be fully listening. This approach is not recommended.

The second alternative — and the one this task adopts — is a named environment variable, specifically `NEXT_PUBLIC_DB_CONFIGURED`. This variable starts absent or set to `"false"` in the `.env` file. When the `/config` initialisation flow completes successfully (Task 5), the API handler that processes the initialisation writes this value to the Vercel environment (via the Vercel API) and triggers a redeployment, after which the edge middleware picks up the updated value. In development, the value can be manually set in `.env.local` to `"true"` once the database is seeded, simulating the post-configuration state.

The environment variable is prefixed with `NEXT_PUBLIC_` so that it is embedded into the Edge bundle at build time. This means the check in middleware is a simple string comparison with no I/O, zero latency, and no dependencies. The trade-off is that the "lock" does not take effect until a redeployment occurs — there is a brief window between database configuration completion and the next deploy where the `/config` page could theoretically be re-accessed. This is an acceptable trade-off for a school management system, as the exploit window is narrow and requires knowing the URL.

In `middleware.ts`, read the environment variable using `process.env.NEXT_PUBLIC_DB_CONFIGURED`. Treat both the absent value (undefined) and the string `"false"` as meaning the database is not yet configured. Only the exact string `"true"` means configured. All other values default to "not configured" as a safe fallback.

### Step 3: Matcher Configuration Design

The `config` export from `middleware.ts` must include a `matcher` property that is an array of path patterns. Next.js uses these patterns to determine which requests should pass through the middleware function at all. Requests that do not match any pattern skip the middleware entirely, which is efficient for static assets.

The three primary path groups to match are: `/dashboard/:path*` (covering the root `/dashboard` page and all nested routes beneath it), `/api/:path*` (covering all API routes), and `/config` (an exact match for the configuration page).

Static asset paths, Next.js internal paths, and image optimization paths must be excluded. The standard exclusion technique is to add a negative lookahead as a regex pattern in the matcher array, or alternatively to add an early return in the middleware function body that calls `NextResponse.next()` for paths beginning with `/_next/` or `/favicon.ico`. The regex approach keeps the middleware function cleaner.

Two specific subpaths under `/api/` must be treated as public and excluded from the middleware's authentication enforcement:

The first is `/api/auth/` and all paths beneath it. NextAuth v5 registers its own handlers at `/api/auth/[...nextauth]`. If the custom middleware intercepts these routes and applies the session check, it will create a circular dependency: the session check calls NextAuth, but NextAuth's own routes are blocked by the session check. The safest approach is to exclude `/api/auth/` from the matcher entirely, so the middleware function never runs for those requests.

The second is `/api/config/health`. This is a lightweight status endpoint that the `/config` page calls to verify connectivity before any user account exists. It must remain completely public. It can be excluded from the matcher or handled with an early pass-through inside the middleware body. The latter approach is more maintainable because adding further public API exceptions in the future is a single-line change in one place.

When writing the exclusion for `/api/auth/`, prefer the matcher-level exclusion because it has zero runtime cost. When writing the exclusion for `/api/config/health`, prefer the middleware-body early return because it makes the exception explicit in the logic and is easier to document for future developers.

### Step 4: Middleware Logic for /dashboard/*

The rule for dashboard routes is straightforward: the user must be authenticated. Role-level enforcement for specific dashboard pages is handled at the page or layout level in the React component tree, not in this middleware.

When a request arrives for a path matching `/dashboard/:path*`, retrieve the session via `request.auth`. If `request.auth` is null or falsy, the user is unauthenticated and must be redirected to `/login`.

The redirect must include a `callbackUrl` query parameter. This is used by the login page to redirect the user back to their originally intended destination after successful sign-in. The value of `callbackUrl` is the full pathname and search string of the original request. The URL must be properly encoded before being appended as a query parameter value, because the original pathname may itself contain path segments or other characters that are syntactically significant in a query string context.

Construct the redirect URL by taking the string `/login`, appending `?callbackUrl=`, and appending the URL-encoded version of the request's pathname concatenated with the request's search string. Use the `encodeURIComponent` function, which is available in the Edge Runtime, to perform the encoding.

If `request.auth` is not null, call `NextResponse.next()` to allow the request to proceed. The middleware does nothing further for authenticated dashboard requests. Any page that needs to enforce a role minimum (for example, `/dashboard/backup` requiring `SUPERADMIN`) will do so within the server component itself by calling `auth()` and comparing the role.

### Step 5: Middleware Logic for /api/*

For API routes, the response for unauthenticated requests is a JSON body with an appropriate HTTP status code rather than a redirect. Browser-initiated navigations expect HTML redirects; programmatic API calls expect structured error responses.

When a request arrives for a path matching `/api/:path*`, first check whether it is one of the public exceptions. If the path starts with `/api/config/health`, call `NextResponse.next()` immediately and return. Similarly, although the matcher should already exclude `/api/auth/`, adding an guard here as a safety net is appropriate given the severity of accidentally breaking NextAuth callbacks.

After the public exception checks, retrieve the session from `request.auth`. If the session is null, construct and return a `NextResponse` with HTTP status 401. The response body must be valid JSON containing the key `error` with the value `"Unauthorized"`. Set the `Content-Type` header to `application/json`. Use `NextResponse.json()` rather than constructing a raw `Response`, because `NextResponse.json()` correctly sets headers and integrates with Next.js middleware response handling.

If the session is not null, call `NextResponse.next()`. The individual route handlers will perform any additional role-level enforcement required for their specific operation.

Note a subtle but important distinction: middleware here is performing authentication enforcement (is the caller identified?), not authorisation enforcement (is the caller permitted to do this specific thing?). Authorisation is the domain of the `requireAuth` helper described in Step 7 and the route handlers themselves.

### Step 6: Middleware Logic for /config

The `/config` path has the most complex rule of the three groups. The logic has three branches, evaluated in order.

The first branch checks the `NEXT_PUBLIC_DB_CONFIGURED` environment variable. Read the value from `process.env.NEXT_PUBLIC_DB_CONFIGURED`. If the value is not the string `"true"` (including if it is undefined, null, the string `"false"`, or any other value), the database is considered unconfigured. In this state, call `NextResponse.next()` immediately. No authentication is required. The `/config` page renders the initial setup form, which is the entire purpose of this state. Return immediately after this check so that the subsequent branches cannot accidentally enforce auth on an unconfigured system.

The second branch applies only when the database is configured (the env var is exactly `"true"`). Retrieve the session from `request.auth`. If the session is null, the user is unauthenticated. Redirect to `/login` with a `callbackUrl` pointing to `/config`, using the same encoding logic described in Step 4.

The third branch also applies only when the database is configured and a session exists. Inspect the session user's role, which is available at `request.auth.user.role` (based on the shape defined in Task 3's session callback). If the role is not `SUPERADMIN`, redirect to `/dashboard`. Do not include a `callbackUrl` in this redirect, because `/config` is an administrative destination and a non-superadmin user has no legitimate reason to be redirected back there after a role upgrade.

If the session role is `SUPERADMIN`, call `NextResponse.next()` and allow the request through.

These three evaluations form an exclusive decision tree: unconfigured state always wins, then unauthenticated state, then insufficient role, then full access granted.

### Step 7: lib/auth-guard.ts requireAuth Helper

The `requireAuth` function lives in `lib/auth-guard.ts` and runs in the full Node.js runtime as part of API route handler execution. It is not constrained by Edge Runtime limitations and can freely import from `lib/auth.ts` without concern.

The function signature accepts a single optional parameter representing the minimum required role. The parameter type is the `Role` enum imported from the Prisma client. When no parameter is provided, the function only checks that a valid session exists (any role is acceptable).

Inside the function, call `auth()` from `lib/auth.ts` to retrieve the current server-side session. This is the same `auth()` function used in server components and API routes. In the API route context, it reads the session cookie from the request context provided by Next.js.

If the result of `auth()` is null or if the user object within the session is missing, return a `NextResponse` constructed with status 401 and a JSON body containing `{ "error": "Unauthorized" }`. Do not throw an exception — return the `NextResponse` object. The calling route handler is responsible for detecting this return value and forwarding it as the response.

If a minimum role was specified, compare the user's current role against the required role using a privilege hierarchy array. Define this array as an ordered list containing the role enum values in ascending order of privilege: `STAFF` at index 0, `ADMIN` at index 1, `SUPERADMIN` at index 2. Retrieve the numeric index of the user's role and the numeric index of the required role from this array using `indexOf`. If the user's index is less than the required role's index, access is denied. Return a `NextResponse` with status 403 and JSON body `{ "error": "Forbidden" }`.

If all checks pass, return the session user object directly. The calling route handler receives this object and can use its `id`, `email`, `name`, and `role` properties without additional type casting, because the TypeScript types from Task 3's NextAuth configuration correctly type the session user.

The calling pattern in every route handler is: call `requireAuth`, check whether the return value is an instance of `NextResponse`, and if so return it from the handler immediately. If the return value is not a `NextResponse`, treat it as the typed session user and proceed with the handler's business logic. This two-line pattern is the same in every protected route handler across all five phases and must be understood clearly before building any feature route.

The reason this function returns a `NextResponse` rather than throwing an error is architectural: throwing from within a helper forces the route handler to wrap every call in a try-catch, and the error type must be a response shape that can be re-thrown and caught correctly. Returning allows the handler to use a simple conditional check, which is more readable, avoids exception overhead, and keeps error handling explicit rather than implicit.

### Step 8: Dashboard Layout Stub

Create `app/dashboard/layout.tsx` as a React Server Component. This file wraps all routes under `/dashboard/` and is the appropriate place for shared chrome such as the navigation sidebar and topbar.

In this stub, the layout calls `auth()` to retrieve the session server-side. This confirms that server-side session access works correctly in the layout context and provides the user's name and role for display. The stub renders a minimal but structurally valid page shell: a two-column layout with a left sidebar area and a main content area. The sidebar contains the text "Navigation — Phase 2" as a placeholder. The topbar shows the text "SchoolMS" as the application name and the authenticated user's name and role in a simple span.

The `children` prop is rendered inside the main content area. TypeScript typing for the layout props follows the Next.js 14 App Router convention: the props type includes a `children` property typed as `React.ReactNode`.

Do not import any UI component library components in this stub — use only plain HTML elements. This avoids layout dependency on any library that may not be installed yet, and the full component implementation will replace this stub entirely in Phase 2.

If `auth()` returns null (which should not occur given the middleware protection but must be handled defensively), the layout renders a message indicating the session could not be loaded rather than crashing. This defensive pattern is correct practice in server components.

### Step 9: Dashboard Page Stubs

Create stub `page.tsx` files for the following seven routes. Each file must be a server component that calls `auth()` and renders a minimal placeholder UI.

The routes and their stub heading text are: `/dashboard` (the root dashboard overview page, heading "Dashboard Overview — Phase 2"), `/dashboard/students` (heading "Students — Phase 2"), `/dashboard/marks` (heading "Marks Entry — Phase 3"), `/dashboard/reports` (heading "Reports — Phase 3"), `/dashboard/analytics` (heading "Analytics — Phase 4"), `/dashboard/backup` (heading "Backup — Phase 5"), and `/dashboard/settings` (heading "Settings — Phase 5").

Each page calls `auth()` and reads the session. Below the heading, it renders the authenticated user's name and role in a paragraph. This confirms that the session flows correctly from the middleware through the layout into individual pages.

For pages that will require elevated roles in later phases — specifically `/dashboard/analytics` (requires `ADMIN`), `/dashboard/backup` (requires `SUPERADMIN`), and `/dashboard/settings` (requires `ADMIN`) — add a server-side role check in the stub that redirects to `/dashboard` if the role is insufficient. Import `redirect` from `next/navigation` for this purpose. This establishes the pattern even though the page content is not yet implemented. Documenting the required minimum role with an inline comment clarifies the intent for Phase 2 and Phase 5 implementers.

Pages accessible to all authenticated roles — `/dashboard`, `/dashboard/students`, `/dashboard/marks`, `/dashboard/reports` — should not include role checks in the stub, as any authenticated user may view them.

### Step 10: API Route Stubs

Create stub `route.ts` files for the following seven API paths: `/api/students`, `/api/marks`, `/api/reports`, `/api/analytics`, `/api/users`, `/api/settings`, and `/api/backup`.

Each route file exports at minimum a `GET` handler. The handler first calls `requireAuth` from `lib/auth-guard.ts`. For routes requiring elevated roles, pass the appropriate minimum role to `requireAuth`: `ADMIN` for `/api/analytics`, `/api/users`, and `/api/settings`; `SUPERADMIN` for `/api/backup`; no role argument (any authenticated user) for `/api/students`, `/api/marks`, and `/api/reports`.

After calling `requireAuth`, the handler checks whether the return value is a `NextResponse` instance. If it is, the handler returns it immediately. If it is a user object, the handler proceeds to return a 200 JSON response. The stub response body contains two fields: `message` (a string indicating the route is not yet implemented and naming the phase that will build it) and `route` (the string path of the route, for diagnostic clarity).

Use `NextResponse.json()` with an explicit status of 200 to construct the response. This makes the success status explicit and consistent with the error responses that `requireAuth` returns.

For the `/api/backup` stub, also export a `POST` handler following the same pattern, since backup operations will use POST in Phase 5. The stub POST handler is identical to the GET handler in its authentication and response logic.

### Step 11: Integration Tests

The test file is placed at `lib/__tests__/middleware.test.ts`. The testing framework is Vitest (configured in Task 1). Tests mock the `auth` export from `lib/auth.ts` so that individual test cases can control the simulated session state without a running database or valid cookies.

For middleware tests, construct artificial `NextRequest` objects pointing to the URLs under test. After invoking the middleware function with the request, inspect the returned `NextResponse` for redirect headers or status codes.

The test suites, cases, and their expected outcomes are:

**Suite: /dashboard/ path protection**

Case 1 verifies that a request to `/dashboard` with no session results in a redirect response. The location header of the response must point to `/login` and must include a `callbackUrl` query parameter whose decoded value is `/dashboard`.

Case 2 verifies that a request to `/dashboard/students` with a valid `STAFF` session results in a pass-through (the response is the result of `NextResponse.next()`, not a redirect).

Case 3 verifies that the `callbackUrl` is correctly encoded when the original path contains a query string. For example, a request to `/dashboard?view=list` should produce a `callbackUrl` of `%2Fdashboard%3Fview%3Dlist` or equivalent valid encoding.

**Suite: /api/ path protection**

Case 4 verifies that a request to `/api/students` with no session returns a response with status 401 and a JSON body containing `{ "error": "Unauthorized" }`.

Case 5 verifies that a request to `/api/marks` with a valid `STAFF` session passes through.

Case 6 verifies that a request to `/api/auth/callback` does not match the matcher and therefore the middleware function is never called for it — or, if the matcher does include it, that the middleware explicitly passes it through.

Case 7 verifies that a request to `/api/config/health` passes through without any authentication check even when the session is null.

**Suite: /config path protection**

Case 8 verifies that when `NEXT_PUBLIC_DB_CONFIGURED` is undefined and the session is null, a request to `/config` passes through.

Case 9 verifies that when `NEXT_PUBLIC_DB_CONFIGURED` is `"false"` and the session is null, a request to `/config` passes through.

Case 10 verifies that when `NEXT_PUBLIC_DB_CONFIGURED` is `"true"` and the session is null, a request to `/config` redirects to `/login` with `callbackUrl=/config`.

Case 11 verifies that when `NEXT_PUBLIC_DB_CONFIGURED` is `"true"` and the session role is `ADMIN`, a request to `/config` redirects to `/dashboard`.

Case 12 verifies that when `NEXT_PUBLIC_DB_CONFIGURED` is `"true"` and the session role is `SUPERADMIN`, a request to `/config` passes through.

**Suite: requireAuth helper**

Case 13 verifies that when `auth()` returns null, `requireAuth()` returns a `NextResponse` with status 401.

Case 14 verifies that when the session role is `STAFF` and the required minimum is `ADMIN`, `requireAuth('ADMIN')` returns a `NextResponse` with status 403.

Case 15 verifies that when the session role is `ADMIN` and the required minimum is `ADMIN`, `requireAuth('ADMIN')` returns the session user object (not a `NextResponse`).

Case 16 verifies that when the session role is `SUPERADMIN` and the required minimum is `ADMIN`, `requireAuth('ADMIN')` returns the session user object (superadmin satisfies the admin requirement).

Case 17 verifies that when the session role is `SUPERADMIN` and no minimum role argument is provided, `requireAuth()` returns the session user object.

Case 18 verifies that when the session role is `STAFF` and no minimum role argument is provided, `requireAuth()` returns the session user object (any authenticated role satisfies a no-minimum call).

---

## Role Enforcement Reference Table

This table defines which enforcement layer is responsible for each category of route and access decision. It is the canonical reference for all subsequent phases.

| Route Category | Middleware Layer | Handler Layer (requireAuth) | UI Layer |
|---|---|---|---|
| `/dashboard/*` (all) | Authenticates (redirects if no session) | Not applicable (pages, not handlers) | Renders nav links based on role |
| `/dashboard/analytics` | Authenticates | N/A | Hides link for STAFF |
| `/dashboard/backup` | Authenticates | N/A | Hides link for non-SUPERADMIN |
| `/dashboard/settings` | Authenticates | N/A | Hides link for STAFF |
| `/api/*` (all) | Authenticates (401 if no session) | Authorises specific role per operation | N/A |
| `/api/students` GET | Authenticates | Minimum: STAFF | Shows/hides based on role |
| `/api/students` DELETE | Authenticates | Minimum: ADMIN | Hides delete button for STAFF |
| `/api/analytics/*` | Authenticates | Minimum: ADMIN | N/A |
| `/api/backup` | Authenticates | Minimum: SUPERADMIN | N/A |
| `/api/settings/*` | Authenticates | Minimum: ADMIN | N/A |
| `/config` (unconfigured) | Allows through (no auth check) | N/A | Full setup form shown |
| `/config` (configured) | Checks session + SUPERADMIN role | N/A | N/A |
| `/api/config/health` | Not intercepted (public) | No requireAuth call | N/A |

The UI layer is never treated as a security boundary. It exists solely to improve UX by not showing controls the user cannot use.

---

## Role Hierarchy Definition

Three roles exist, defined as an enum in the Prisma schema and mirrored in the TypeScript types generated by `prisma generate`. The roles in ascending order of privilege are:

- `STAFF`: The lowest privilege level. Can view students, enter marks, view marks, and generate reports. Cannot create or delete users, cannot access analytics, backup, or system settings.
- `ADMIN`: Mid-level privilege. Has all `STAFF` capabilities plus user management, student creation and deletion, analytics access, and settings access. Cannot access the `/config` page or backup functionality once the system is live.
- `SUPERADMIN`: Highest privilege level. Has all capabilities including `/config` access (post-initialisation), backup, and system audit logs. There is typically one `SUPERADMIN` per school deployment, created during initial configuration.

The privilege hierarchy comparison in `lib/auth-guard.ts` uses index-based comparison against the ordered array `[Role.STAFF, Role.ADMIN, Role.SUPERADMIN]`. A user whose role index is equal to or greater than the required role's index is granted access. This means `SUPERADMIN` always satisfies any role requirement, `ADMIN` satisfies `ADMIN` and `STAFF` requirements, and `STAFF` only satisfies `STAFF` requirements.

---

## Environment Variables Used

| Variable Name | Location | Runtime | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_DB_CONFIGURED` | `.env` / Vercel dashboard / `.env.local` | Edge (middleware) | Signals whether the database has been initialised through the `/config` flow |

This variable is prefixed with `NEXT_PUBLIC_` so that it is inlined into the Edge bundle at build time. This is required because Edge middleware cannot read server-only environment variables at request time — the runtime is not a full Node.js process with access to `process.env` populated server-side.

In a fresh repository checkout with no database configured, this variable should be absent from `.env` entirely, or explicitly set to `"false"`. The `.env.example` file should document this variable and its two meaningful values: `"false"` (default, unconfigured) and `"true"` (configured).

In local development after the database has been seeded manually, set `NEXT_PUBLIC_DB_CONFIGURED=true` in `.env.local` to simulate the post-configuration state and test the `/config` lock-down behaviour.

In Vercel deployments, Task 5's initialisation completion handler writes this value to the Vercel project environment via the Vercel API and triggers a redeployment. Until that redeployment completes, the edge middleware still sees the old value.

---

## File Inventory

The following files are created or modified by this task. All paths are relative to the project root.

| File Path | Action | Description |
|---|---|---|
| `middleware.ts` | Create | Root middleware with matcher config and three-branch access logic |
| `lib/auth-guard.ts` | Create | `requireAuth` helper with role hierarchy comparison |
| `lib/__tests__/middleware.test.ts` | Create | Integration tests for middleware and requireAuth |
| `app/dashboard/layout.tsx` | Create | Stub layout with session display and placeholder nav |
| `app/dashboard/page.tsx` | Create | Root dashboard overview stub |
| `app/dashboard/students/page.tsx` | Create | Students page stub |
| `app/dashboard/marks/page.tsx` | Create | Marks entry page stub |
| `app/dashboard/reports/page.tsx` | Create | Reports page stub |
| `app/dashboard/analytics/page.tsx` | Create | Analytics page stub with ADMIN role check |
| `app/dashboard/backup/page.tsx` | Create | Backup page stub with SUPERADMIN role check |
| `app/dashboard/settings/page.tsx` | Create | Settings page stub with ADMIN role check |
| `app/api/students/route.ts` | Create | Students API stub using requireAuth (STAFF minimum) |
| `app/api/marks/route.ts` | Create | Marks API stub using requireAuth (STAFF minimum) |
| `app/api/reports/route.ts` | Create | Reports API stub using requireAuth (STAFF minimum) |
| `app/api/analytics/route.ts` | Create | Analytics API stub using requireAuth (ADMIN minimum) |
| `app/api/users/route.ts` | Create | Users API stub using requireAuth (ADMIN minimum) |
| `app/api/settings/route.ts` | Create | Settings API stub using requireAuth (ADMIN minimum) |
| `app/api/backup/route.ts` | Create | Backup API stub using requireAuth (SUPERADMIN minimum) |
| `.env.example` | Modify | Add `NEXT_PUBLIC_DB_CONFIGURED` documentation entry |

---

## Integration Points

The following parts of this task are direct dependencies for later phases. They must not be renamed, moved, or have their interfaces changed without updating all dependent files.

**Phase 2 depends on:**
- `lib/auth-guard.ts` — the `requireAuth` function signature and return type. Every API route handler in Phase 2 follows the pattern established by the stubs in this task.
- `app/dashboard/layout.tsx` — Phase 2 replaces this stub with the full sidebar and topbar implementation. The file path and export remain the same.
- The role hierarchy array in `lib/auth-guard.ts` — Phase 2 adds additional role checks and must use the same comparison logic.

**Phase 3 depends on:**
- The stub API routes for `/api/marks` and `/api/reports`. Phase 3 replaces the stub GET handler with real implementations and adds POST/PUT handlers, all using `requireAuth`.

**Phase 4 depends on:**
- The stub API routes for `/api/analytics` and `/api/reports`. Phase 4 replaces the GET handler stubs with data aggregation logic.

**Phase 5 depends on:**
- The stub API route for `/api/backup`. Phase 5 replaces both the GET and POST stubs with actual backup logic.
- The `NEXT_PUBLIC_DB_CONFIGURED` environment variable. Task 5 (within Phase 1) is the writer; this task is the reader. Task 5 must not change the variable name.
- The `/config` middleware logic. Task 5's `/config` page depends on the middleware allowing unauthenticated access when the variable is absent.

---

## Common Pitfalls

**Importing Prisma in middleware**: Any direct or transitive import of `@prisma/client` or `lib/prisma.ts` in `middleware.ts` will cause a build or runtime failure in the Edge Runtime. If `lib/auth.ts` imports Prisma at module scope (rather than lazily inside a function), the auth export itself may pull Prisma into the middleware bundle. Verify the middleware bundle composition using `next build` with the `--debug` flag or by inspecting the `.next/server/edge-chunks` directory for unexpected Prisma-related content.

**Incorrect matcher regex excluding too little or too much**: A poorly constructed matcher regex can silently fail to protect routes or accidentally block public routes. After writing the matcher, manually test it against the following paths: `/dashboard`, `/dashboard/students/123`, `/api/students`, `/api/auth/callback/credentials`, `/api/config/health`, `/config`, `/_next/static/chunks/main.js`, and `/favicon.ico`. Only the first three should be intercepted by the full middleware logic.

**Missing /api/config/health public exception**: If this exception is omitted, the `/config` page cannot call the health endpoint to verify database connectivity before any user has authenticated. The result is that the initial setup page appears to have a network error even when the database is reachable.

**Using NextResponse vs Response in middleware**: In Next.js 14 App Router middleware, return values must be `NextResponse` instances, not plain `Response` objects. Using `new Response(JSON.stringify({...}), { status: 401 })` instead of `NextResponse.json({...}, { status: 401 })` may work in some environments but is not guaranteed to integrate correctly with Next.js middleware chaining. Always use `NextResponse`.

**callbackUrl encoding**: Passing the raw pathname as the `callbackUrl` value without URL-encoding it will break when the original URL contains query parameters, hashes, or non-ASCII characters. The `=` character in a query string value has special meaning and must be encoded as `%3D`. Use `encodeURIComponent` on the full `pathname + search` string before interpolating it into the redirect URL.

**SameSite cookie and cross-origin redirects**: NextAuth v5 sets the session cookie with `SameSite=Lax` by default. If the application is accessed through a domain that differs from where the cookie was set (for example, during local development with proxy configurations), the cookie may not be sent on redirected requests, causing a redirect loop. Ensure the development environment is accessed consistently via the same origin.

**requireAuth return value not checked**: Route handlers that call `requireAuth` but do not check whether the return value is a `NextResponse` will attempt to use the `NextResponse` as a user object, resulting in runtime errors. Every call to `requireAuth` must be followed by a type narrowing check. This discipline must be enforced in code review for all phases.

**Role hierarchy array mutability**: The privilege index array in `lib/auth-guard.ts` must be treated as immutable. If items are reordered or roles are added without updating all `requireAuth` calls throughout the codebase, access decisions will silently grant or deny access incorrectly. When a new role is added in a future phase, a full audit of all `requireAuth` call sites is required.

**Environment variable caching during development**: Next.js caches environment variables during development in ways that can cause the `NEXT_PUBLIC_DB_CONFIGURED` value to appear stale. After changing this value in `.env.local`, restart the Next.js development server completely (not just a hot reload) to ensure the new value is picked up in the Edge middleware simulation.
