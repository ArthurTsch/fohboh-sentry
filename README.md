# FohBoh Sentry

FohBoh Sentry is a Next.js application for manager login, restaurant/location administration, location-scoped document uploads, certification workflow testing, and CAAR preparation.

This README is written for client use of the current state of the app.

## What The App Does

- Manager login against the `managers` table in PostgreSQL
- Hidden admin area for managing `managers` and `restaurants`
- Restaurant ownership tied to the `created_by` manager id
- Location Waterfall driven from restaurant records in the database
- Location-scoped upload workflow for M01 and M02 evidence
- Certification run simulation and CAAR view generation inside the app
- Test upload pack in the local `Test` folder

## Current Main Flows

### 1. Manager Login

- Open `http://localhost:3000`
- Log in with a manager account stored in the `managers` table
- Passwords are checked with bcrypt against `password_hash`

Allowed manager roles:

- `Manager`
- `Restaurant Owner`
- `Owner`
- `Admin`
- `Viewer`
- `WGS Manager`

Role mapping in the app:

- `Restaurant Owner` and `Owner` are treated as `Manager`
- `WGS Manager` has global support visibility

### 2. Hidden Admin Area

- Open `http://localhost:3000/admin`
- Use the admin password:
  - `FohbohSentry2026!`

Inside admin:

- `Overview`: hidden landing page for admin sections
- `Managers`: create, edit, and delete manager accounts
- `Restaurants`: create, edit, and delete restaurant records

Important:

- The admin route is intentionally not linked in the public UI
- Restaurant ownership is controlled by the `Created By` field in admin
- A restaurant appears to the corresponding logged-in manager when `restaurants.created_by` matches that manager's id

### 3. Add Location

For a logged-in manager:

- Open `Location Waterfall`
- Click `Add Location`
- Complete the onboarding modal

What happens:

- A new restaurant row is created in the database
- The row is assigned to the current logged-in manager
- The location appears in that manager's Waterfall
- Uploads for that location are kept separate from other locations

### 4. Upload Data

Uploads are location-specific.

How to use:

- Open `Location Waterfall`
- Click `Upload Data` on the specific location row you want
- Upload files inside that location's M01 or M02 workflow

Current upload behavior:

- Upload target is scoped to the selected location
- Each document card has its own status:
  - `Pending`
  - `Uploading`
  - `Uploaded`
  - `Review`
  - `Failed`
- The page also shows a `Recent Upload` summary

### 5. Certification / CAAR

Current certification is an in-app workflow, not a live external certification engine.

How to test:

- Upload the required location evidence
- Run certification from the Waterfall row or the main action
- Open the CAAR view for the generated report

Current status:

- This is suitable for product demo, UX validation, and workflow testing
- It is not yet a production legal/reporting backend

## Test Files

A ready test pack is available in the local [Test](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test) folder.

Included:

- M01 Heartland processor CSV
- M01 Heartland POS CSV
- M02 DoorDash settlement CSV
- M02 DoorDash POS summary CSV
- M02 DoorDash agreement PDF
- M02 bank statement PDF

Recommended usage:

1. Create or open one location
2. Use all test files on that same location
3. Run the upload flow
4. Run certification
5. Open CAAR

See [Test/README.md](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/Test/README.md) for the exact file list.

## Local Setup

### Prerequisites

- Node.js
- `pnpm`
- PostgreSQL database reachable from this machine

### Install

```bash
pnpm install
```

### Environment

The app needs database credentials.

Supported database configuration:

1. `DATABASE_URL`
2. Or direct values:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`

Optional SSL controls:

- `DB_SSLMODE=disable`
- or `PGSSLMODE=disable`

Without valid database variables, the app will fail on startup.

### Run Development Server

```bash
pnpm dev
```

Open:

- App: `http://localhost:3000`
- Hidden admin: `http://localhost:3000/admin`

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

## Password Management

Manager passwords are stored as bcrypt hashes.

There is a helper script in `package.json`:

```bash
pnpm set-manager-password
```

Use this when a manager exists in the database and their password needs to be reset in a valid hashed format.

## Database Tables Used By The Current App

Primary tables currently used in app workflows:

- `managers`
- `restaurants`

The Prisma schema also includes additional operational tables such as:

- `store_sales`
- `store_inventory`
- `store_menu`
- `store_employees`
- `store_analytics_results`
- `store_credentials`
- `store_embeddings`
- `text_notes`

Those extra tables are present in the schema but are not the main driver of the current Sentry UX.

## Current Production Notes

What is production-ready enough for controlled client use:

- manager auth against database records
- hidden admin CRUD for managers and restaurants
- manager-owned restaurant visibility
- location-scoped uploads
- upload feedback/status UX

What is still product/demo-stage rather than final enterprise backend:

- certification scoring logic
- CAAR generation logic
- schema governance and vault behavior
- legal/report finalization
- advanced workflow branches from the original HTML that may still be UI-only

## Support / Hand-off Notes

Key code areas:

- App shell and workflow state:
  - [src/components/sentry/SentryApp.tsx](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/src/components/sentry/SentryApp.tsx)
- Upload UI:
  - [src/components/sentry/views/UploadCenterView.tsx](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/src/components/sentry/views/UploadCenterView.tsx)
- Admin auth:
  - [src/lib/admin-auth.ts](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/src/lib/admin-auth.ts)
- Manager auth:
  - [src/lib/auth/manager-auth.ts](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/src/lib/auth/manager-auth.ts)
- Prisma connection:
  - [src/lib/prisma.ts](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/src/lib/prisma.ts)
- Prisma schema:
  - [prisma/schema.prisma](/abs/path/C:/Users/Kasutaja/Documents/arthur_dev/fohboh-sentry/prisma/schema.prisma)

## Known Minor Dev Warnings

At the time of writing, `pnpm lint` still reports 2 non-blocking warnings:

- unused `onOpenChecklist` in `UploadCenterView.tsx`
- unused `getTrustTone` import in `WaterfallView.tsx`
