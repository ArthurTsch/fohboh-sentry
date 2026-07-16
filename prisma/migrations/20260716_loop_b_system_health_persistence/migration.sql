CREATE TABLE "public"."loop_b_findings_v2" (
    "id" SERIAL NOT NULL,
    "location_id" INTEGER NOT NULL,
    "caar_id" INTEGER,
    "module" VARCHAR(10) NOT NULL,
    "rule_id" VARCHAR(20) NOT NULL,
    "pattern_code" VARCHAR(100) NOT NULL,
    "confidence_bps" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "caar_eligible" BOOLEAN NOT NULL DEFAULT false,
    "impacts_certification" BOOLEAN NOT NULL DEFAULT false,
    "affected_periods" JSONB NOT NULL,
    "detail" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loop_b_findings_v2_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."system_health_events_v2" (
    "id" SERIAL NOT NULL,
    "location_id" INTEGER NOT NULL,
    "caar_id" INTEGER,
    "cert_run_ids" JSONB,
    "rule_id" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "impacts_trust" BOOLEAN NOT NULL DEFAULT false,
    "detail" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "system_health_events_v2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_loop_b_findings_v2_location_created_at"
ON "public"."loop_b_findings_v2"("location_id", "created_at");

CREATE INDEX "idx_loop_b_findings_v2_caar_id"
ON "public"."loop_b_findings_v2"("caar_id");

CREATE INDEX "idx_loop_b_findings_v2_rule_id"
ON "public"."loop_b_findings_v2"("rule_id");

CREATE INDEX "idx_system_health_events_v2_location_created_at"
ON "public"."system_health_events_v2"("location_id", "created_at");

CREATE INDEX "idx_system_health_events_v2_caar_id"
ON "public"."system_health_events_v2"("caar_id");

CREATE INDEX "idx_system_health_events_v2_rule_id"
ON "public"."system_health_events_v2"("rule_id");
