# Phase 1 — Foundation and Infrastructure
## Task 3: NextAuth.js Authentication System

| Field | Value |
|---|---|
| Phase | 1 — Foundation and Infrastructure |
| Task Number | 3 |
| Title | NextAuth.js Authentication System |
| Estimated Complexity | High |
| Depends On | Task 1 (Project Scaffolding and Tooling), Task 2 (Prisma Schema and Database Layer) |

---

## Task Summary

This task establishes the complete authentication system for SchoolMS. It covers the full NextAuth.js v5 configuration in a single factory module, the App Router API handler, the login page and its interactive form component, the informational register page, the two-state password reset page, the forgot-password and reset-password API routes, the email delivery abstraction layer, TypeScript type augmentation for the session, and a suite of integration tests that verify every critical path. Authentication in SchoolMS is credential-based only — no OAuth providers — and uses a JWT session strategy with an eight-hour sliding window and a server-side invalidation mechanism tied to the User model's sessionInvalidatedAt field.

---

## Prerequisites

Before beginning this task, confirm that all of the following conditions are met:

- Task 1 is complete: the Next.js 14 App Router project exists with TypeScript 5.x strict mode enabled, ESLint and Prettier are configured, the shadcn/ui component library is installed, and the core folder structure is in place.
- Task 2 is complete: the Prisma schema is finalised and migrated, the User model includes the fields passwordHash, passwordResetToken, passwordResetExpiry, and sessionInvalidatedAt, and the Prisma singleton client is exported from lib/prisma.ts.
- The Role enum is defined in the Prisma schema with at least the values SUPERADMIN, ADMIN, and STAFF, and has been generated into the Prisma client.
- The following environment variables are present in .env.local: NEXTAUTH_SECRET (a long random string, minimum 32 characters), and NEXTAUTH_URL (the full base URL of the app, e.g. http://localhost:3000 in development).
- The packages next-auth (v5 beta), bcryptjs (or bcrypt with types), resend, nodemailer, and @types/nodemailer are installed.
- The packages zod and @types/bcryptjs are installed (zod should already be present from Task 2).

---

## Task Scope

### In Scope

- lib/auth.ts — the central NextAuth.js v5 factory configuration file
- app/api/auth/[...nextauth]/route.ts — the catch-all API route handler
- types/next-auth.d.ts — TypeScript declaration file that augments NextAuth session and JWT types
- app/(auth)/login/page.tsx — the login page Server Component
- components/auth/LoginForm.tsx — the login form Client Component
- app/(auth)/register/page.tsx — the register page (informational only)
- app/(auth)/reset-password/page.tsx — the two-mode password reset page
- components/auth/ForgotPasswordForm.tsx — the forgot password request form Client Component
- components/auth/ResetPasswordForm.tsx — the new password form Client Component
- lib/email.ts — the email send abstraction with Resend, SMTP, and console fallback
- app/api/auth/forgot-password/route.ts — POST handler for password reset token generation and email dispatch
- app/api/auth/reset-password/route.ts — POST handler for password update and session invalidation
- lib/__tests__/auth.integration.test.ts — integration tests for the authorize callback and both API routes

### Out of Scope

- Middleware and route protection (Task 4)
- Role-based access control enforcement beyond reading the role value from the session
- User creation, editing, or deletion (Phase 2)
- Profile management (Phase 2)
- Multi-factor authentication (not planned in current phases)
- OAuth or social login providers

---

## Acceptance Criteria

1. Navigating to /login renders a centred card form with email and password fields, a "Forgot Password?" link, and a submit button.
2. Submitting valid credentials signs the user in, creates a JWT session cookie, and redirects to /dashboard.
3. Submitting invalid credentials (wrong password or unknown email) displays "Invalid email or password" on the login page without a page reload to an error route.
4. The JWT token payload includes userId, email, name, and role after a successful sign-in.
5. The session object exposed to application code includes id, email, name, and role on the user property.
6. The session token cookie is httpOnly, secure (in production), sameSite strict, and expires after eight hours of inactivity with auto-refresh extending the window when fewer than two hours remain.
7. Changing a user's password or explicitly invalidating their session via sessionInvalidatedAt causes subsequent session checks to return null within one hour of the change.
8. Navigating to /register renders an informational message only — no registration form is present.
9. Submitting an email on the forgot password form always shows a confirmation message regardless of whether the email exists in the database.
10. The POST /api/auth/forgot-password route is rate-limited to three requests per IP per hour and returns 429 when exceeded.
11. The password reset token is stored in the database only as a bcrypt hash, never as plaintext.
12. The POST /api/auth/reset-password route validates the raw token against the stored hash, rejects expired tokens, updates the password, clears the reset fields, and sets sessionInvalidatedAt to the current timestamp.
13. After a successful password reset, the user is redirected to /login?passwordReset=success.
14. lib/email.ts selects Resend when RESEND_API_KEY is set, falls back to Nodemailer when SMTP_HOST is set, and logs to the server console (with a clear development warning) when neither is configured.
15. All seven integration tests pass with mocked Prisma and mocked email service.
16. TypeScript compiles without errors across the entire authentication system in strict mode.
17. The debug flag in the NextAuth configuration is true only in development and false in production.

---

## NextAuth.js v5 vs v4 Critical Differences

The implementation agent must fully internalise the following before writing any code. Applying v4 patterns to v5 will produce subtle or complete failures.

**Configuration factory pattern.** In v4, the NextAuth handler was created by calling NextAuth directly in the route file with a configuration object. In v5, the entire configuration lives in a standalone file (lib/auth.ts), and the file calls NextAuth() as a factory function. The factory returns a structured object with named exports: handlers, auth, signIn, and signOut. These named exports are used across the entire application. No configuration is written inside the route file.

**Route handler wiring.** The App Router catch-all file at app/api/auth/[...nextauth]/route.ts does nothing except re-export the GET and POST properties from the handlers object returned by the factory in lib/auth.ts. It contains no configuration logic.

**Session access function.** In v4, server-side session access used getServerSession() imported from next-auth/next. In v5 this function does not exist. Instead, the auth() function exported from lib/auth.ts is called directly in Server Components, route handlers, and middleware. The auth() call returns the current session or null.

**Middleware pattern.** In v4, middleware used withAuth from next-auth/middleware. In v5, the auth export from lib/auth.ts is used directly as a middleware wrapper or called inside a default middleware export. This is addressed fully in Task 4, but the auth export from lib/auth.ts must be designed with this in mind — it must be importable from middleware.ts without importing Node.js-only modules that break the Edge runtime.

**JWT and session callback type signatures.** The jwt callback in v5 receives a single parameter object with properties token, user, account, profile, and trigger. On first sign-in the user property is populated; on subsequent calls it is undefined. The session callback receives an object with properties session and token. The types for these have changed from v4 and the correct v5 types must be used.

**No pages directory configuration for route handlers.** The custom pages (signIn, error, signOut) are configured inside the NextAuth factory options, not as a separate Next.js pages/ folder integration. This is unchanged from v4 for the App Router, but the agent must ensure the pages option is set inside the NextAuth options object in lib/auth.ts.

**Authorize must never throw.** In v5, if the authorize function throws an error, NextAuth catches it and redirects the browser to the error page. The error page is /login (as configured in the pages option), but the redirect will include an error query parameter that shows a generic error, not "Invalid credentials". To show a clean "invalid credentials" message in the form, authorize must return null rather than throw.

---

## Implementation Guide

### Step 1: lib/auth.ts — NextAuth Factory Configuration

Create the file lib/auth.ts. This file is the single source of truth for authentication behaviour. It imports NextAuth from next-auth, CredentialsProvider from next-auth/providers/credentials, the Prisma client singleton from lib/prisma, bcrypt from bcryptjs, and zod for credential validation.

Call NextAuth() with a configuration object and store the result. Export the four named members — handlers, auth, signIn, signOut — as named exports from lib/auth.ts so the rest of the application can import them individually.

The configuration object must include the following top-level keys:

**providers.** An array with one entry: a CredentialsProvider. The credentials field defines two inputs — email (type email) and password (type password). The authorize async function is described in detail in the authorize callback section below.

**session.** Set the strategy to "jwt". No other session options are required at this level.

**secret.** Read NEXTAUTH_SECRET from process.env. This value is used to sign and verify JWT tokens and must never be hardcoded.

**pages.** An object with three keys: signIn set to "/login", error set to "/login" (so authentication errors redirect back to the login page with an error query parameter, not to a separate error page), and signOut set to "/" (redirects home after sign-out).

**cookies.** Override the default session token cookie settings. The sessionToken cookie should be configured with httpOnly true, secure set to a boolean based on whether NEXTAUTH_URL starts with "https://" (this pattern avoids breaking local development where HTTPS is not available), sameSite set to "strict", and maxAge set to 28800 (eight hours expressed in seconds). The name of the cookie should follow NextAuth v5 conventions — use the default name or the __Secure- prefixed variant when in production.

**callbacks.** An object containing jwt and session callbacks. These are detailed in Steps 2 and 3.

**debug.** Set to false when process.env.NODE_ENV is "production" and to true otherwise. The debug flag causes NextAuth to emit verbose logs. These logs can include token content and should never be active in a deployed environment.

### Step 2: JWT Callback Design

The jwt callback is invoked on every operation that touches the session: on initial sign-in, on page loads where session data is needed, and when the session is explicitly refreshed. The single parameter is a destructured object; the agent should destructure token, user, and trigger from it.

**First sign-in populating.** When trigger is "signIn" or when the user property is non-null and non-undefined, the authorization has just completed and the user object contains the sanitised user returned by authorize (id, email, name, role). At this point the callback must write the user's fields into the token: store user.id as token.userId (not token.id, to namespace it clearly), user.email as token.email, user.name as token.name, and user.role as token.role. Also record the current time plus 28800 seconds as token.exp to establish the initial expiry, and record the current Unix timestamp as token.iat for the issued-at reference. Store a lastVerified field on the token set to the current Unix timestamp — this is used for the periodic database check described below.

**Auto-refresh logic.** On every subsequent invocation, after verifying this is not the first sign-in, check whether the current time (Date.now() divided by 1000, floored to an integer) is greater than token.exp minus 7200. If so, add 28800 to the current time and store the result back on token.exp. This slides the session window forward whenever the user has been active within the last two hours of the current window, preventing abrupt sign-out for active users.

**Session invalidation check.** Once per hour, the callback should re-query the database to confirm the session is still valid. The mechanism is: if the current time minus token.lastVerified is greater than 3600 seconds, the callback performs a selective database query fetching only the sessionInvalidatedAt field for the user identified by token.userId. If no user is found, return an empty object (which NextAuth treats as an invalid session). If the user's sessionInvalidatedAt timestamp is more recent than token.iat, return an empty object. Otherwise update token.lastVerified to the current time and return the token normally. The database query uses the Prisma client with a select clause restricted to sessionInvalidatedAt only.

**Important edge case.** The jwt callback runs in the Next.js server runtime. In middleware (Task 4) it may run in the Edge runtime. The Prisma client uses Node.js APIs and cannot be called from the Edge runtime. The session invalidation database check in the jwt callback should therefore only run when the callback is invoked from a Node.js context, not from middleware. This can be managed by checking whether the Prisma client is available before attempting the call, or by deferring the invalidation check to the session callback. Document this constraint clearly in code comments.

**Return value.** Always return the token object (with any modifications). Return an empty plain object only to signal an invalid session.

### Step 3: Session Callback Design

The session callback takes a destructured parameter containing session and token. Its purpose is to project the JWT token data onto the session object that is exposed to the application through auth() calls and useSession() hooks.

The session.user object that NextAuth creates by default contains only name, email, and image. The callback must add the following to session.user: id (sourced from token.userId), and role (sourced from token.role, typed as the Role type imported from @prisma/client). The email and name values are already on session.user if NextAuth populated them from token.email and token.name, but the callback should ensure these are current by writing them from the token directly.

The callback must return the augmented session object. The TypeScript compiler will complain about these extra fields until the type augmentation in Step 4 is completed — implement Steps 3 and 4 together.

### Step 4: TypeScript Type Augmentation for NextAuth

NextAuth v5 is designed for module augmentation to extend its core types. Create the file types/next-auth.d.ts. This file does not export anything — it declares ambient type merges that affect the global NextAuth types throughout the project.

The file must use the declare module "next-auth" pattern to extend the Session interface. Inside the augmented Session interface, the user property should be re-declared to include the additional fields: id of type string, and role typed as the Role enum imported from @prisma/client.

It must also use the declare module "next-auth/jwt" pattern to extend the JWT interface with userId of type string and role typed as Role from @prisma/client.

These extensions allow the rest of the application to access session.user.id and session.user.role without TypeScript errors, and allow the jwt callback to assign to token.userId and token.role without casting.

Ensure that tsconfig.json includes the types directory (or that the types/next-auth.d.ts file is within the TypeScript project's include paths). If the tsconfig.json from Task 1 already includes a wildcard for the root, this file will be picked up automatically.

### Step 5: API Route Handler

Create the file app/api/auth/[...nextauth]/route.ts. This file has exactly two responsibilities: import the handlers object from lib/auth.ts, and re-export its GET and POST properties as named exports GET and POST. Next.js App Router will use these as the HTTP verb handlers for all requests to /api/auth/* paths.

No configuration, logic, or middleware belongs in this file. It is intentionally a thin adapter between Next.js's file-system routing and NextAuth's handler.

Verify that the dynamic segment folder is named exactly [...nextauth] (with the three dots, square brackets, and lowercase letters). Any deviation causes the catch-all routing to fail silently.

### Step 6: Login Page and Form Component

**Page component (app/(auth)/login/page.tsx).** This is a React Server Component. On load, it calls auth() from lib/auth.ts to retrieve the current session. If a valid session is returned, it calls redirect("/dashboard") from next/navigation — a signed-in user should not see the login page. If no session exists, it renders the card layout containing the LoginForm client component. The page component may also read a passwordReset query parameter from the page props' searchParams to display a success notification if the user arrived after resetting their password.

The page should set appropriate metadata (title: "Sign In — SchoolMS").

**LoginForm component (components/auth/LoginForm.tsx).** This is a Client Component (marked with "use client"). It manages four pieces of local state: email string, password string, isLoading boolean (initially false), and error string or null (initially null).

The form renders using shadcn/ui components: a Card wrapping a CardHeader and CardContent, Label and Input for the email field, Label and Input for the password field, a text link styled as a small anchor element below the password field pointing to /reset-password?mode=request with the label "Forgot Password?", and a Button for form submission that displays a loading spinner (from lucide-react or a custom spinner) alongside the text "Signing in…" during the loading state.

Client-side validation on submit: the email value must pass a basic format check (must contain @ and a dot after it), and the password must be non-empty. If either check fails, set the error state to a descriptive field-level message and return without calling signIn.

When client-side validation passes: set isLoading to true, then call signIn from next-auth/react with "credentials" as the first argument, an object containing email and password as the second argument, and an options object as the third argument specifying redirect: false so that NextAuth does not perform a hard redirect and instead returns a result object. Inspect the result object: if result.error is present, map it to a user-friendly string — the specific error code "CredentialsSignin" maps to "Invalid email or password", and any other non-null error code maps to "An unexpected error occurred. Please try again." Set the error state accordingly. Set isLoading to false. If result.ok is true and result.error is null, perform a client-side navigation call to result.url or to /dashboard as a fallback using the router from next/navigation.

The error state value is rendered in a div below the submit button using a visually distinct style (destructive colour variant, small text). When error is null, this div should still be present in the DOM but empty so the layout does not shift on error appearance.

### Step 7: Register Page

Create app/(auth)/register/page.tsx. This is a React Server Component.

The page renders a centred card with the SchoolMS name, a heading such as "Account Registration", and a body paragraph clearly explaining that SchoolMS does not support self-registration. Accounts are created and activated by system administrators. Users who need access should contact their school's system administrator.

Optionally include a link back to /login with the label "Return to Sign In".

There is no form, no client component, no database interaction, and no state in this page. The page is intentionally a placeholder for potential future use if role-scoped self-registration is added in later phases.

### Step 8: lib/email.ts — Email Abstraction

Create lib/email.ts. This module exports a single async function, sendEmail, which abstracts the email delivery mechanism so that calling code does not need to know which provider is active. The function accepts a single plain object parameter with four string fields: to (recipient address), subject (email subject line), html (HTML body of the email), and text (plain text fallback body).

**Resend path.** If process.env.RESEND_API_KEY is a non-empty string, instantiate the Resend client using that key and call its send method with the from address, to, subject, html, and text fields. The from address should be read from an optional RESEND_FROM_ADDRESS environment variable, falling back to "SchoolMS noreply@schoolms.example.com". Await the call and return.

**SMTP Nodemailer path.** If RESEND_API_KEY is absent or empty but process.env.SMTP_HOST is a non-empty string, create a Nodemailer transport using createTransport with an SMTP configuration object. The configuration reads SMTP_HOST, SMTP_PORT (defaulting to 587), SMTP_USER, and SMTP_PASS from environment variables. The auth field is only included if SMTP_USER is present. Call transport.sendMail with from, to, subject, html, and text. Await the call and return.

**Console fallback.** If neither provider is configured, emit a console.warn with a clearly labelled development warning explaining that no email provider is configured and the reset link follows. Then log the text body of the email to the console. This path must only exist for development convenience — production deployments must have at least one provider configured. The function should not throw in this path.

### Step 9: Forgot Password Page and API Route

**Forgot password page (app/(auth)/reset-password/page.tsx — request mode).** The reset-password page is a two-mode page controlled by the mode query parameter. When mode is "request" (or absent), the page renders the ForgotPasswordForm client component inside a card layout. The card heading should read "Reset Your Password" and include a brief instruction asking the user to enter their email address to receive a reset link.

**ForgotPasswordForm (components/auth/ForgotPasswordForm.tsx).** A Client Component managing email string state, isLoading boolean, and a submitted boolean that tracks whether the form has been successfully submitted. On submit, it sends a POST request to /api/auth/forgot-password with the email in a JSON body. Regardless of the API response status (200 or otherwise), set submitted to true after the request completes. When submitted is true, render only a confirmation paragraph: "If an account exists for [email], a password reset link has been sent. Please check your inbox." This fixed message prevents user enumeration — the user sees the same response whether or not the email was found.

**POST /api/auth/forgot-password (app/api/auth/forgot-password/route.ts).** This is a Next.js App Router route handler exporting async function POST.

Step-by-step logic: First, apply rate limiting. Read the IP address from the request headers (x-forwarded-for header in production, falling back to a default). Use an in-memory Map keyed by IP address storing an array of request timestamps. Evict timestamps older than one hour. If the count of remaining timestamps is three or more, return a NextResponse with status 429 and a JSON body indicating rate limit exceeded. Otherwise add the current timestamp and continue. Note: in-memory rate limiting is acceptable for Phase 1 but must be replaced with a Redis-backed solution in a production deployment (document this in a code comment).

Parse the request body as JSON and validate the email field with a Zod schema requiring a valid email string. Return 400 with a validation error body if the check fails.

Query the Prisma client for a User where email matches the submitted email, selecting only id, email, name, and passwordResetExpiry. If no user is found, return 200 immediately with a generic success message — do not return 404.

Generate the raw reset token: call crypto.randomBytes(32) from the Node.js built-in crypto module and convert the result to a hex string, producing a 64-character lowercase hexadecimal string. This raw token will be included in the reset URL — it is never stored in the database.

Hash the raw token with bcrypt at cost factor 10. Store the resulting hash as the User's passwordResetToken field and set passwordResetExpiry to the Date one hour from now. Perform a single Prisma update call to write both fields atomically.

Construct the reset URL by concatenating NEXTAUTH_URL, the path /reset-password, and query parameters: mode=reset, token=[rawToken], email=[encodeURIComponent(email)].

Call sendEmail from lib/email.ts with the to address, a subject of "Reset your SchoolMS password", and an HTML body containing a clear heading, a sentence explaining the link expires in one hour, and the reset URL as a clickable link. Also include a plain text body with the reset URL.

Return 200 with a generic success JSON body.

### Step 10: Reset Password Page and API Route

**Reset password page (app/(auth)/reset-password/page.tsx — reset mode).** When the mode query parameter is "reset", the Server Component reads token and email from the URL query parameters. It must validate these parameters server-side before rendering anything sensitive. Call the validation logic — this can be an internal server function or a direct Prisma query — to fetch the User by email and check that passwordResetExpiry is in the future and that a passwordResetToken exists. If the token is expired, missing, or the email is not found, render an error state with the message "This password reset link has expired or is invalid. Request a new one." alongside a link to /reset-password?mode=request.

If the validation passes (user found, expiry is in the future, token field is non-null), render the ResetPasswordForm client component, passing the token and email values as props.

**ResetPasswordForm (components/auth/ResetPasswordForm.tsx).** A Client Component receiving token and email as props. It manages two string state fields (newPassword and confirmPassword), an isLoading boolean, and an error string or null. On submit: validate client-side that newPassword is at least 8 characters and that confirmPassword matches exactly. If validation fails, set the error message. If validation passes, send a POST request to /api/auth/reset-password with a JSON body containing token, email, newPassword, and confirmPassword. On a 200 response, navigate the user to /login?passwordReset=success. On any other response, set the error state to the message from the response body or to a generic failure message.

**POST /api/auth/reset-password (app/api/auth/reset-password/route.ts).** This is a Next.js App Router route handler exporting async function POST.

Step-by-step logic: Parse and validate the request body with a Zod schema requiring token (non-empty string), email (valid email), newPassword (string, minimum 8 characters), and confirmPassword (string). Return 400 if Zod validation fails.

Confirm that newPassword and confirmPassword are identical. Return 400 with "Passwords do not match" if they differ (this is a server-side guard in addition to the client-side check).

Query the Prisma client for the User by email, selecting id, passwordResetToken, passwordResetExpiry, and passwordHash. Return 400 if no user is found.

Check that passwordResetExpiry is a Date in the future (compare to new Date()). If expired, return 400 with "This reset link has expired."

Run bcrypt.compare using the raw token from the request body against the stored passwordResetToken hash. If the comparison returns false, return 400 with "Invalid or expired reset link."

Hash newPassword with bcrypt at 12 rounds. Perform a single Prisma update call on the User to: set passwordHash to the new hash, set passwordResetToken to null, set passwordResetExpiry to null, and set sessionInvalidatedAt to new Date(). This last field is the mechanism that causes any currently active sessions for this user to be invalidated on their next hour-boundary check in the JWT callback.

Return 200 with a success JSON body.

### Step 11: Integration Tests

Create lib/__tests__/auth.integration.test.ts. Use Vitest as the test runner (configured in Task 1). Mock the Prisma module at @/lib/prisma using vi.mock so that no real database connections are made. Mock bcryptjs using vi.mock. Mock lib/email.ts so no real emails are sent.

**Test 1 — authorize: valid credentials.** Configure the Prisma mock so that user.findUnique returns a user object with id, email, name, role, passwordHash set to a bcrypt hash, and sessionInvalidatedAt set to null. Configure the bcrypt mock so that compare returns true. Call the authorize function extracted from the CredentialsProvider configuration. Assert that the returned value is an object with the correct id, email, name, and role. Assert that no extra fields (such as passwordHash) are present on the returned object.

**Test 2 — authorize: wrong password.** Use the same Prisma mock returning a valid user, but configure bcrypt.compare to return false. Assert that authorize returns null.

**Test 3 — authorize: unknown email.** Configure Prisma to return null for user.findUnique. Assert that authorize returns null. Assert that bcrypt.compare was never called.

**Test 4 — authorize: Zod validation failure.** Call authorize with a malformed email string (e.g. "not-an-email"). Assert that authorize returns null. Assert that Prisma was never queried.

**Test 5 — forgot-password route: email sent.** Import the POST handler from app/api/auth/forgot-password/route.ts. Construct a mocked NextRequest with a valid JSON body containing a known email address. Configure Prisma to return a matching user. Mock crypto.randomBytes to return a deterministic buffer. Mock bcrypt.hash to return a deterministic string. Call POST with the mocked request. Assert that the Prisma update was called with a passwordResetToken and a passwordResetExpiry in the future. Assert that sendEmail was called with the correct to address and a subject containing "password".

**Test 6 — reset-password route: valid token.** Import the POST handler from app/api/auth/reset-password/route.ts. Configure Prisma user.findUnique to return a user with a non-expired passwordResetExpiry and a populated passwordResetToken hash. Configure bcrypt.compare to return true. Configure bcrypt.hash to return a new hash. Call POST with a valid body. Assert that Prisma update was called with the new passwordHash, null passwordResetToken, null passwordResetExpiry, and a sessionInvalidatedAt value that is a Date.

**Test 7 — reset-password route: expired token.** Configure the user mock with a passwordResetExpiry that is one hour in the past. Call POST. Assert the response status is 400. Assert the response body contains a message about expiry. Assert that Prisma update was never called.

---

## Security Requirements Summary

| Requirement | Implementation Detail |
|---|---|
| Password hashing | bcrypt with 12 rounds for user passwords; 10 rounds for reset tokens (tokens are long-entropy random strings) |
| Reset token storage | The raw token is never stored in the database; only the bcrypt hash is persisted in passwordResetToken |
| User enumeration prevention | The forgot-password route returns 200 whether or not the email exists; the confirmation message is identical in both cases |
| Session invalidation | The sessionInvalidatedAt field is updated on password change; the JWT callback re-checks the database once per hour and returns an empty token if the field is more recent than token.iat |
| Secure cookies | The session cookie is httpOnly by default; the secure flag is derived from NEXTAUTH_URL protocol so that http://localhost works in development while production requires HTTPS |
| Debug mode | The debug flag in NextAuth configuration is only true in development; it must be false in production to prevent token data appearing in logs |
| Rate limiting | The forgot-password route is limited to three requests per IP per hour; the current in-memory implementation must be replaced with a persistent store before production deployment |
| Authorize error handling | The authorize function must return null on all failure paths and must never throw; throwing causes a redirect to the error page instead of showing a form-level error message |

---

## Environment Variables Used in This Task

| Variable | Required / Optional | Purpose |
|---|---|---|
| NEXTAUTH_SECRET | Required | Signs and verifies JWT session tokens; must be a high-entropy random string |
| NEXTAUTH_URL | Required | Base URL of the application; used to build reset links and determine secure cookie setting |
| RESEND_API_KEY | Optional | Enables the Resend email provider; if absent, falls back to SMTP |
| RESEND_FROM_ADDRESS | Optional | Overrides the default sender address for Resend emails |
| SMTP_HOST | Optional | Hostname of the SMTP server; enables Nodemailer fallback if RESEND_API_KEY is absent |
| SMTP_PORT | Optional | Port for SMTP connection; defaults to 587 |
| SMTP_USER | Optional | Username for SMTP authentication |
| SMTP_PASS | Optional | Password for SMTP authentication |

---

## File Inventory

The following files are created or modified by this task:

| File Path | Type | Description |
|---|---|---|
| lib/auth.ts | New | NextAuth.js v5 factory configuration, exports handlers, auth, signIn, signOut |
| app/api/auth/[...nextauth]/route.ts | New | Thin adapter re-exporting GET and POST from lib/auth.ts handlers |
| types/next-auth.d.ts | New | Module augmentation adding id and role to Session.user and JWT |
| app/(auth)/login/page.tsx | New | Login page Server Component; redirects signed-in users |
| components/auth/LoginForm.tsx | New | Login form Client Component with state, validation, and signIn call |
| app/(auth)/register/page.tsx | New | Informational register page; no form or database interaction |
| app/(auth)/reset-password/page.tsx | New | Two-mode reset password page (request mode and reset mode) |
| components/auth/ForgotPasswordForm.tsx | New | Forgot password email input form Client Component |
| components/auth/ResetPasswordForm.tsx | New | New password entry form Client Component; receives token and email as props |
| lib/email.ts | New | Email send abstraction: Resend → SMTP Nodemailer → console fallback |
| app/api/auth/forgot-password/route.ts | New | POST handler: rate limiting, token generation, database update, email dispatch |
| app/api/auth/reset-password/route.ts | New | POST handler: token validation, password update, session invalidation |
| lib/__tests__/auth.integration.test.ts | New | Seven integration tests with mocked Prisma, bcrypt, and email |

---

## Integration Points

The following elements from this task are consumed by subsequent work:

**Task 4 (Middleware and Route Protection)** depends on the auth export from lib/auth.ts being importable in middleware.ts. The middleware wraps the auth function to check session existence and role before allowing access to protected routes. The session object shape — specifically session.user.role — must be stable by the end of this task.

**Phase 2 (Core Dashboard and Student Management)** depends on session.user.id being available to identify the currently authenticated user for audit logs and ownership checks, and session.user.role being available to gate admin-only sections of the dashboard.

**All Server Components and API routes** in future phases rely on calling auth() from lib/auth.ts to retrieve the session. Any change to what auth() returns would be a breaking change.

**Password reset invalidation** relies on the sessionInvalidatedAt field on the User model (defined in Task 2). Any rename or type change to that field in the Prisma schema would require updating the JWT callback's invalidation check.

---

## Common Pitfalls

**Mixing v4 and v5 import paths.** NextAuth v5 changes several import locations. Importing getServerSession from next-auth/next, withAuth from next-auth/middleware, or SessionProvider from next-auth/react without verifying they exist in v5 will cause build errors. Always verify against the installed v5 beta API surface.

**Secure cookie failing on localhost.** If NEXTAUTH_URL is set to an https:// URL during local development, the session cookie will be marked secure and will not be sent over plain HTTP. Set NEXTAUTH_URL to http://localhost:3000 in .env.local to avoid silent authentication failures.

**Authorize throwing instead of returning null.** If the authorize function throws — even in an inner async call that is not caught — NextAuth catches the exception and redirects the user to the error page (/login with ?error= query param). The user sees a confusing error URL rather than an inline form error. Wrap the entire authorize body in a try-catch and return null from every catch path.

**JWT callback running in Edge runtime.** The middleware in Task 4 uses NextAuth's auth() function, which may invoke the jwt callback in the Edge runtime. Prisma Client relies on Node.js built-ins (fs, net, tls) that are not available in the Edge runtime. The database query in the session invalidation check must be guarded so it only runs in a Node.js context. One safe pattern is to check for the availability of the process object and the prisma instance before attempting the query.

**Debug mode leaking token data.** Setting debug: true in production causes NextAuth to log the JWT token object — which contains the user's id, email, and role — to standard output. In a hosted environment this output typically flows to a log aggregator accessible to multiple team members. Always ensure debug is conditional on NODE_ENV.

**bcrypt async import issues.** bcryptjs is a pure JavaScript implementation and is safe to import anywhere. The native bcrypt package uses a compiled binary addons and may have issues in certain deployment targets. Confirm the package import works in the development environment before relying on it. Use the async bcrypt.compare and bcrypt.hash functions (not the sync variants) to avoid blocking the event loop.

**Overlapping route group and dynamic segment names.** The (auth) route group is a layout group only — it does not appear in the URL. The reset-password path is /reset-password, not /(auth)/reset-password. Verify by running the dev server and navigating to the expected URLs.

**In-memory rate limiting does not survive server restarts.** The Map-based rate limiter in the forgot-password route is reset every time the Node.js process restarts (including hot reloads in development). This is acceptable for Phase 1 but must be flagged in code comments as requiring a persistent store (such as Upstash Redis) before production deployment.
