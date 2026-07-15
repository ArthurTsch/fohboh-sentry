ALTER TABLE public.managers
  ADD COLUMN IF NOT EXISTS title varchar(100),
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_method varchar(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS notify_caar_certified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_trust_score_blocked boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_statement_due boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_weekly_digest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_access_changes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz(6) DEFAULT now();

UPDATE public.managers
SET
  two_factor_enabled = COALESCE(two_factor_enabled, false),
  two_factor_method = COALESCE(NULLIF(two_factor_method, ''), 'none'),
  notify_caar_certified = COALESCE(notify_caar_certified, true),
  notify_trust_score_blocked = COALESCE(notify_trust_score_blocked, true),
  notify_statement_due = COALESCE(notify_statement_due, true),
  notify_weekly_digest = COALESCE(notify_weekly_digest, false),
  notify_access_changes = COALESCE(notify_access_changes, true),
  updated_at = COALESCE(updated_at, now());
