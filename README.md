# FohBoh Sentry

FohBoh Sentry is a restaurant financial-evidence and certification application. It accepts location-scoped processor, POS, delivery-platform, agreement, and bank evidence; validates and governs those artifacts; runs deterministic M01/M02 certification; and persists CAAR reports with traceability and recovery findings.

The application is built with Next.js 16, React 19, TypeScript, PostgreSQL, and Prisma 7.

## Current capabilities

- Database-backed manager authentication with signed, HTTP-only session cookies
- Account, team, role, and location-scoped access controls
- Location onboarding and persistent workflow state
- M01 processor/POS evidence for providers including Heartland and Toast
- M02 delivery-platform evidence for providers including DoorDash and Uber Eats
- CSV and PDF intake, schema matching, hashing, metadata extraction, and validation
- PostgreSQL-backed upload and generated-artifact blob storage
- Versioned contract configuration and schema governance
- Deterministic certification, trust gates, MQ6 scoring, and rule citations
- Persistent CAAR records, downloadable reports, and claim packs
- Activity logging, system-health findings, support tickets, and access requests
- SuperAdmin operations for managers, restaurants, accounts, teams, tickets, and engine data

## Certification model

Certifications are deliberately scoped.

- M01 and M02 are run separately and produce separate CAARs.
- M02 requires a selected delivery platform.
- DoorDash and Uber Eats uploads, schemas, contracts, certification runs, findings, and recovery values remain vendor-scoped.
- Evidence from one M02 provider must not satisfy another provider's certification.
- Monthly-final certification requires the governed evidence set, including bank evidence where applicable.
- Weekly-preliminary certification can report an interim state but does not represent a monthly-final release.
- Invalid-schema evidence is excluded from recovery calculations.

The principal server-side implementation is in [`src/lib/certification/service.ts`](src/lib/certification/service.ts), with deterministic evaluation in [`src/components/sentry/caar-engine.ts`](src/components/sentry/caar-engine.ts) and [`src/lib/mge/engine.ts`](src/lib/mge/engine.ts).

## Supported provider fixtures

The current regression suite covers:

| Module | Provider | Current coverage |
| --- | --- | --- |
| M01 | Heartland | Intake, evidence degradation, recovery safety |
| M01 | Toast | Format detection, intake, evidence degradation, recovery safety |
| M02 | DoorDash | Format detection, vendor-scoped certification, isolation |
| M02 | Uber Eats | Format detection, normalization, vendor-scoped certification, isolation |

Additional vendors appear in the catalog, but a catalog entry alone does not guarantee the same fixture and regression depth as the providers above. See [`src/components/sentry/vendor-catalog.ts`](src/components/sentry/vendor-catalog.ts) and [`src/lib/uploads/definitions.ts`](src/lib/uploads/definitions.ts).

## Prerequisites

- Node.js 20 or newer
- pnpm 11 (the repository declares the exact package-manager version)
- PostgreSQL reachable from the development or deployment environment

## Local setup

Install dependencies:

```bash
pnpm install
```

Create a local `.env` file. Do not commit it.

Minimum configuration:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
SENTRY_SESSION_SECRET=replace-with-a-long-random-secret
```

The application also supports discrete database variables at runtime:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fohboh_sentry
DB_USER=postgres
DB_PASSWORD=replace-me
```

`DATABASE_URL` is still required by Prisma CLI operations such as migrations and client generation. SSL is enabled by default with certificate verification disabled for managed PostgreSQL compatibility. For a local database without SSL, set one of:

```dotenv
DB_SSLMODE=disable
PGSSLMODE=disable
```

Generate the Prisma client and apply committed migrations:

```bash
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

Start development:

```bash
pnpm dev
```

Open:

- Main application: `http://localhost:3000`
- SuperAdmin: `http://localhost:3000/superadmin`
- `/admin` redirects to `/superadmin`

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes for Prisma CLI; normally yes at runtime | PostgreSQL connection string |
| `DB_HOST`, `DB_NAME`, `DB_USER` | Alternative runtime configuration | Discrete PostgreSQL connection settings |
| `DB_PORT`, `DB_PASSWORD` | As needed with discrete configuration | PostgreSQL port and password |
| `SENTRY_SESSION_SECRET` | Required in production | HMAC secret for manager sessions |
| `AUTH_SECRET` | Alternative | Used when `SENTRY_SESSION_SECRET` is absent |
| `DB_SSLMODE` or `PGSSLMODE` | Optional | Set to `disable` for non-SSL local PostgreSQL |
| `SUPPORT_INBOX_EMAIL` | Optional | Destination for support-ticket notifications |
| `SUPPORT_FROM_EMAIL` | Optional | Verified sender for support email |
| `RESEND_API_KEY` | Optional | Enables support-ticket email through Resend |
| `VERCEL` | Set automatically by Vercel | Enables trust of Vercel's platform-controlled client-IP header |

Production startup rejects session creation when neither `SENTRY_SESSION_SECRET` nor `AUTH_SECRET` is configured. Use a long, unique secret stored in the hosting provider's secret manager.

### Rate limiting and trusted proxies

Rate-limit buckets are stored atomically in PostgreSQL so limits are shared by every application instance and persist across warm-instance rotation. Bucket keys are SHA-256 hashes; normalized account identifiers are not stored in plaintext. Expired buckets reset on their next use and can be removed by routine database maintenance using the indexed `reset_at` column.

Login limits use independent normalized-account and client-address buckets. Authenticated uploads, certifications, and location creation use independent manager-identity and address buckets. Login fails closed when the limiter store is unavailable; authenticated expensive operations fail open to preserve access for already authenticated users. Every store failure is logged as `rate_limit_store_failed`.

Client addresses are accepted only from Vercel's `x-vercel-forwarded-for` header when `VERCEL=1`. Generic `x-forwarded-for` and `x-real-ip` values are never trusted. Vercel must remain the public ingress and must overwrite the trusted header. Local and unsupported self-hosted deployments use the shared `unknown` address bucket; do not enable a custom proxy header without restricting direct access to the application and adding a verified trust policy.

Deploy migration `20260824_add_shared_rate_limits` before application code that uses the shared limiter. If the migration is missing, login intentionally fails closed with HTTP 429 while authenticated expensive operations continue under their documented fail-open policy.

## Authentication and authorization

Manager credentials are stored in the `managers` table. Passwords are bcrypt hashes and are never stored in plaintext.

Common roles include:

- `Manager`
- `Restaurant Owner` / `Owner` (normalized to manager behavior)
- `Viewer`
- `Admin`
- `WGS Manager`
- `SuperAdmin`

`Viewer` accounts cannot run certifications. WGS and SuperAdmin roles have broader operational visibility; ordinary accounts are restricted through manager ownership, memberships, account scope, and location assignments.

SuperAdmin authentication uses a database-backed manager with the `SuperAdmin` role. There is no shared hardcoded administrator password. To reset an existing manager password:

```bash
pnpm set-manager-password
```

## Main workflow

1. Sign in with a database-backed manager account.
2. Select or create a restaurant location.
3. Configure the active module and provider.
4. Upload each required artifact to that location and provider slot.
5. Review intake validation, detected format, schema, and extracted fields.
6. Seal the required schema and contract governance state.
7. Run exactly one module certification.
8. For M02, select the delivery provider being certified.
9. Review the persisted certification result and CAAR.
10. Download the report or claim pack when the release conditions are met.

Evidence uploads are limited to 4 MB so the complete multipart request stays below Vercel's 4.5 MB function-body limit. Support tickets accept at most five attachments, 2 MB each and 4 MB in aggregate. Each application instance admits at most 24 MB of concurrent multipart buffering; excess requests receive `503` with a short retry interval.

Files and generated artifacts are currently stored in the `object_blobs_v2` PostgreSQL table. A failed database write compensates by deleting any blob staged for that request. Operators can inspect unreferenced upload blobs older than 24 hours with `pnpm cleanup:upload-blobs` and delete only the reported objects with `pnpm cleanup:upload-blobs --apply`. The grace period protects in-flight writes. Larger uploads require a future direct-to-object-storage client upload flow rather than raising the function limit.

## Quality gate

Run the complete pre-commit and pre-release verification:

```bash
pnpm verify
```

This runs:

1. ESLint
2. Provider-aware CAAR scenarios
3. Toast and Uber Eats intake normalization
4. Legacy recovery-pack safety checks
5. The optimized Next.js production build and TypeScript validation

Individual commands:

```bash
pnpm lint
pnpm verify:caar-scenarios
pnpm verify:uber-eats-intake
pnpm verify:recovery-packs
pnpm build
```

The current gate passes. ESLint still reports 14 non-blocking unused-code warnings; it reports no errors.

## Test evidence

Test fixtures are stored in [`Test`](Test):

- `Test/MO1`: current M01 evidence and provider examples
- `Test/MO2`: current DoorDash, Uber Eats, and POS examples
- `Test/archives/CAAR-*`: complete, missing-bank, and invalid-schema safety scenarios
- `Test/archives/RECOVERY-*`: legacy synthetic recovery fixtures
- `Test/archives/QA-PizzaPalace`: extended multi-month QA documents

Important: the archived synthetic M02 recovery files use an older DoorDash schema. They are retained to prove that obsolete or invalid schemas do not generate recovery amounts. Current-format DoorDash and Uber Eats behavior is covered by the provider-aware CAAR and intake suites.

Do not use client production documents as committed fixtures unless they are explicitly approved and sanitized.

## Database and migrations

The Prisma schema is [`prisma/schema.prisma`](prisma/schema.prisma). Committed SQL migrations are under [`prisma/migrations`](prisma/migrations).

Important model groups include:

- Identity and legacy location source: `managers`, `restaurants`, `restaurant_sentry_state`
- Accounts and normalized locations: `customers`, `locations_v2`
- Team access: account memberships, member locations, invitations, and access requests
- Governance: `contract_configs_v2`, `schema_registry_v2`
- Evidence: `uploads_v2`, `object_blobs_v2`
- Certification: `cert_runs_v2`, `mq6_scores_v2`, `rule_citations_v2`
- CAAR output: `caars_v2`, `caar_artifacts_v2`, and legacy `caar_reports`
- Operations: audit logs, system-health events, support tickets, and billing foundations

Create migrations in development only after reviewing the generated SQL:

```bash
pnpm exec prisma migrate dev --name descriptive_change_name
```

Apply existing migrations in staging or production:

```bash
pnpm exec prisma migrate deploy
```

Before applying production migrations:

1. Confirm the target database and current migration status.
2. Take or verify a recoverable database backup.
3. Review the pending SQL, especially destructive or backfill operations.
4. Apply migrations before deploying code that depends on new columns or tables.
5. Run smoke tests after deployment.

## Deployment

The repository supports a standard Next.js deployment. `pnpm vercel-build` runs Prisma client generation followed by the production build.

Recommended deployment sequence:

1. Back up the production database.
2. Configure production environment variables and secrets.
3. Run `pnpm verify` against the release commit.
4. Run `pnpm exec prisma migrate deploy` against the intended production database.
5. Deploy the application.
6. Verify login, account/location isolation, uploads, one M01 run, vendor-scoped M02 runs, CAAR access, downloads, and SuperAdmin authorization.
7. Confirm support-email delivery if Resend is configured.

Never run `prisma migrate reset` against a shared, staging, or production database.

## Recovery checklist

Keep the following outside the repository in an approved password manager or client handoff system:

- Git remote and protected-branch access
- Hosting project and deployment access
- Production and staging database connection details
- Database backup location and restore procedure
- Session secret and optional support-email credentials
- Domain and DNS ownership
- SuperAdmin account recovery procedure

To recover development on a new machine:

1. Clone the repository and check out the intended branch.
2. Restore the approved `.env` values securely.
3. Install the declared Node.js and pnpm versions.
4. Run `pnpm install`.
5. Run `pnpm exec prisma generate`.
6. Run `pnpm verify`.
7. Start with `pnpm dev` and perform an authenticated smoke test.

## Code map

- Application entry: [`src/app/page.tsx`](src/app/page.tsx)
- Main client orchestration: [`src/components/sentry/SentryApp.tsx`](src/components/sentry/SentryApp.tsx)
- View routing: [`src/components/sentry/SentryViewRouter.tsx`](src/components/sentry/SentryViewRouter.tsx)
- Provider catalog: [`src/components/sentry/vendor-catalog.ts`](src/components/sentry/vendor-catalog.ts)
- Upload intake: [`src/lib/uploads/intake.ts`](src/lib/uploads/intake.ts)
- Upload persistence: [`src/lib/uploads/storage.ts`](src/lib/uploads/storage.ts)
- Authentication: [`src/lib/auth`](src/lib/auth)
- Certification service: [`src/lib/certification/service.ts`](src/lib/certification/service.ts)
- Rule engine: [`src/lib/mge/engine.ts`](src/lib/mge/engine.ts)
- CAAR persistence/access: [`src/lib/caar`](src/lib/caar)
- API routes: [`src/app/api`](src/app/api)
- SuperAdmin: [`src/app/superadmin`](src/app/superadmin)
- Database schema and migrations: [`prisma`](prisma)
- Verification scripts: [`scripts`](scripts)

## Known limitations and maintenance notes

- `SentryApp.tsx` remains a large orchestration component and should be decomposed incrementally.
- Fourteen unused-code warnings remain, although lint has no errors.
- The archived synthetic M02 recovery packs do not represent the current DoorDash export schema.
- Blob storage in PostgreSQL is operational but may require an external object-storage strategy as evidence volume grows.
- Email delivery is optional and remains `not_configured` unless all Resend variables are present.
- A provider catalog entry should not be treated as fully certified support without current-format fixtures and regression coverage.

When changing intake, vendor, certification, recovery, or CAAR behavior, update the corresponding fixtures and run `pnpm verify` before committing.
