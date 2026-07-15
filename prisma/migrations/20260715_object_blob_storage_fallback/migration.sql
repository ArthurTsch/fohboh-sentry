CREATE TABLE "public"."object_blobs_v2" (
  "id" SERIAL NOT NULL,
  "storage_key" TEXT NOT NULL,
  "bucket" VARCHAR(30) NOT NULL,
  "byte_count" BIGINT NOT NULL,
  "content_type" VARCHAR(100),
  "payload" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "object_blobs_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "object_blobs_v2_storage_key_key"
  ON "public"."object_blobs_v2"("storage_key");

CREATE INDEX "idx_object_blobs_v2_bucket"
  ON "public"."object_blobs_v2"("bucket");

CREATE INDEX "idx_object_blobs_v2_storage_key"
  ON "public"."object_blobs_v2"("storage_key");
