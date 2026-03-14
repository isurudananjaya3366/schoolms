# Secrets Audit Checklist

**Project:** SchoolMS
**Date:** [To be filled before production deployment]
**Auditor:** [Name]

## Verification Items

- [ ] 1. All secrets (DATABASE_URL, NEXTAUTH_SECRET, CRON_SECRET, AWS credentials, BLOB_READ_WRITE_TOKEN, UPSTASH credentials, RESEND_API_KEY) are stored exclusively in Vercel project environment variables. None appear in source files.

- [ ] 2. No API route, middleware, or utility logs any secret value at any log level.

- [ ] 3. `.gitignore` excludes `.env`, `.env.local`, `.env.production`, `.env.development`, and all dot-env variants.

- [ ] 4. `prisma/schema.prisma` references `env("DATABASE_URL")` only - no hardcoded connection strings.

- [ ] 5. No environment variable values appear in static build output (`.next/static/`).

- [ ] 6. `NEXTAUTH_SECRET` is unique to this project and freshly generated.

- [ ] 7. `CRON_SECRET` is at least 32 characters and cryptographically generated.

- [ ] 8. No GitHub Actions workflow or README exposes secret values in plaintext.

## Sign-off

- **Status:** Pending
- **Notes:** 
