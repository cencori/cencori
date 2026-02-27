-- Increase credit precision for token-level billing accuracy.
-- Some model requests cost fractions of a cent and need > 2 decimal places.

DO $$
BEGIN
  -- organizations.credits_balance
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'credits_balance'
  ) THEN
    ALTER TABLE public.organizations
      ALTER COLUMN credits_balance TYPE numeric(14, 6)
      USING round(credits_balance::numeric, 6);
  END IF;

  -- credit_transactions amounts/balances
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'credit_transactions'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'credit_transactions'
        AND column_name = 'amount'
    ) THEN
      ALTER TABLE public.credit_transactions
        ALTER COLUMN amount TYPE numeric(14, 6)
        USING round(amount::numeric, 6);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'credit_transactions'
        AND column_name = 'balance_before'
    ) THEN
      ALTER TABLE public.credit_transactions
        ALTER COLUMN balance_before TYPE numeric(14, 6)
        USING round(balance_before::numeric, 6);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'credit_transactions'
        AND column_name = 'balance_after'
    ) THEN
      ALTER TABLE public.credit_transactions
        ALTER COLUMN balance_after TYPE numeric(14, 6)
        USING round(balance_after::numeric, 6);
    END IF;
  END IF;
END $$;
