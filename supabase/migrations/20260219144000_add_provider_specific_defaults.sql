-- Migration to add per-provider default models to provider_keys table
-- This enables high-availability failover by allowing Cencori to know
-- which specific model to use for each provider in the failover chain.

ALTER TABLE public.provider_keys
ADD COLUMN IF NOT EXISTS default_model text,
ADD COLUMN IF NOT EXISTS default_image_model text;

-- Add comments for documentation
COMMENT ON COLUMN public.provider_keys.default_model IS 'The preferred chat model to use for this specific provider';
COMMENT ON COLUMN public.provider_keys.default_image_model IS 'The preferred image model to use for this specific provider';
