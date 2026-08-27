ALTER TABLE public.uploads_v2
ADD COLUMN IF NOT EXISTS evidence_month CHAR(7);

ALTER TABLE public.uploads_v2
ADD CONSTRAINT uploads_v2_evidence_month_format
CHECK (evidence_month IS NULL OR evidence_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') NOT VALID;

CREATE INDEX IF NOT EXISTS idx_uploads_v2_monthly_artifact
ON public.uploads_v2(location_id, module, artifact_key, evidence_month);
