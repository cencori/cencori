-- Retire GPT-4.1 Nano (removed from the catalog 2026-11-11).
--
-- OpenAI no longer serves it: on 2026-11-10 a chat call returned
-- "model_not_found ... has been deprecated". The gateway aliases the id before
-- billing (lib/providers/router.ts MODEL_ALIASES: gpt-4.1-nano -> gpt-5-nano),
-- so requests still naming it are served and priced as GPT-5 Nano; this row is
-- no longer looked up for new traffic.
--
-- Deactivate rather than delete: ai_requests rows still reference it
-- historically, and cost re-computation over old logs must keep resolving the
-- price that applied at the time.

UPDATE model_pricing
SET is_active = false,
    review_notes = 'Retired 2026-11-11: deprecated by OpenAI; aliased to gpt-5-nano.',
    updated_at = NOW()
WHERE provider = 'openai'
  AND model_name IN ('gpt-4.1-nano');
