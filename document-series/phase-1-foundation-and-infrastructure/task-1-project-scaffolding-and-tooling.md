# Phase 1 / Task 1 — Project Scaffolding and Tooling Setup

| Field                | Value                                              |
|----------------------|----------------------------------------------------|
| Phase                | Phase 1: Foundation and Infrastructure             |
| Task Number          | 1 of 5                                             |
| Task Title           | Project Scaffolding and Tooling Setup              |
| Status               | Pending                                            |
| Estimated Complexity | Medium                                             |
| Phase Reference      | See Phase 1 Overview, Sections 1–4                 |

---

## Task Summary

Task 1 establishes the entire technical substrate for the SchoolMS project. It produces no application features, no database models, and no user-visible UI. What it produces is a fully operational, correctly configured Next.js 14 App Router project in which every subsequent task can be implemented without touching configuration again.

This task must be completed first because every other task in every subsequent phase depends on the toolchain it sets up. TypeScript strict mode must be configured before any source files are written, because retrofitting strict mode into a large codebase is significantly more difficult than starting correctly. Tailwind CSS and shadcn/ui must be configured before any component is built, because both require consistent class name conventions that cannot be changed mid-project without touching hundreds of files. The GitHub Actions workflow must be present from the first commit so that continuous integration catches regressions from day one.

Upon completion of this task, the repository will contain a running Next.js development server, a passing test suite (one smoke test), a clean lint result, and zero TypeScript errors — all with no actual feature code present. This "green baseline" is a hard prerequisite for beginning Task 2.

---

## Prerequisites

Before beginning this task, the following conditions must be satisfied:

- A remote Git repository for the project has been created. The repository must be empty or contain only a README and a licence file. No package.json, no Next.js files.
- Node.js 20.x LTS is installed on the development machine. The project explicitly targets Node.js 20 in the GitHub Actions matrix; using Node.js 18 locally is acceptable for development but all CI runs will use Node.js 20.
- The Yarn package manager is available as an alternative to npm. The project uses npm as its canonical package manager (npm ci is used in CI), so Yarn is not required but must not interfere. If Yarn is the preferred local tool, note that the package.json scripts are written using npm conventions.
- The developer has a MongoDB Atlas account and has created a cluster. The actual connection string is not needed for Task 1 — a placeholder is sufficient — but the account must exist so that Task 2 can proceed immediately.
- The developer has access to create Vercel projects. Again, not strictly needed for the code in this task, but the environment variable names documented here reference Vercel project IDs that will be needed before the first deployment.
- git is installed and the working directory has been initialised with git init or cloned from the remote.

---

## Task Scope

### In Scope

- Initialising the Next.js 14 application using the official Next.js initialisation tool with App Router enabled and TypeScript selected.
- Writing the tsconfig.json with full TypeScript strict mode and the @ path alias.
- Writing tailwind.config.ts with SchoolMS brand colours and dark mode class strategy.
- Writing postcss.config.js with Tailwind and Autoprefixer.
- Writing .eslintrc.json with next/core-web-vitals, TypeScript-aware rules, and the three custom rules (no-unused-vars as error, no-explicit-any as error, consistent-return as warn).
- Running the shadcn/ui CLI to generate components.json and copying the eight Phase 1 base components into components/ui/.
- Installing all runtime and development dependencies required across all five phases of the project, so that no further npm install runs are needed to add libraries (only to add shadcn/ui components, which are code copies, not packages).
- Creating the full top-level folder structure with appropriate placeholder files.
- Writing next.config.js, .env.example, and .gitignore.
- Writing all package.json scripts.
- Writing lib/utils.ts with the cn() Tailwind class merging utility.
- Writing vitest.config.ts, vitest.setup.ts, and the smoke test file.
- Writing .github/workflows/ci.yml with four parallel jobs.
- Writing app/globals.css with Tailwind base directives and shadcn/ui CSS custom properties.

### Out of Scope

- Writing any Prisma schema models. Task 2 owns the schema.
- Creating any actual page or layout components beyond placeholder index files.
- Configuring authentication logic. Task 2 and Task 3 own NextAuth.js configuration.
- Creating any API route handlers.
- Setting up any real database connection or seeding scripts.
- Implementing any business logic whatsoever.
- Deploying to Vercel. Deployment configuration is addressed in Phase 5.

---

## Acceptance Criteria

The following conditions must all be true when this task is considered complete:

1. Running npm install completes with exit code 0 and reports zero peer dependency errors.
2. Running npm run build completes with exit code 0. The build output confirms zero TypeScript errors in strict mode. No pages fail to compile.
3. Running npm run lint completes with exit code 0 and reports zero errors and zero warnings on all files currently in the repository.
4. Running npm run type-check completes with exit code 0. TypeScript in strict mode finds no type errors across all files.
5. Running npm run test completes with exit code 0. Vitest reports the smoke test for the cn() utility as passing.
6. Running npx prisma validate completes with exit code 0. Even though the schema is empty or minimal, the Prisma CLI can load and validate it.
7. The file .github/workflows/ci.yml exists and contains all four parallel jobs: type-check, lint, test, and validate-schema.
8. The folder structure described in the Folder Structure Creation step exists, with placeholder files in every directory that requires one.
9. The .env.example file contains all 16 environment variables listed in the Environmental Variable Documentation section, each with a placeholder value and an inline comment.
10. The following shadcn/ui component files exist in components/ui/: button.tsx, input.tsx, label.tsx, card.tsx, badge.tsx, alert.tsx, separator.tsx, and sonner.tsx.
11. The file components.json exists at the project root with the new-york style, slate base colour, and cssVariables set to true.
12. The file lib/utils.ts exists and exports the cn() function.
13. The file app/globals.css exists, contains the three Tailwind directive imports, and contains the :root and .dark CSS variable blocks with the full set of shadcn/ui colour tokens.
14. The .gitignore file excludes .env, .env.local, node_modules/, .next/, and prisma/generated/.

---

## Step-by-Step Implementation Guide

### Step 1: Repository and Next.js Initialisation

If the repository was cloned from an existing remote, navigate into the project directory. If starting fresh, create the directory and initialise git.

Use the official Next.js creation tool (create-next-app) to scaffold the project. The flags that must be selected or confirmed during the interactive prompt are: TypeScript (yes), ESLint (yes), Tailwind CSS (yes), src/ directory (no — the project uses a flat app/ directory at the root, not a nested src/ directory), App Router (yes), and the import alias prompt should be confirmed with the @ symbol mapping to the project root.

After initialisation, verify that the following root-level files were created by the scaffolding tool: next.config.js (or next.config.ts), tsconfig.json, tailwind.config.ts, postcss.config.js, .eslintrc.json (the scaffolding tool creates this), package.json, and the app/ directory containing layout.tsx, page.tsx, and globals.css.

The create-next-app tool installs a minimal set of dependencies. In the following steps, additional packages will be installed on top of this baseline. Do not remove or overwrite any file that the scaffolding tool generated until that file is explicitly addressed in a later step.

### Step 2: TypeScript Configuration

The tsconfig.json generated by create-next-app is a good starting point but must be reviewed and adjusted to match the project's strict requirements.

The compiler options must include the following settings. The target must be ES2017 or later, which ensures modern JavaScript output while remaining compatible with the Node.js 20 runtime. The module setting must be ESNext to allow dynamic imports and top-level await. The moduleResolution setting must be bundler — this is a Next.js 14 requirement that allows the TypeScript compiler to resolve imports the same way that Webpack and Turbopack resolve them, which is necessary for correct handling of package exports fields. Without the bundler setting, certain module resolution errors appear at type-check time that do not appear at build time, causing confusing discrepancies.

Full strict mode requires the strict flag set to true (this enables noImplicitAny, strictNullChecks, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, noImplicitThis, and alwaysStrict together). Additionally, noUnusedLocals and noUnusedParameters should be set to true to enforce clean code. The forceConsistentCasingInFileNames flag must be true for cross-platform compatibility between macOS and Linux.

The path alias configuration is critical. The paths section must map the @ symbol to the project root (an array containing a single entry: a dot representing the current directory). The baseUrl must be set to the project root as well. This setup means that any file anywhere in the project can import from @/lib/utils or @/components/ui/button without computing relative paths. All code in the project uses this alias convention consistently — never use relative path imports that traverse upward with ../.

The include array must cover app/, components/, lib/, middleware.ts, and vitest.config.ts. The exclude array must contain node_modules/ and .next/.

### Step 3: Tailwind CSS and PostCSS Setup

The tailwind.config.ts file generated by create-next-app includes only the app/ directory in its content paths. This must be extended to include components/**/*.{ts,tsx} and lib/**/*.{ts,tsx} so that Tailwind's JIT compiler scans all files for class usage.

The theme extension for SchoolMS brand colours must define three colour namespaces. The primary colour namespace should contain a complete scale from 50 to 950 built around a blue that communicates trust and authority — appropriate for an educational institution. The accent-green colour namespace should contain a scale suitable for success states, passing grades, and positive indicators. The destructive-red colour namespace should contain a scale for W grade indicators, failing states, and error conditions. These colour names — primary, accent-green, and destructive-red — will be referenced in Tailwind utility classes throughout every phase of the project, so they must not be renamed after this task is complete.

The darkMode setting must be class, not media. This means dark mode is activated by adding the dark class to the html element, enabling a manual theme toggle. This toggle is implemented in Phase 2 (the dashboard layout), but the configuration must be correct from Phase 1 so that the shadcn/ui CSS variable system works correctly.

The postcss.config.js file should contain only the two standard plugins: tailwindcss and autoprefixer. No other PostCSS plugins are needed.

Important: Tailwind CSS v3 must be used, not v4. The shadcn/ui version used by this project is built on Tailwind v3's utility class conventions. If Tailwind v4 is accidentally installed, the shadcn/ui component styles will not compile correctly and the component output will be unstyled. Verify the installed version after npm install.

### Step 4: ESLint Configuration

The .eslintrc.json file generated by create-next-app typically extends only next/core-web-vitals. This must be kept as the base, but the TypeScript-aware ruleset must be added.

The plugins array must include @typescript-eslint. The parser must be set to @typescript-eslint/parser so that ESLint understands TypeScript syntax. The parserOptions must include the project field pointing to the tsconfig.json file at the project root — this enables type-aware linting rules that require the TypeScript language service.

The three custom rules that must be configured are: no-unused-vars should be set to error (note: use the @typescript-eslint/no-unused-vars rule rather than the base ESLint rule, to avoid false positives on TypeScript-specific constructs like type imports), @typescript-eslint/no-explicit-any should be set to error (this enforces the strict no-any policy required by the architecture), and consistent-return should be set to warn.

The extends order matters. The next/core-web-vitals ruleset must be listed before the plugin:@typescript-eslint/recommended ruleset to ensure that Next.js-specific overrides take precedence.

The devDependencies required for this configuration are @typescript-eslint/parser and @typescript-eslint/eslint-plugin. These are typically installed by create-next-app but should be verified.

### Step 5: shadcn/ui Initialisation

shadcn/ui is not an npm package in the conventional sense. Its components are source code, not compiled artefacts. The initialisation process uses the shadcn/ui CLI to generate a configuration file and write the first set of component source files directly into the project.

Run the shadcn-ui init command (npx shadcn-ui@latest init). The interactive prompt will ask several questions. The style selection should be new-york — this style uses slightly more refined typography and spacing than the default style and is the preference for this project. The base colour should be slate. When asked about CSS variables for colours, select yes. When asked for the global CSS file path, provide app/globals.css. When asked for the tailwind.config.ts path, confirm the default. When asked for the components alias, confirm @/components. When asked for the utils alias, confirm @/lib/utils.

After init completes, a components.json file will exist at the project root. This file must be committed to the repository and must not be regenerated in later tasks.

The init command also adds the tailwindcss-animate plugin to devDependencies and modifies tailwind.config.ts to include it in the plugins array. It creates or overwrites lib/utils.ts with the cn() utility. It adds class-variance-authority, clsx, tailwind-merge, and @radix-ui/react-slot to dependencies.

After init, install the eight Phase 1 components by running the shadcn-ui add command once for each: button, input, label, card, badge, alert, separator, and sonner. Each command copies a .tsx file into components/ui/. These files are project source code and will be modified in later phases to accommodate SchoolMS-specific behaviour. Sonner requires the sonner package to be installed as a dependency, which the CLI handles automatically.

### Step 6: Additional Package Installation

After the base Next.js scaffold and shadcn/ui setup, additional packages must be installed. These are grouped here by category for clarity, though they are installed via a single npm install command.

Runtime dependencies that are not installed by create-next-app or shadcn/ui include: next-auth at a pinned beta version for NextAuth.js v5 (see the Common Pitfalls section regarding version pinning), prisma/client at version 5.x, zod at version 3.x, zustand at version 4.x, date-fns at version 3.x, recharts at version 2.x, d3 at version 7.x, and @react-pdf/renderer at version 3.x.

Development dependencies include: prisma at version 5.x (the CLI, separate from the client), vitest, @vitejs/plugin-react, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom, @types/d3, and @types/react-pdf if available.

The TypeScript type packages @types/node, @types/react, and @types/react-dom are typically installed by create-next-app but must be verified.

After installing all packages, run npm run build once to confirm there are no immediate compilation failures introduced by the new packages. If the build fails at this stage, it is most likely due to a peer dependency mismatch or a missing type declaration, not any application logic issue.

### Step 7: Folder Structure Creation

The full directory tree must exist before Task 2 begins, because Task 2 will immediately create files inside several of these directories and its instructions assume the directories are present.

Under the app/ directory, create the following subdirectory paths: (auth)/login/, (auth)/register/, (auth)/reset-password/, config/, dashboard/, dashboard/students/, dashboard/marks/, dashboard/reports/, dashboard/analytics/, dashboard/backup/, dashboard/settings/, preview/, api/auth/, api/config/, api/students/, api/marks/, api/reports/, api/backup/, api/users/, api/analytics/, and api/settings/.

The (auth) directory uses Next.js route grouping parenthetical syntax — the directory name is (auth), including the parentheses. This groups the authentication routes without adding (auth) to the URL path.

Under the components/ directory, create: ui/ (populated by shadcn/ui in Step 5), dashboard/, charts/, infographics/, and preview/.

Under the lib/ directory, the shadcn/ui init will have created utils.ts. Additional files will be created in later tasks but the directory already exists.

Under the prisma/ directory, create schema.prisma with minimal valid content: the generator client block and the datasource db block. The datasource url must reference the DATABASE_URL environment variable. The provider must be mongodb. This minimal schema is sufficient for npx prisma validate to pass. No models are defined yet — models are Task 2.

Under .github/workflows/, create the ci.yml file (detailed in Step 12).

Each directory that contains only placeholder content needs a placeholder file. For app/ route subdirectories that have no implementation yet, create a page.tsx placeholder that exports a default function returning a minimal JSX fragment with a comment indicating the route and that it will be implemented in a specific later task. For component subdirectories under components/dashboard/, components/charts/, components/infographics/, and components/preview/, create an index.ts placeholder that contains only a comment indicating which task will populate it.

### Step 8: Configuration Files

The next.config.js file must confirm the App Router configuration. In Next.js 14, the App Router is the default and no special configuration flag is needed to enable it. The config object should be minimal: no experimental flags, no custom webpack configuration, no image domains for Phase 1. The file should export a standard NextConfig object.

The postcss.config.js must list the tailwindcss plugin and the autoprefixer plugin. No other plugins.

The .gitignore file must include the following entries: .env (prevents accidental commit of real secrets), .env.local (Next.js convention for local secrets), .env.development.local, .env.test.local, .env.production.local, node_modules/ (standard), .next/ (Next.js build output), out/ (Next.js static export output if used), prisma/generated/ (prevents committing the generated Prisma client into version control, since it is regenerated during postinstall), coverage/ (Vitest coverage output), .DS_Store (macOS metadata), and *.log.

The .env.example file must contain all 16 environment variables listed in the Environmental Variable Documentation section below. Each variable must have a placeholder value (never a real secret) and an inline comment explaining its purpose and, where applicable, where to find or generate the real value. This file is committed to the repository and serves as the authoritative reference for environment setup.

### Step 9: package.json Scripts

The scripts section of package.json must define eight scripts:

The dev script runs next dev, which starts the Next.js development server with hot module replacement.

The build script runs prisma generate followed by next build. Note that these two commands are chained. This ensures that whenever a production build is triggered — in CI, in Vercel deployment, or locally — the Prisma client is always regenerated from the current schema before the TypeScript compilation begins. Without the prisma generate step, the Prisma client types may be stale if the schema was recently modified.

The start script runs next start, which serves the production build.

The lint script runs next lint, which uses the Next.js ESLint runner with the project's .eslintrc.json configuration.

The type-check script runs tsc with the --noEmit flag. This runs the TypeScript compiler purely for type checking without producing any output files. It is faster than a full build and is the preferred way to check types in CI without duplicating the build.

The test script runs vitest run, which executes all tests once in non-watch mode and exits. This is the script used in CI.

The test:watch script runs vitest without additional flags, which starts Vitest in interactive watch mode. This is for local development.

The postinstall script runs prisma generate. This ensures that after every npm install or npm ci, the Prisma client is automatically regenerated. This is particularly important in CI environments where npm ci is run before the build step, and in Vercel deployments where Vercel runs npm install before calling the build command.

### Step 10: lib/utils.ts

The shadcn/ui init command will have created lib/utils.ts with the cn() function. Verify that the content is correct and consistent with the project's TypeScript strict mode requirements.

The cn() function must accept a variable number of arguments where each argument is a valid input to the clsx function — this includes strings, arrays, and objects mapping class names to boolean conditions. The function passes all arguments to clsx to resolve conditional class names, then passes the result through twMerge from tailwind-merge to deduplicate and resolve conflicting Tailwind utility classes.

The important behaviour of cn() is Tailwind class conflict resolution. Without tailwind-merge, applying both p-2 and p-4 to an element would result in both classes being present in the DOM, with the winner determined by CSS specificity rules (which in Tailwind's case means the last class defined in the generated stylesheet, not the last class in the class attribute string). With tailwind-merge, cn("p-2", "p-4") correctly resolves to just p-4, discarding the overridden value. This is essential for the variant system used by shadcn/ui components.

The TypeScript signature of the function must use ClassValue from clsx as the parameter type, ensuring that the function is fully type-safe and compatible with the strict mode configuration.

### Step 11: Vitest Configuration

The vitest.config.ts file at the project root configures Vitest to work correctly with the TypeScript and React setup.

The environment must be set to jsdom. This provides a simulated browser DOM environment that is required for React component testing with Testing Library. Without jsdom, any test that renders a React component or accesses browser APIs will throw reference errors on undefined globals like window and document.

The globals option must be set to true. This makes the describe, it, test, expect, beforeEach, afterEach, beforeAll, and afterAll functions available globally in all test files without explicit imports. This matches the testing style used throughout the project.

The setupFiles option must reference a setup file — vitest.setup.ts at the project root. This file must import @testing-library/jest-dom, which extends Vitest's expect with DOM-specific matchers such as toBeInTheDocument, toHaveClass, toHaveTextContent, and others. These matchers are used throughout the component test suite beginning in Phase 2.

The coverage configuration must use the istanbul provider, produce reports in html, text, and json formats, and output to a coverage/ directory. The include pattern for test files should be **/*.{test,spec}.{ts,tsx}. The exclude pattern must contain node_modules/, .next/, and the vitest.config.ts and vitest.setup.ts files themselves.

The path alias must be configured in Vitest as well as TypeScript. The resolve.alias configuration in vitest.config.ts must mirror the @ alias from tsconfig.json, mapping @ to the project root. Without this, Vitest will fail to resolve any import that uses the @/ prefix, even if the TypeScript compiler resolves it correctly.

The smoke test file should be placed at lib/utils.test.ts. It imports the cn() function and tests three behaviours: that a single class string is passed through unchanged, that two non-conflicting classes are joined with a space, and that two conflicting Tailwind classes resolve to only the last one specified (demonstrating that tailwind-merge is working). These three assertions are sufficient to verify the entire cn() implementation.

### Step 12: GitHub Actions CI Workflow

The .github/workflows/ci.yml file defines the continuous integration pipeline. It must trigger on two events: any push to the main branch, and any pull_request targeting the main branch. This ensures that both direct commits to main and proposed changes via pull requests are validated.

The workflow defines four jobs that run in parallel. Running them in parallel rather than sequentially reduces the total CI run time significantly, because type checking, linting, testing, and schema validation are independent operations.

All four jobs share the same configuration base: they run on ubuntu-latest, use Node.js 20.x, and begin by checking out the repository code and then running npm ci. The npm ci command is used rather than npm install because it installs exactly the versions specified in package-lock.json, producing a deterministic and reproducible dependency tree. The first time the workflow runs, the package-lock.json must be committed to the repository — this is also why the .gitignore must not exclude package-lock.json.

Every job must set two environment variables. The DATABASE_URL variable must be set to a valid-looking but non-functional MongoDB connection string. Prisma reads this variable when performing schema validation and when generating the client. If the variable is absent, Prisma will exit with an error about a missing required environment variable, even in operations that do not require a real database connection. The value used is a dummy mongodb+srv string pointing to a fictional cluster. The NEXTAUTH_SECRET variable must be set to a static string. NextAuth.js v5 reads this variable at startup and will throw a configuration error at import time if it is missing.

The type-check job runs npm run type-check after npm ci. It reports TypeScript errors across the entire project.

The lint job runs npm run lint after npm ci. It reports ESLint violations.

The test job runs npm run test after npm ci. It runs Vitest in non-watch mode and reports test failures.

The validate-schema job runs npx prisma validate after npm ci. This validates that the schema.prisma file is syntactically correct and that all referenced types and relationships are resolvable. It does not require a live database connection.

### Step 13: app/globals.css

The globals.css file must contain three Tailwind directive lines at the top: @tailwind base, @tailwind components, and @tailwind utilities. These directives instruct PostCSS to inject Tailwind's generated styles at the three appropriate layers of the CSS cascade.

Following the Tailwind directives, the file must define the shadcn/ui colour token CSS custom properties inside an @layer base block. Within that block, two selectors define the full token set: a :root selector for light mode values and a .dark selector for dark mode overrides.

The custom properties use the HSL colour format without the hsl() wrapper — this is the shadcn/ui convention, not a general CSS convention. For example, the background token is defined as a space-separated hue saturation lightness triplet, and consumed by Tailwind utilities as hsl(var(--background)) via the tailwind.config.ts colour definitions.

The semantic colour tokens required are: --background, --foreground, --card, --card-foreground, --popover, --popover-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --destructive-foreground, --border, --input, --ring, and --radius.

The light mode (:root) values should follow the new-york style convention from shadcn/ui documentation: white background, near-black foreground, a branded blue for primary, slate-100 for muted. The dark mode (.dark) values invert the background and foreground, use a darker blue shade for primary, and use slate-800 for muted.

The --radius token defines the base border radius used across all shadcn/ui components. The new-york style uses 0.5rem as the default radius. This value is referenced in the tailwind.config.ts borderRadius theme extension as the default variable.

---

## Environmental Variable Documentation

The following table documents all environment variables that must be present in .env.example. The "Required for Build" column indicates whether the variable must have a non-empty value for npm run build to succeed. Variables not required for build can remain as empty placeholders in local .env.local files during Task 1 development.

| Variable                | Required for Build | Purpose                                                                 |
|-------------------------|--------------------|-------------------------------------------------------------------------|
| DATABASE_URL            | Yes                | MongoDB Atlas connection string. Used by Prisma at generate and build time. |
| NEXTAUTH_SECRET         | Yes                | Cryptographic secret for NextAuth.js token signing. Must be at least 32 characters. |
| NEXTAUTH_URL            | No                 | Canonical URL of the deployed application. Required in production, optional in development. |
| VERCEL_API_TOKEN        | No                 | Vercel API token for programmatic deployments triggered from the admin panel. Used in Phase 5. |
| VERCEL_PROJECT_ID       | No                 | Vercel project identifier. Used alongside VERCEL_API_TOKEN in Phase 5. |
| CRON_SECRET             | No                 | Shared secret for authenticating cron job requests to API routes. Used in Phase 5. |
| RESEND_API_KEY          | No                 | API key for the Resend email delivery service. Used in Phase 2 for progress report email delivery. |
| SMTP_HOST               | No                 | SMTP server hostname for email delivery fallback. Used in Phase 3. |
| SMTP_PORT               | No                 | SMTP server port (typically 587 for TLS or 465 for SSL). Used in Phase 3. |
| SMTP_USER               | No                 | SMTP authentication username. Used in Phase 3. |
| SMTP_PASS               | No                 | SMTP authentication password. Used in Phase 3. |
| UPSTASH_REDIS_REST_URL  | No                 | Upstash Redis REST API URL for rate limiting and session caching. Used in Phase 5. |
| BLOB_READ_WRITE_TOKEN   | No                 | Vercel Blob storage token for PDF and backup file storage. Used in Phase 3 and Phase 5. |
| AWS_ACCESS_KEY_ID       | No                 | AWS IAM access key for S3-compatible backup storage. Used in Phase 5. |
| AWS_SECRET_ACCESS_KEY   | No                 | AWS IAM secret key paired with AWS_ACCESS_KEY_ID. Used in Phase 5. |
| AWS_S3_BUCKET           | No                 | S3 bucket name for storing backup archives. Used in Phase 5. |

---

## File Inventory

The following files are created or materially modified by Task 1. Files created by create-next-app that are not modified are not listed.

| File Path                                          | Created or Modified | Owning Step  |
|----------------------------------------------------|---------------------|--------------|
| tsconfig.json                                      | Modified            | Step 2       |
| tailwind.config.ts                                 | Modified            | Step 3       |
| postcss.config.js                                  | Modified            | Step 3       |
| .eslintrc.json                                     | Modified            | Step 4       |
| components.json                                    | Created             | Step 5       |
| components/ui/button.tsx                           | Created             | Step 5       |
| components/ui/input.tsx                            | Created             | Step 5       |
| components/ui/label.tsx                            | Created             | Step 5       |
| components/ui/card.tsx                             | Created             | Step 5       |
| components/ui/badge.tsx                            | Created             | Step 5       |
| components/ui/alert.tsx                            | Created             | Step 5       |
| components/ui/separator.tsx                        | Created             | Step 5       |
| components/ui/sonner.tsx                           | Created             | Step 5       |
| package.json                                       | Modified            | Steps 6, 9   |
| package-lock.json                                  | Created             | Step 6       |
| app/(auth)/login/page.tsx                          | Created             | Step 7       |
| app/(auth)/register/page.tsx                       | Created             | Step 7       |
| app/(auth)/reset-password/page.tsx                 | Created             | Step 7       |
| app/config/page.tsx                                | Created             | Step 7       |
| app/dashboard/page.tsx                             | Created             | Step 7       |
| app/dashboard/students/page.tsx                    | Created             | Step 7       |
| app/dashboard/marks/page.tsx                       | Created             | Step 7       |
| app/dashboard/reports/page.tsx                     | Created             | Step 7       |
| app/dashboard/analytics/page.tsx                   | Created             | Step 7       |
| app/dashboard/backup/page.tsx                      | Created             | Step 7       |
| app/dashboard/settings/page.tsx                    | Created             | Step 7       |
| app/preview/page.tsx                               | Created             | Step 7       |
| components/dashboard/index.ts                      | Created             | Step 7       |
| components/charts/index.ts                         | Created             | Step 7       |
| components/infographics/index.ts                   | Created             | Step 7       |
| components/preview/index.ts                        | Created             | Step 7       |
| prisma/schema.prisma                               | Created             | Step 7       |
| .github/workflows/ci.yml                           | Created             | Steps 7, 12  |
| next.config.js                                     | Modified            | Step 8       |
| .gitignore                                         | Modified            | Step 8       |
| .env.example                                       | Created             | Step 8       |
| lib/utils.ts                                       | Created             | Steps 5, 10  |
| vitest.config.ts                                   | Created             | Step 11      |
| vitest.setup.ts                                    | Created             | Step 11      |
| lib/utils.test.ts                                  | Created             | Step 11      |
| app/globals.css                                    | Modified            | Step 13      |

---

## Integration Points with Other Tasks

Task 1 is the foundation upon which every other task is built. The following integration points must be understood before beginning any subsequent task:

**Task 2 (Database Schema and Prisma Configuration)** depends on the prisma/schema.prisma file existing with a valid datasource block, on the DATABASE_URL environment variable being documented, on the @prisma/client and prisma packages being installed, and on the postinstall script running prisma generate automatically. Task 2 will add all model definitions to the schema and run the first migration.

**Task 3 (Authentication and Authorisation)** depends on the NextAuth.js v5 package being installed at the pinned beta version, on the NEXTAUTH_SECRET and NEXTAUTH_URL variables being documented in .env.example, on the app/api/auth/ directory existing, and on the lib/auth.ts placeholder file existing in the lib/ directory. Task 3 will write the complete NextAuth configuration into lib/auth.ts.

**Task 4 (Core Dashboard and Student Management)** depends on all shadcn/ui Phase 1 components being present in components/ui/, on the cn() utility being available at @/lib/utils, on the dashboard/ route directory structure being in place, on the Recharts and Zustand packages being installed (Recharts is used for the first dashboard charts), and on the Tailwind custom colour tokens (primary, accent-green, destructive-red) being available as Tailwind utility classes.

**Task 5 (Marks Entry and Report Generation)** depends on @react-pdf/renderer being installed, on the preview/ route directory existing, on the D3 package being installed, and on the TypeScript strict mode configuration being stable and passing before any marks logic is written.

The GitHub Actions CI workflow provides ongoing integration protection for all subsequent tasks. Every pull request that implements Tasks 2 through 5 will be validated against the four jobs defined in ci.yml. The workflow should require all four jobs to pass before pull requests can be merged — this branch protection rule should be configured in the GitHub repository settings after the first successful CI run (which occurs when the Task 1 branch is merged).

---

## Common Pitfalls

### NextAuth.js v5 Version Pinning

NextAuth.js v5 is in beta as of the time this document was written. The package name on npm is next-auth and the v5 beta versions are tagged with identifiers such as 5.0.0-beta.4, 5.0.0-beta.18, and so on. Specifying next-auth@beta in package.json resolves to the latest beta at the time of install. This is problematic because a future beta release may introduce breaking changes between the time Task 1 is implemented and the time Task 3 (Authentication) is implemented. The version must be pinned to a specific beta release rather than using the @latest or @beta tag. The package.json entry must specify the exact version string. If a future beta version introduces a breaking API change, an explicit upgrade decision can be made rather than having it happen silently.

### Tailwind CSS v3 vs v4

Tailwind CSS v4 is a major rewrite with a fundamentally different configuration format (CSS-first configuration rather than a JavaScript configuration file) and a different plugin API. The shadcn/ui library used in this project targets Tailwind v3. Installing Tailwind v4 will cause shadcn/ui's component styles to fail silently — the components will render with no visual styling. Always verify the installed version using npm list tailwindcss after running npm install.

### TypeScript Strict Mode and Library Type Definitions

Some third-party libraries have incomplete or inconsistent TypeScript definitions that generate errors under strict mode but not under the default TypeScript configuration. The most common offenders in this stack are older versions of @types/react-pdf and some D3 submodules. If a strict mode error appears from inside node_modules/ during npm run type-check, the correct resolution is to add a targeted skipLibCheck:true entry in tsconfig.json to skip type checking of declaration files in node_modules/. This is acceptable because it does not disable type checking on the project's own source files.

### Prisma Generate in postinstall

The postinstall script ensures that prisma generate runs after every npm install or npm ci. However, in CI environments, Vercel deployment environments, and Docker build environments, the DATABASE_URL environment variable must be set before npm install runs — because postinstall runs as part of the install process, not as a separate step. If DATABASE_URL is not set, the prisma generate command will fail with a missing environment variable error, causing the entire install to fail. This is why the GitHub Actions jobs all set DATABASE_URL as an environment variable at the job level rather than only at the step level.

### The src/ Directory Convention

The create-next-app tool asks whether to use a src/ directory. The SchoolMS project does not use a src/ directory — app/, components/, lib/, and prisma/ are all at the root. If src/ is accidentally selected, the path aliases in tsconfig.json, the Vitest resolve aliases, and the Tailwind content paths will all be wrong and must be corrected. It is easier to reinitialise the project than to manually correct all affected configuration files.

### shadcn/ui components.json and Relative Imports

The components.json file generated by shadcn/ui init controls where new components are written when running shadcn-ui add. If the aliases in components.json are incorrect, added components will write their import statements using wrong paths that do not resolve. After running init, open components.json and verify that the components alias is @/components and the utils alias is @/lib/utils. These must match the paths config in tsconfig.json exactly.

### package-lock.json Commit

The package-lock.json file must be committed to the repository. The GitHub Actions workflow uses npm ci, which requires package-lock.json to be present. If it is missing from the repository, every CI run will fail immediately with an error stating that npm ci can only install packages when a package-lock.json file is present. The .gitignore must not exclude package-lock.json under any circumstances.

### moduleResolution: bundler Compatibility

The bundler moduleResolution mode is required for Next.js 14 App Router compatibility. However, some scripts that run outside the Next.js build pipeline — such as standalone Prisma scripts or custom Node.js utility scripts that are not part of the Next.js build — may not understand the bundler resolution mode because they run in Node.js directly rather than through a bundler. If any such scripts need to be written, they should have their own separate tsconfig (typically tsconfig.node.json or tsconfig.scripts.json) that uses the node16 or nodenext moduleResolution strategy. For Phase 1, no such scripts exist, but this distinction becomes relevant in Phase 5 when backup scripts are added.
