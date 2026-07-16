ALTER TABLE "schema_registry_v2"
  ADD COLUMN IF NOT EXISTS "source_upload_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "prev_sha256" CHAR(64);
