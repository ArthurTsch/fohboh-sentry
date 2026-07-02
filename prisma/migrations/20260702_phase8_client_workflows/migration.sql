CREATE TABLE "support_tickets_v2" (
  "id" SERIAL NOT NULL,
  "external_id" VARCHAR(100) NOT NULL,
  "account_id" VARCHAR(255),
  "location_id" VARCHAR(100),
  "requester_email" VARCHAR(255) NOT NULL,
  "requester_name" VARCHAR(255),
  "requester_role" VARCHAR(50),
  "issue" TEXT NOT NULL,
  "priority" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "source" VARCHAR(50) NOT NULL DEFAULT 'support_chat',
  "created_by" INTEGER,
  "resolved_by" INTEGER,
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_tickets_v2_external_id_key" ON "support_tickets_v2"("external_id");
CREATE INDEX "idx_support_tickets_v2_account_status" ON "support_tickets_v2"("account_id", "status");
CREATE INDEX "idx_support_tickets_v2_status_priority" ON "support_tickets_v2"("status", "priority");
CREATE INDEX "idx_support_tickets_v2_created_by" ON "support_tickets_v2"("created_by");

CREATE TABLE "access_requests_v2" (
  "id" SERIAL NOT NULL,
  "external_id" VARCHAR(100) NOT NULL,
  "company" VARCHAR(255) NOT NULL,
  "requester_email" VARCHAR(255) NOT NULL,
  "requester_name" VARCHAR(255),
  "phone" VARCHAR(50),
  "locations" VARCHAR(100),
  "monthly_volume" VARCHAR(100),
  "modules" JSONB NOT NULL,
  "module_plan" VARCHAR(20) NOT NULL,
  "processors" JSONB,
  "dsps" JSONB,
  "notes" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "reviewed_by" INTEGER,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_requests_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_requests_v2_external_id_key" ON "access_requests_v2"("external_id");
CREATE INDEX "idx_access_requests_v2_status_created" ON "access_requests_v2"("status", "created_at");
CREATE INDEX "idx_access_requests_v2_email" ON "access_requests_v2"("requester_email");
