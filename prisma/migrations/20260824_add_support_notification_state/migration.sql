ALTER TABLE "support_tickets_v2"
  ADD COLUMN "notification_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN "notification_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notification_error" VARCHAR(255),
  ADD COLUMN "notification_last_attempt_at" TIMESTAMPTZ(6);

UPDATE "support_tickets_v2"
SET "notification_status" = CASE
  WHEN "source" = 'support_ticket_portal_email_ready' THEN 'prepared'
  ELSE 'not_configured'
END
WHERE "source" IN ('support_ticket_portal', 'support_ticket_portal_email_ready');

CREATE INDEX "idx_support_tickets_v2_notification_status"
  ON "support_tickets_v2" ("notification_status", "notification_last_attempt_at");
