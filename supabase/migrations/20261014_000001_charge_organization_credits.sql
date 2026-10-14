-- Charge usage that was already served, in full, even past the balance.
--
-- deduct_organization_credits is all-or-nothing: when a charge exceeded the
-- remaining balance it refused ('Insufficient balance') and nothing was
-- recorded — but the request had already been answered. The balance then
-- never moved, so every following request passed the gateway's balance check
-- and was free too. Two orgs sat at fractions of a cent indefinitely; Arcie
-- was served ~$21.5 of usage against $15 of credit this way.
--
-- charge_organization_credits always records the real charge. If it's more
-- than the balance, the balance goes negative by the shortfall: that debt
-- blocks the next request at the gateway and the next top-up repays it first.
-- Idempotent on reference_id, so a retried request is never charged twice.
-- Service role only.

CREATE OR REPLACE FUNCTION public.charge_organization_credits(
    p_org_id        uuid,
    p_amount        numeric,
    p_description   text,
    p_reference_id  text DEFAULT NULL,
    p_metadata      jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_before    numeric;
    v_after     numeric;
    v_shortfall numeric;
    v_existing  numeric;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', true, 'charged', 0);
    END IF;

    -- Serialize charges per organization.
    SELECT credits_balance INTO v_before
    FROM public.organizations
    WHERE id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_message', 'Organization not found');
    END IF;

    -- Already charged for this request: report the current state, charge nothing.
    IF p_reference_id IS NOT NULL THEN
        SELECT balance_after INTO v_existing
        FROM public.credit_transactions
        WHERE organization_id = p_org_id
          AND transaction_type = 'usage'
          AND reference_id = p_reference_id
        LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'duplicate', true, 'new_balance', v_before);
        END IF;
    END IF;

    v_before := COALESCE(v_before, 0);
    v_after := v_before - p_amount;
    v_shortfall := GREATEST(0, p_amount - GREATEST(v_before, 0));

    UPDATE public.organizations
    SET credits_balance = v_after,
        credits_updated_at = now()
    WHERE id = p_org_id;

    INSERT INTO public.credit_transactions (
        organization_id, amount, transaction_type, description, reference_id,
        balance_before, balance_after, metadata
    ) VALUES (
        p_org_id, -p_amount, 'usage', p_description, p_reference_id,
        v_before, v_after,
        COALESCE(p_metadata, '{}'::jsonb)
            || CASE WHEN v_shortfall > 0 THEN jsonb_build_object('shortfall_usd', v_shortfall) ELSE '{}'::jsonb END
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_after,
        'shortfall', v_shortfall
    );
END;
$$;

REVOKE ALL ON FUNCTION public.charge_organization_credits(uuid, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_organization_credits(uuid, numeric, text, text, jsonb) TO service_role;
