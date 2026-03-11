# Task 5.4 — Testing Suite and CI/CD Pipeline

**Phase:** 5 — Backup, Security Hardening, and Testing
**Task Number:** 5.4 of 4
**Complexity:** High
**Depends On:** All Tasks 5.1–5.3 complete. All Phases 1–4 complete. Staging environment deployed on Vercel with a seeded test MongoDB Atlas database.

---

## Objective

Implement the four-level testing strategy — unit, integration, component, and end-to-end — covering all critical logic paths and user journeys across the SchoolMS application. Set up the GitHub Actions CI/CD pipeline to automate pull request validation and trigger production deployment on merge to the main branch, ensuring every code change is verified before it reaches users.

---

## Deliverables

- vitest.config.ts with separate unit and integration project definitions
- __tests__/unit directory containing all unit test files for pure utility functions
- __tests__/integration directory containing all integration test files for route handlers with mocked Prisma
- playwright.config.ts targeting the Vercel staging environment
- e2e/ directory containing all five end-to-end Playwright spec files
- __tests__/components directory containing all React Testing Library component test files
- .github/workflows/pr-validation.yml for automated pull request checks
- .github/workflows/deploy-production.yml for production deployment on main branch push

---

## Context and Background

The project uses Vitest as the primary test runner for unit and integration tests. Vitest was chosen over Jest because it executes ES modules natively without transformation overhead, has first-class TypeScript support, and integrates with Vite's module resolution. This is significant for a Next.js App Router project where many modules use top-level imports and modern syntax that Jest requires additional configuration to handle.

Playwright covers critical user journeys by running against the live Vercel staging environment. This means the tests exercise real network calls, real authentication flows, and real database reads, catching regressions that pure unit tests cannot surface. Playwright's browser automation targets Chromium for the primary test run, with screenshots captured on any test failure to assist debugging.

React Testing Library is used specifically for component-level tests. These tests render components in a simulated DOM environment using jsdom, exercise user interactions such as input changes and button clicks, and verify visible output. They do not make network calls and do not depend on the staging environment, giving rapid feedback on UI logic regressions during local development.

The GitHub Actions pipeline ties all four layers together. On every pull request, the workflow runs type checking, linting, and the Vitest unit and integration suites. On merge to main, the same checks run and a Vercel production deployment is triggered automatically. Preview deployments for open pull requests are handled by the Vercel GitHub integration without requiring manual workflow configuration.

---

## Unit Test Setup and Coverage

### Vitest Configuration

The vitest.config.ts file defines two distinct test projects using Vitest's workspace-style project configuration within a single config file. The first project is named "unit" and targets all files matching the __tests__/unit/** glob. It uses the v8 coverage provider and explicitly excludes any source files that import from Prisma Client or NextAuth, ensuring that unit tests remain completely isolated from external service dependencies. The second project is named "integration" and targets all files matching the __tests__/integration/** glob. This project includes a setup file that initialises the Prisma mock before any test in the suite runs. Both projects share the same coverage output directory so that a combined coverage report can be generated after running both suites.

### W-Rule Utility Tests

These tests live in __tests__/unit/w-rule.test.ts and exercise the W-rule utility functions with a comprehensive set of inputs. The applyWRule function is tested with an input of 34, which should return the string "W"; with 35, which should return the string "35"; with 100, which should return "100"; with 0, which should return "W"; with a null input, which should return the designated not-applicable placeholder "—"; with an undefined input, which should also return "—"; and with a negative integer, which should return "W". The isWMark function is tested against the same set of inputs, verifying that it returns the correct boolean for each case. The getWSubjects function is tested with a marks object containing a mixture of subjects — some with marks below 35 and some at or above 35 — and the test asserts that the returned array contains exactly the subject names that fall below the threshold and no others.

### Backup Serialisation Tests

These tests live in __tests__/unit/backup-serialisation.test.ts and verify the logic that constructs the backup payload before it is uploaded to object storage. One test provides a known set of input values for schoolName and individual collection counts, and asserts that the resulting meta object contains all the expected fields with correct values. A second test verifies that the fully assembled backup object always contains exactly the five required top-level collection keys — students, users, markRecords, systemConfig, auditLogs — plus the meta key, and no additional keys. A third test provides an empty array for markRecords and verifies that the serialiser handles zero-length arrays without error and includes them in the output. A fourth test constructs a student object that contains a JavaScript Date instance in a date-of-birth field and verifies that after serialisation the field is represented as an ISO 8601 string rather than a Date object, confirming the payload is safe for JSON encoding.

### Date Formatting Utility Tests

These tests live in __tests__/unit/date-utils.test.ts. The first test constructs a known UTC Date value and passes it to the school timezone formatter, asserting that the output string matches the expected date representation in the school's configured timezone. The second test passes null to the formatter and asserts that the output is either an empty string or the designated fallback string, with no thrown exception. The third test passes a Date value that is exactly three days in the past relative to the fixed test date and asserts that the relative-time label function returns a human-readable string containing the appropriate word for days elapsed.

### Analytics Aggregation Function Tests

These tests live in __tests__/unit/analytics-aggregation.test.ts. The subject average test provides a known array of mark records with defined numeric values and asserts that the computed average exactly matches the expected result calculated by hand. The grade distribution test provides five specific mark values — 28, 42, 67, 81, and 100 — and asserts that the bucketing function places each value into the correct predefined band, with each band having a count of exactly one. The top-five extraction test provides a sorted list of ten students by aggregate score and asserts that only the top five entries are returned in the correct order. The null-mark edge case test provides an array where all mark values are null and asserts that the function returns a null average and a total count of zero, with no thrown exception.

---

## Integration Test Setup and Coverage

### Prisma Mock Configuration

The integration project uses vitest-mock-extended to generate a deep mock of the PrismaClient type. The project-level setup file creates a module-level prismaMock constant and uses a beforeEach hook to call mockReset on the mock instance before each test, preventing any mock return values configured in one test from leaking into the next. The application module that exports the Prisma client singleton is aliased in the Vitest config so that when any route handler under test imports it, they receive the mock instance instead of the real client. All route tests import prismaMock and call mockResolvedValue or mockRejectedValue to control behaviour for each specific case.

### Auth Middleware Tests

These tests live in __tests__/integration/middleware.test.ts. The first test sends an unauthenticated request to /dashboard/students and asserts that the middleware returns a redirect response pointing to /login. The second test sends a request with a mocked valid STAFF session to a route that is accessible to STAFF users and asserts that the middleware allows the request through with a 200 status. The third test sends a request with a STAFF session to a route that requires ADMIN role and asserts that the middleware returns a redirect rather than forwarding the request. The fourth test sends a GET request to /api/backup without the CRON_SECRET header and asserts a 401 response, then sends the same request with the correct CRON_SECRET value and asserts that the request proceeds past the authentication gate.

### Mark Batch Save Route Tests

These tests live in __tests__/integration/marks-api.test.ts. The valid batch test sends a POST request to /api/marks/batch with a well-formed array of five mark entries, mocks prismaMock.markRecord.upsert to resolve successfully, and asserts that the upsert method was called exactly five times. The out-of-range test sends the same POST but includes two entries with mark values below zero and above one hundred respectively, and asserts that the handler returns a 400 response without calling upsert for those entries. The empty array test sends a POST with an empty entries array and asserts that the handler returns a 400 response.

### Student CRUD Route Tests

These tests live in __tests__/integration/students-api.test.ts. The create test sends a POST with all required student fields, mocks both prismaMock.student.create and prismaMock.auditLog.create, and asserts that student.create was called with the correct shape of data and that auditLog.create was called exactly once. The list test mocks prismaMock.student.findMany to return an array of records where one has isDeleted set to true, sends a GET request with includeDeleted set to false, and asserts that only the non-deleted records appear in the response body. The soft-delete test sends a DELETE request for a known student ID, mocks student.update, and asserts that student.update was called with the isDeleted flag set to true while student.delete was never called.

### Backup Route Tests

These tests live in __tests__/integration/backup-api.test.ts. The success test mocks all five prismaMock findMany calls to return representative arrays, mocks the object storage upload function to resolve, sends a POST with a valid SUPERADMIN session, and asserts that all five findMany calls were made and that systemConfig.update was called to record the backup timestamp. The failure test mocks the storage upload to throw an error, sends the same POST, and asserts that auditLog.create was called to record the failure and that the Resend email client's send method was called to dispatch the admin alert.

---

## Playwright End-to-End Tests

### Environment Setup

The playwright.config.ts reads the staging environment URL from the STAGING_URL environment variable and sets it as the baseURL for all tests. Tests run on the Chromium browser project. Screenshot capture is set to fire on test failure only. A global setup file performs a one-time login for each role used across the test suite — STAFF, ADMIN, and SUPERADMIN — and saves the resulting browser storage state to disk. Each spec file references the appropriate stored session so that authentication does not need to repeat for every test case. A timeout of 30 seconds is set per test action to accommodate network latency against the remote staging environment.

### Journey 1 — Staff Mark Entry

The test file is e2e/mark-entry.spec.ts. The test loads the stored STAFF session and navigates to the Mark Entry page. It selects a class group and subject from the filter controls and verifies that the student rows render within the grid. It enters mark values for at least five student rows, deliberately entering a value below 35 for one student. It clicks the Save button and waits for the success toast notification to appear. It then navigates to the View Marks page for the same class group and subject and asserts that the saved values are displayed. It further asserts that the student whose mark was below 35 has the W indicator displayed in the relevant cell.

### Journey 2 — Admin Student and Report Workflow

The test file is e2e/student-report.spec.ts. The test loads the stored ADMIN session and navigates to the Add Student form. It fills in all required fields with deterministic test values including a unique index number prefixed with "E2E-" to avoid collisions with real records. It submits the form and asserts that the new student row appears in the student list. It navigates to Mark Entry, selects the class group matching the new student, and enters marks for the student across a subject. It navigates to the Progress Reports page, locates the test student, and clicks Generate PDF. It listens for a download event and asserts that the download occurs and that the filename contains the student's index number.

### Journey 3 — Superadmin Backup Workflow

The test file is e2e/backup.spec.ts. The test loads the stored SUPERADMIN session and navigates to /dashboard/backup. It asserts that the status banner component is visible in the DOM. It clicks the Back Up Now button and waits for the loading indicator to disappear, polling with a timeout sufficient for the backup API call to complete. It asserts that a success toast appears. It reads the first row of the backup history table and asserts that the date shown matches today's date. It clicks the Download link on that row, listens for a download event, and asserts that the file download is triggered.

### Journey 4 — Analytics Charts Rendering

The test file is e2e/analytics.spec.ts. The test loads the stored ADMIN session and navigates to /dashboard/analytics. It queries the DOM for the six expected chart container elements using their data-testid attributes. For each container, it asserts that the element is visible and that its bounding box height is greater than zero, confirming that the chart has rendered content rather than collapsing to zero height. It then interacts with the Grade filter dropdown, changing its selected value, and asserts that the page does not display any error boundary fallback or JavaScript error overlay after the filter change.

### Journey 5 — Preview Mode Full Cycle

The test file is e2e/preview-mode.spec.ts. The test loads the stored ADMIN session and navigates to a student profile page for a pre-seeded student who has mark data across at least two terms. It clicks the Preview Mode button and waits for a new browser tab to open. It switches the Playwright page context to the new tab and waits for the slide container to be visible. It asserts that the slide counter shows "1 / 8". It clicks the Next button seven times in sequence, asserting after each click that the slide counter increments and that the primary content area of each slide has a non-zero bounding box height. It asserts that after the seventh click, the Next button is either disabled or hidden, confirming the final slide has been reached.

### Accessibility Testing

After navigating to each page in every spec file, an axe accessibility scan is run using the checkA11y function from the @axe-core/playwright package. The function is configured to assert zero violations at the critical and serious impact levels for WCAG 2.1 AA rules. Pages covered by accessibility checks include: the sign-in page, the dashboard home, the student management list, the mark entry page, the view marks page, the analytics dashboard, slide 1 of preview mode, the backup dashboard, and the audit log viewer. Violations at the moderate and minor levels are logged to the test report but do not fail the test run, allowing the team to track and address them over time without blocking the pipeline.

---

## React Testing Library Component Tests

### Setup

The Vitest configuration for component tests uses the jsdom environment. A setup file imported via the setupFilesAfterEnv option extends Vitest's expect interface with the @testing-library/jest-dom matchers, enabling assertions such as toBeVisible and toHaveTextContent. Two global mocks are configured: next/navigation is mocked to provide useRouter, usePathname, and useSearchParams with controllable return values, and next/image is mocked to render a standard img element to avoid Next.js image optimisation errors in the test environment. All component tests are colocated in the __tests__/components directory.

### Mark Entry Grid Tests

The test file is __tests__/components/MarkEntryGrid.test.tsx. The first test renders the component with a prop array of ten student rows and asserts that exactly ten input fields are present in the rendered output. The second test renders the grid and asserts that the Save button has the disabled attribute set, confirming no changes have been made yet. The third test simulates a change event on one input field and asserts that the Save button is no longer disabled following the user interaction. The fourth test simulates entering a value of 105 in an input field and asserts that a validation message describing the out-of-range error is visible in the component output.

### Sidebar Navigation Tests

The test file is __tests__/components/Sidebar.test.tsx. The first test renders the Sidebar with a mocked session object containing the STAFF role and asserts that only the navigation items permitted for STAFF are present in the DOM, and that ADMIN-exclusive items are absent. The second test renders with an ADMIN session mock and asserts that the additional ADMIN items such as User Management are rendered. The third test renders with a SUPERADMIN mock and asserts that both the Backup link and the Audit Log link are present.

### Student List Table Tests

The test file is __tests__/components/StudentListTable.test.tsx. The first test renders the table with a known array of eight student records and asserts that exactly eight data rows are present. The second test renders the table with the same array, simulates typing a partial name into the search input, and asserts that only the rows matching the filter are visible. The third test renders the table and simulates a click on a sortable column header, then asserts that the row order has changed in accordance with the expected sort direction.

### KPI Card Tests

The test file is __tests__/components/KpiCard.test.tsx. The first test renders the component with a numeric value prop and asserts that the formatted version of that number, including thousands separators, is visible in the output. The second test renders the component with the isLoading prop set to true and asserts that the skeleton placeholder element is present and the numeric value is absent. The third test renders the component with the isError prop set to true and asserts that an error message string is displayed rather than a numeric value.

### Backup Status Banner Tests

The test file is __tests__/components/BackupStatusBanner.test.tsx. The first test renders the component with a last-backup timestamp from one hour ago and a status of success, and asserts that the element carrying the success styling class is present in the output. The second test renders with a status of failed and a non-null error message, and asserts that both the error styling class and the error message text are visible. The third test renders the component with no backup history by passing a null or undefined lastBackup prop, and asserts that the empty state message is shown to indicate no backups have been performed yet.

---

## GitHub Actions CI/CD Pipeline

### Pull Request Workflow (.github/workflows/pr-validation.yml)

The workflow triggers on any pull_request event targeting the main branch. It runs on the ubuntu-latest runner. The steps execute in strict sequence: the repository is checked out with the actions/checkout action; Node.js version 20 is configured using actions/setup-node; project dependencies are installed using npm ci to ensure a clean, reproducible install; the TypeScript compiler is invoked with the --noEmit flag to verify the entire project type-checks without errors; ESLint is run via the Next.js lint command to enforce code quality; Vitest runs the unit project in non-interactive mode; Vitest then runs the integration project in non-interactive mode; and finally Prisma validates the schema file against its own validation rules. Each step is dependent on the previous one, so a failure at any point causes the remaining steps to be skipped and the overall workflow to fail, preventing a pull request from being merged.

The workflow requires the following repository secrets to be present: TEST_DATABASE_URL provides the connection string to the test MongoDB Atlas cluster; NEXTAUTH_SECRET_TEST provides a separate NextAuth signing secret used only in test environments to avoid contaminating the production secret rotation.

### Main Branch Deployment Workflow (.github/workflows/deploy-production.yml)

The workflow triggers on any push to the main branch, which in practice means every merged pull request. It runs the same type check, lint, and Vitest unit test steps as the PR workflow to provide a final safety gate on the code that is about to be deployed. If those steps pass, it proceeds to the deployment step, which uses the Vercel CLI via its official GitHub Action to trigger a production deployment. The Vercel build process executes prisma generate followed by next build in sequence. The deployment step reads three secrets: VERCEL_TOKEN authenticates the CLI with the Vercel API, VERCEL_ORG_ID identifies the team scope, and VERCEL_PROJECT_ID identifies the specific project to deploy.

### Preview Deployments

Every open pull request automatically receives a Vercel preview deployment through the Vercel GitHub integration, which is configured separately from the GitHub Actions workflows. The integration monitors open pull requests and triggers a new preview build whenever commits are pushed. The preview URL is posted as a comment on the pull request by Vercel automatically, giving reviewers a live URL to test against before approving the merge. Preview deployments use the TEST_DATABASE_URL environment variable configured in the Vercel project settings for the preview environment, ensuring they never read from or write to the production database.

### Required Secrets Documentation

All secrets are stored as GitHub Actions repository secrets and are never written directly into workflow YAML files.

| Secret Name | Purpose |
|---|---|
| TEST_DATABASE_URL | MongoDB Atlas connection string for the seeded test database cluster |
| NEXTAUTH_SECRET_TEST | Separate NextAuth signing secret to isolate test environments from production |
| VERCEL_TOKEN | Vercel personal access token used by the Vercel CLI in the deployment step |
| VERCEL_ORG_ID | Vercel organisation identifier scoping the deployment to the correct team |
| VERCEL_PROJECT_ID | Vercel project identifier targeting the correct application within the org |

---

## Acceptance Criteria

1. All tests in __tests__/unit pass with zero failures when running the Vitest unit project.
2. All tests in __tests__/integration pass with zero failures when running the Vitest integration project.
3. All five Playwright E2E journeys pass against the Vercel staging environment with the seeded test database in place.
4. All tests in __tests__/components pass with zero failures.
5. All axe accessibility checks embedded in the Playwright specs report zero critical or serious violations.
6. The pr-validation.yml workflow completes all five steps — type check, lint, unit tests, integration tests, and Prisma validate — without failure on a test pull request.
7. The deploy-production.yml workflow completes the type check, lint, and unit test steps and successfully triggers a Vercel production deployment on push to main.
8. A test pull request opened against main receives an automatic Vercel preview deployment and the preview URL appears as a comment on the PR.
9. No test secret values appear inline in any workflow YAML file; all sensitive values are referenced via the secrets context.
10. The Vitest coverage report shows that all pure utility functions in lib/ have at least 90% line coverage from the unit project.
11. All integration test files correctly reset Prisma mocks between test cases with no cross-test data contamination detectable via test isolation verification.
12. The E2E test suite completes within a 15-minute total runtime against the staging environment to remain within CI usage budget.

---

## Notes and Pitfalls

- Playwright tests run against the staging environment and depend on the staging database containing predictable, pre-seeded test data. If the seed data is missing or has been mutated by a previous test run, assertions will fail non-deterministically. A dedicated seed script must be run against the staging database before each E2E test suite execution, and the CI workflow should invoke this script as the first step of any E2E job.
- The global Playwright setup file that performs login once per role and persists the browser storage state to disk must handle the case where the staging environment is on a cold start and has not yet warmed up. A retry loop with a meaningful delay should be implemented in the setup file, attempting to reach the login page up to five times with a five-second wait between attempts before failing with a clear error message.
- Vitest integration tests that configure mock return values on the prismaMock instance must reset all mocks in a beforeEach hook to prevent configuration from one test influencing another. Forgetting this step is the most common cause of integration test failures that only appear when the full suite runs in sequence rather than when a single test file runs in isolation.
- The axe accessibility check in each Playwright spec runs after the page navigation, but chart components and other dynamically rendered content may not be fully painted at the point when checkA11y executes. The test must wait for an explicit signal — such as a chart container element reaching a non-zero bounding box height — before triggering the axe scan, otherwise the scan will run on an incomplete DOM and may produce misleading violation counts.
- GitHub Actions ubuntu-latest runners do not include a graphical display server, which is required for Playwright to launch a headed browser process. The workflow must either install the required system libraries for Chromium's headless mode via apt before running the Playwright step, or use the officially maintained Playwright Docker image as the job container to ensure all native dependencies are available without manual installation steps.
