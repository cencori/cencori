-- Migration: Tiered Pricing Primitives
-- Description: Adds support for sophisticated pricing models (flat, tiered, volume).
-- Created: 2026-05-06

DO $$
BEGIN
    -- 1. Add pricing_model column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rate_plans' AND column_name = 'pricing_model'
    ) THEN
        ALTER TABLE public.rate_plans ADD COLUMN pricing_model TEXT DEFAULT 'flat'
            CHECK (pricing_model IN ('flat', 'tiered', 'volume'));
    END IF;

    -- 2. Add pricing_tiers column (JSONB)
    -- Structure: [{ "up_to": 1000000, "unit_amount": 0.00001 }, { "up_to": null, "unit_amount": 0.000008 }]
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rate_plans' AND column_name = 'pricing_tiers'
    ) THEN
        ALTER TABLE public.rate_plans ADD COLUMN pricing_tiers JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- 3. Add commitment_level (for annual/monthly commitments)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rate_plans' AND column_name = 'commitment_amount_usd'
    ) THEN
        ALTER TABLE public.rate_plans ADD COLUMN commitment_amount_usd NUMERIC(30, 18) DEFAULT 0;
    END IF;

END $$;
