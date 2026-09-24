-- Cencori gateway usage is billed at the configured provider rate. Keep the
-- legacy columns for API/schema compatibility, but prevent old rows and new
-- rows from advertising or reintroducing a platform surcharge.
ALTER TABLE public.model_pricing
    ALTER COLUMN cencori_markup_percentage SET DEFAULT 0;

UPDATE public.model_pricing
SET cencori_markup_percentage = 0
WHERE cencori_markup_percentage IS DISTINCT FROM 0;

ALTER TABLE public.gateway_image_pricing
    ALTER COLUMN cencori_markup_percentage SET DEFAULT 0;

UPDATE public.gateway_image_pricing
SET cencori_markup_percentage = 0
WHERE cencori_markup_percentage IS DISTINCT FROM 0;

ALTER TABLE public.custom_models
    ALTER COLUMN platform_fee_per_request SET DEFAULT 0;

UPDATE public.custom_models
SET platform_fee_per_request = 0
WHERE platform_fee_per_request IS DISTINCT FROM 0;
