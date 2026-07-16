ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS account_id varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_account_id
  ON public.customers(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_account_id
  ON public.customers(account_id);
