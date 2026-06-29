ALTER TABLE "uploads_v2"
ADD COLUMN IF NOT EXISTS "artifact_key" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "validation_summary" JSONB;

UPDATE "uploads_v2"
SET "artifact_key" = COALESCE("artifact_key", "file_purpose")
WHERE "artifact_key" IS NULL;

ALTER TABLE "uploads_v2"
ALTER COLUMN "artifact_key" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_uploads_v2_location_module_artifact"
ON "uploads_v2"("location_id", "module", "artifact_key");
