-- New paid top-ups must credit dollar-denominated wallets exactly once.
-- This does not modify or revalue any historical balance or transaction.
CREATE TABLE IF NOT EXISTS public.payment_credit_grants (
    provider text NOT NULL CHECK (provider IN ('bachs', 'coincircuit')),
    payment_reference text NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    amount numeric(30, 18) NOT NULL CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, payment_reference)
);

ALTER TABLE public.payment_credit_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_credit_grants FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_paid_credit_topup(
    p_provider text,
    p_payment_reference text,
    p_organization_id uuid,
    p_amount numeric,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (applied boolean, new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_balance numeric;
    v_existing public.payment_credit_grants%ROWTYPE;
    v_inserted integer;
BEGIN
    IF p_provider NOT IN ('bachs', 'coincircuit')
       OR nullif(btrim(p_payment_reference), '') IS NULL
       OR p_organization_id IS NULL
       OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN
        RAISE EXCEPTION 'Invalid paid credit top-up';
    END IF;

    SELECT coalesce(o.credits_balance, 0) INTO v_balance
    FROM public.organizations o
    WHERE o.id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Top-up organization not found';
    END IF;

    INSERT INTO public.payment_credit_grants
        (provider, payment_reference, organization_id, amount)
    VALUES (p_provider, p_payment_reference, p_organization_id, p_amount)
    ON CONFLICT (provider, payment_reference) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
        SELECT * INTO v_existing
        FROM public.payment_credit_grants g
        WHERE g.provider = p_provider
          AND g.payment_reference = p_payment_reference;

        IF v_existing.organization_id IS DISTINCT FROM p_organization_id
           OR v_existing.amount IS DISTINCT FROM p_amount THEN
            RAISE EXCEPTION 'Top-up payment reference was already used for a different grant';
        END IF;

        RETURN QUERY SELECT false, v_balance;
        RETURN;
    END IF;

    UPDATE public.organizations
    SET credits_balance = coalesce(credits_balance, 0) + p_amount,
        credits_updated_at = now()
    WHERE id = p_organization_id
    RETURNING credits_balance INTO v_balance;

    INSERT INTO public.credit_transactions (
        organization_id, amount, transaction_type, description,
        balance_before, balance_after, metadata, created_at
    ) VALUES (
        p_organization_id, p_amount, 'topup', 'Paid credits top-up',
        v_balance - p_amount, v_balance,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
            'payment_provider', p_provider,
            'payment_reference', p_payment_reference
        ),
        now()
    );

    RETURN QUERY SELECT true, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_paid_credit_topup(text, text, uuid, numeric, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_credit_topup(text, text, uuid, numeric, jsonb)
    TO service_role;
