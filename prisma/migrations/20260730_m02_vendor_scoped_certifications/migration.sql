ALTER TABLE "cert_runs_v2"
ADD COLUMN IF NOT EXISTS "vendor" VARCHAR(100);

ALTER TABLE "caars_v2"
ADD COLUMN IF NOT EXISTS "vendor" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "idx_cert_runs_v2_location_module_vendor_period"
ON "cert_runs_v2" ("location_id", "module", "vendor", "period");

CREATE INDEX IF NOT EXISTS "idx_caars_v2_location_module_vendor_sealed"
ON "caars_v2" ("location_id", "module", "vendor", "sealed_at");
