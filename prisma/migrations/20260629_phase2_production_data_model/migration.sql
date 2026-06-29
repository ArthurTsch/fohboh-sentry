CREATE TABLE "customers" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "plan" VARCHAR(50) NOT NULL DEFAULT 'wgs',
  "cortex_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ NULL,

  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_customers_name" ON "customers"("name");

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "customer_id" INTEGER NULL,
  "auth0_sub" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "role" VARCHAR(50) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMPTZ NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_auth0_sub_key" ON "users"("auth0_sub");
CREATE INDEX "idx_users_customer_id" ON "users"("customer_id");
CREATE INDEX "idx_users_email" ON "users"("email");

CREATE TABLE "locations_v2" (
  "id" SERIAL NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "external_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NULL,
  "pos_system" VARCHAR(50) NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'onboarding',
  "activated_at" TIMESTAMPTZ NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ NULL,

  CONSTRAINT "locations_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_locations_v2_customer_external_id" ON "locations_v2"("customer_id", "external_id");
CREATE INDEX "idx_locations_v2_customer_status" ON "locations_v2"("customer_id", "status");

CREATE TABLE "location_modules" (
  "id" SERIAL NOT NULL,
  "location_id" INTEGER NOT NULL,
  "module" VARCHAR(10) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "activated_at" TIMESTAMPTZ NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "location_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_location_modules_location_module" ON "location_modules"("location_id", "module");
CREATE INDEX "idx_location_modules_location_id" ON "location_modules"("location_id");

CREATE TABLE "contract_configs_v2" (
  "id" SERIAL NOT NULL,
  "location_id" INTEGER NOT NULL,
  "module" VARCHAR(10) NOT NULL,
  "version" INTEGER NOT NULL,
  "terms" JSONB NOT NULL,
  "sealed_by" INTEGER NOT NULL,
  "sealed_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "sha256" CHAR(64) NOT NULL,
  "prev_sha256" CHAR(64) NULL,

  CONSTRAINT "contract_configs_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_contract_configs_v2_location_module_version" ON "contract_configs_v2"("location_id", "module", "version");
CREATE INDEX "idx_contract_configs_v2_location_module_version" ON "contract_configs_v2"("location_id", "module", "version");

CREATE TABLE "schema_registry_v2" (
  "id" SERIAL NOT NULL,
  "location_id" INTEGER NOT NULL,
  "module" VARCHAR(10) NOT NULL,
  "vendor" VARCHAR(100) NOT NULL,
  "version" INTEGER NOT NULL,
  "fields" JSONB NOT NULL,
  "sealed_by" INTEGER NOT NULL,
  "sealed_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "sha256" CHAR(64) NOT NULL,

  CONSTRAINT "schema_registry_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_schema_registry_v2_location_module_vendor_version" ON "schema_registry_v2"("location_id", "module", "vendor", "version");
CREATE INDEX "idx_schema_registry_v2_location_module_vendor_version" ON "schema_registry_v2"("location_id", "module", "vendor", "version");

CREATE TABLE "uploads_v2" (
  "id" SERIAL NOT NULL,
  "location_id" INTEGER NOT NULL,
  "module" VARCHAR(10) NOT NULL,
  "file_purpose" VARCHAR(100) NOT NULL,
  "vendor" VARCHAR(100) NULL,
  "file_name" TEXT NOT NULL,
  "s3_key" TEXT NOT NULL,
  "byte_count" BIGINT NOT NULL,
  "row_count" INTEGER NULL,
  "page_count" INTEGER NULL,
  "sha256" CHAR(64) NOT NULL,
  "uploaded_by" INTEGER NOT NULL,
  "uploaded_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "superseded_by" INTEGER NULL,

  CONSTRAINT "uploads_v2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_uploads_v2_location_module" ON "uploads_v2"("location_id", "module");
CREATE INDEX "idx_uploads_v2_sha256" ON "uploads_v2"("sha256");

CREATE TABLE "cert_runs_v2" (
  "id" SERIAL NOT NULL,
  "location_id" INTEGER NOT NULL,
  "module" VARCHAR(10) NOT NULL,
  "period" VARCHAR(50) NOT NULL,
  "contract_config_id" INTEGER NOT NULL,
  "schema_registry_ids" JSONB NOT NULL,
  "upload_ids" JSONB NOT NULL,
  "rule_set_version" VARCHAR(100) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'queued',
  "started_at" TIMESTAMPTZ NULL,
  "completed_at" TIMESTAMPTZ NULL,
  "trust_score" INTEGER NULL,
  "variance_cents" BIGINT NULL,
  "triggered_by" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "error_message" TEXT NULL,

  CONSTRAINT "cert_runs_v2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_cert_runs_v2_location_module_period" ON "cert_runs_v2"("location_id", "module", "period");
CREATE INDEX "idx_cert_runs_v2_status" ON "cert_runs_v2"("status");

CREATE TABLE "caars_v2" (
  "id" SERIAL NOT NULL,
  "caar_external_id" TEXT NOT NULL,
  "cert_run_id" INTEGER NOT NULL,
  "location_id" INTEGER NOT NULL,
  "module" VARCHAR(10) NOT NULL,
  "period" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "court_admissible" BOOLEAN NOT NULL DEFAULT false,
  "trust_score" INTEGER NOT NULL,
  "finding_class" VARCHAR(100) NOT NULL,
  "recoverable_variance_cents" BIGINT NOT NULL,
  "canonical_payload_s3_key" TEXT NOT NULL,
  "pdf_s3_key" TEXT NULL,
  "exportpack_s3_key" TEXT NULL,
  "sha256" CHAR(64) NOT NULL,
  "prev_sha256" CHAR(64) NULL,
  "sealed_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "superseded_by" INTEGER NULL,
  "superseded_reason" TEXT NULL,

  CONSTRAINT "caars_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "caars_v2_caar_external_id_key" ON "caars_v2"("caar_external_id");
CREATE UNIQUE INDEX "caars_v2_cert_run_id_key" ON "caars_v2"("cert_run_id");
CREATE INDEX "idx_caars_v2_location_sealed_at" ON "caars_v2"("location_id", "sealed_at");
CREATE INDEX "idx_caars_v2_status" ON "caars_v2"("status");
CREATE INDEX "idx_caars_v2_external_id" ON "caars_v2"("caar_external_id");

CREATE TABLE "caar_artifacts_v2" (
  "id" SERIAL NOT NULL,
  "caar_id" INTEGER NOT NULL,
  "seq" INTEGER NOT NULL,
  "artifact_type" VARCHAR(100) NOT NULL,
  "name" TEXT NOT NULL,
  "s3_key" TEXT NOT NULL,
  "byte_count" BIGINT NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "caar_artifacts_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_caar_artifacts_v2_caar_seq" ON "caar_artifacts_v2"("caar_id", "seq");

CREATE TABLE "rule_citations_v2" (
  "id" SERIAL NOT NULL,
  "cert_run_id" INTEGER NOT NULL,
  "rule_id" VARCHAR(100) NOT NULL,
  "rule_version" VARCHAR(50) NOT NULL,
  "fired_count" INTEGER NOT NULL DEFAULT 0,
  "variance_cents" BIGINT NOT NULL DEFAULT 0,
  "sample_evidence" JSONB NULL,

  CONSTRAINT "rule_citations_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_rule_citations_v2_cert_run_rule" ON "rule_citations_v2"("cert_run_id", "rule_id");
CREATE INDEX "idx_rule_citations_v2_cert_run_id" ON "rule_citations_v2"("cert_run_id");
CREATE INDEX "idx_rule_citations_v2_rule_id" ON "rule_citations_v2"("rule_id");

CREATE TABLE "mq6_scores_v2" (
  "id" SERIAL NOT NULL,
  "cert_run_id" INTEGER NOT NULL,
  "dimension" VARCHAR(50) NOT NULL,
  "score" INTEGER NOT NULL,
  "weight_bps" INTEGER NOT NULL,
  "evidence" JSONB NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mq6_scores_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_mq6_scores_v2_cert_run_dimension" ON "mq6_scores_v2"("cert_run_id", "dimension");
CREATE INDEX "idx_mq6_scores_v2_cert_run_id" ON "mq6_scores_v2"("cert_run_id");

CREATE TABLE "audit_log_v2" (
  "id" SERIAL NOT NULL,
  "customer_id" INTEGER NULL,
  "location_id" INTEGER NULL,
  "actor_user_id" INTEGER NULL,
  "action" TEXT NOT NULL,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" VARCHAR(100) NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB NULL,
  "ip_address" VARCHAR(64) NULL,
  "user_agent" TEXT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_log_v2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_audit_log_v2_customer_id" ON "audit_log_v2"("customer_id");
CREATE INDEX "idx_audit_log_v2_location_id" ON "audit_log_v2"("location_id");
CREATE INDEX "idx_audit_log_v2_actor_user_id" ON "audit_log_v2"("actor_user_id");
CREATE INDEX "idx_audit_log_v2_entity" ON "audit_log_v2"("entity_type", "entity_id");
