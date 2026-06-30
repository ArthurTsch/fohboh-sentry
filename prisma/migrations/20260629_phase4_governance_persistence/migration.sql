ALTER TABLE "contract_configs_v2"
ADD COLUMN IF NOT EXISTS "vendor" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'sealed',
ADD COLUMN IF NOT EXISTS "source_upload_id" INTEGER;

UPDATE "contract_configs_v2"
SET "vendor" = COALESCE("vendor", 'global')
WHERE "vendor" IS NULL;

ALTER TABLE "contract_configs_v2"
ALTER COLUMN "vendor" SET NOT NULL;

ALTER TABLE "schema_registry_v2"
ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'sealed',
ADD COLUMN IF NOT EXISTS "sample_headers" JSONB;

DROP INDEX IF EXISTS "idx_contract_configs_v2_location_module_version";
DROP INDEX IF EXISTS "uq_contract_configs_v2_location_module_version";
ALTER TABLE "contract_configs_v2"
DROP CONSTRAINT IF EXISTS "uq_contract_configs_v2_location_module_version";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_configs_v2_location_module_vendor_version"
ON "contract_configs_v2"("location_id", "module", "vendor", "version");

CREATE INDEX IF NOT EXISTS "idx_contract_configs_v2_location_module_vendor_version"
ON "contract_configs_v2"("location_id", "module", "vendor", "version");
