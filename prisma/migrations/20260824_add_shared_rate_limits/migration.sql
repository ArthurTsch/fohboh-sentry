CREATE TABLE public.rate_limit_buckets (
  key_hash VARCHAR(64) PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ(6) NOT NULL,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_buckets_reset_at
  ON public.rate_limit_buckets(reset_at);
