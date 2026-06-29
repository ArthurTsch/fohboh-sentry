CREATE TABLE "caar_reports" (
  "id" SERIAL NOT NULL,
  "caar_id" VARCHAR(100) NOT NULL,
  "account_id" VARCHAR(255),
  "restaurant_id" INTEGER,
  "created_by" INTEGER,
  "location_id" VARCHAR(100) NOT NULL,
  "location_name" VARCHAR(255) NOT NULL,
  "period" VARCHAR(100) NOT NULL,
  "trust_score" INTEGER NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "amount_display" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "exhibits" INTEGER DEFAULT 0,
  "narrative" TEXT NOT NULL,
  "findings" JSONB NOT NULL,
  "dimensions" JSONB NOT NULL,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "caar_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "caar_reports_caar_id_key" ON "caar_reports"("caar_id");
CREATE INDEX "idx_caar_reports_account_id" ON "caar_reports"("account_id");
CREATE INDEX "idx_caar_reports_created_by" ON "caar_reports"("created_by");
CREATE INDEX "idx_caar_reports_location_id" ON "caar_reports"("location_id");
CREATE INDEX "idx_caar_reports_restaurant_id" ON "caar_reports"("restaurant_id");
