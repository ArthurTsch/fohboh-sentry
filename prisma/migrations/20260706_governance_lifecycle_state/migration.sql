ALTER TABLE "restaurant_sentry_state"
ADD COLUMN IF NOT EXISTS "governance_status" VARCHAR(30) NOT NULL DEFAULT 'uninitialized',
ADD COLUMN IF NOT EXISTS "governance_initialized_at" TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS "governance_sealed_at" TIMESTAMP(6);

UPDATE "restaurant_sentry_state"
SET
  "governance_status" = CASE
    WHEN COALESCE("completed", false) = true THEN 'sealed'
    WHEN "modules_json" IS NOT NULL THEN 'draft'
    ELSE 'uninitialized'
  END,
  "governance_initialized_at" = COALESCE("governance_initialized_at", "created_at"),
  "governance_sealed_at" = CASE
    WHEN COALESCE("completed", false) = true THEN COALESCE("governance_sealed_at", "updated_at", "created_at")
    ELSE NULL
  END
WHERE "governance_status" = 'uninitialized';
