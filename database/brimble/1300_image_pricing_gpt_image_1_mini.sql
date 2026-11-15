-- gpt-image-1-mini, at the per-image prices on OpenAI's model page
-- (developers.openai.com/api/docs/models/gpt-image-1-mini, read 2026-11-15).
-- The image route charges only from an exact (model, size, quality) row and
-- answers 503 pricing_unavailable without one.
-- DALL-E 2 and 3 stay unpriced on purpose: OpenAI removed them on 2026-05-12.
-- Idempotent: runs before every deploy.

insert into public.gateway_image_pricing
    (provider, model_name, size, quality, price_per_image, cencori_markup_percentage, is_active)
values
    ('openai','gpt-image-1-mini','1024x1024','low',    0.00500000, 0, true),
    ('openai','gpt-image-1-mini','1024x1536','low',    0.00600000, 0, true),
    ('openai','gpt-image-1-mini','1536x1024','low',    0.00600000, 0, true),
    ('openai','gpt-image-1-mini','1024x1024','medium', 0.01100000, 0, true),
    ('openai','gpt-image-1-mini','1024x1536','medium', 0.01500000, 0, true),
    ('openai','gpt-image-1-mini','1536x1024','medium', 0.01500000, 0, true),
    ('openai','gpt-image-1-mini','1024x1024','high',   0.03600000, 0, true),
    ('openai','gpt-image-1-mini','1024x1536','high',   0.05200000, 0, true),
    ('openai','gpt-image-1-mini','1536x1024','high',   0.05200000, 0, true)
on conflict (provider, model_name, size, quality) do update set
    price_per_image = excluded.price_per_image,
    is_active = excluded.is_active,
    updated_at = now();
