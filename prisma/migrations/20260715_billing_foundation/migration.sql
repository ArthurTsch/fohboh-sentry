CREATE TABLE IF NOT EXISTS public.billing_accounts_v2 (
  id serial PRIMARY KEY,
  account_id varchar(255) NOT NULL UNIQUE,
  plan_code varchar(50) NOT NULL DEFAULT 'm01_m02_bundle',
  subscription_cents integer NOT NULL DEFAULT 29900,
  fee_rate_bps integer NOT NULL DEFAULT 1250,
  autopay_enabled boolean NOT NULL DEFAULT false,
  cycle_day integer NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_v2_account_id
  ON public.billing_accounts_v2(account_id);

CREATE TABLE IF NOT EXISTS public.payment_methods_v2 (
  id serial PRIMARY KEY,
  account_id varchar(255) NOT NULL,
  method_type varchar(30) NOT NULL,
  provider varchar(50) NULL,
  brand varchar(50) NULL,
  masked_label varchar(100) NOT NULL,
  billing_name varchar(255) NULL,
  expires_month integer NULL,
  expires_year integer NULL,
  status varchar(30) NOT NULL DEFAULT 'pending',
  is_primary boolean NOT NULL DEFAULT false,
  token_reference varchar(255) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_v2_account_status
  ON public.payment_methods_v2(account_id, status);

CREATE TABLE IF NOT EXISTS public.billing_statements_v2 (
  id serial PRIMARY KEY,
  statement_id varchar(100) NOT NULL UNIQUE,
  account_id varchar(255) NOT NULL,
  period_label varchar(50) NOT NULL,
  subscription_cents integer NOT NULL DEFAULT 0,
  caar_fee_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'draft',
  due_on timestamptz NULL,
  paid_on timestamptz NULL,
  source varchar(30) NOT NULL DEFAULT 'derived',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_statements_v2_account_period
  ON public.billing_statements_v2(account_id, period_label);

CREATE INDEX IF NOT EXISTS idx_billing_statements_v2_account_status
  ON public.billing_statements_v2(account_id, status);
