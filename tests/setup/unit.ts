Object.assign(process.env, { NODE_ENV: "test" });
process.env.SENTRY_SESSION_SECRET = "unit-test-session-secret";
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:55432/fohboh_sentry_test";
process.env.DB_SSLMODE = "disable";
