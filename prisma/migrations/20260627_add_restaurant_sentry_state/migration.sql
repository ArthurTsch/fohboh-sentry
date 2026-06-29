CREATE TABLE "restaurant_sentry_state" (
  "id" SERIAL NOT NULL,
  "restaurant_id" INTEGER NOT NULL,
  "location_id" VARCHAR(100) NOT NULL,
  "account_id" VARCHAR(255),
  "created_by" INTEGER,
  "status" VARCHAR(50) NOT NULL DEFAULT 'Onboarding',
  "m01_score" INTEGER NOT NULL DEFAULT 0,
  "m02_score" INTEGER NOT NULL DEFAULT 0,
  "ium" VARCHAR(50) DEFAULT '--',
  "recovery_display" VARCHAR(50) DEFAULT '$0',
  "last_certified" VARCHAR(50) DEFAULT 'Pending',
  "modules_json" JSONB,
  "onboarding_progress" JSONB,
  "onboarding_checklist" JSONB,
  "completed" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "restaurant_sentry_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "restaurant_sentry_state_restaurant_id_key" ON "restaurant_sentry_state"("restaurant_id");
CREATE UNIQUE INDEX "restaurant_sentry_state_location_id_key" ON "restaurant_sentry_state"("location_id");
CREATE INDEX "idx_restaurant_sentry_state_account_id" ON "restaurant_sentry_state"("account_id");
CREATE INDEX "idx_restaurant_sentry_state_created_by" ON "restaurant_sentry_state"("created_by");
