# Testing

## Fast verification

`pnpm test` runs Vitest unit and API-contract tests. `pnpm verify` includes these tests with lint and the production build. The legacy fixture scenarios remain available through `pnpm verify:fixture-scenarios`; they require the external `Test/` fixture archive, which is not checked into this repository.

## Disposable PostgreSQL integration tests

Integration tests refuse to run unless `TEST_DATABASE_URL` points to a database whose name contains `test`.

1. Start PostgreSQL: `docker compose -f docker-compose.test.yml up -d --wait`
2. Set `TEST_DATABASE_URL` and `DATABASE_URL` from `test.env.example`.
3. Apply migrations: `pnpm prisma migrate deploy`
4. Run: `pnpm test:integration`

The Docker database uses tmpfs and is disposable. Never use production credentials.

## Browser smoke tests

Install Chromium once with `pnpm test:e2e:install`, then run `pnpm test:e2e`. The harness starts the app on port 3100 unless `PLAYWRIGHT_BASE_URL` is set. Anonymous access-boundary tests always run. Set `E2E_MANAGER_EMAIL` and `E2E_MANAGER_PASSWORD`, then run `pnpm seed:test` against the disposable test database for the authenticated critical-navigation test. The CI workflow seeds test-only credentials automatically.

## Release gate

`pnpm verify:release` runs the normal verification gate, PostgreSQL integration tests, and Playwright.
