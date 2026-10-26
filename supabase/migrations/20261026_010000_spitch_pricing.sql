-- Spitch pricing was a placeholder ($0.03/1k chars TTS, $0.01/min STT) that
-- never matched how Spitch bills: $0.0014 per second of generated speech and
-- $0.00042 per second of transcribed audio (docs.spitch.app/concepts/pricing).
-- On Yoruba that placeholder recovered about a quarter of the TTS cost.
--
-- TTS is now billed per measured minute of returned audio; the per-character
-- rate is only the fallback when the audio can't be measured. Applied to
-- production by hand on 2026-10-26.

UPDATE model_pricing
SET price_per_minute = 0.10,
    price_per_1k_chars = 0.15,
    pricing_source_url = 'https://docs.spitch.app/concepts/pricing',
    pricing_reviewed_at = now(),
    review_notes = 'Spitch bills $0.0014/s ($0.084/min) of generated audio. Billed per measured audio minute at $0.10; $0.15/1k chars is the fallback when audio length cannot be measured.',
    updated_at = now()
WHERE provider = 'spitch' AND model_name = 'spitch-tts' AND is_active;

UPDATE model_pricing
SET price_per_minute = 0.035,
    pricing_source_url = 'https://docs.spitch.app/concepts/pricing',
    pricing_reviewed_at = now(),
    review_notes = 'Spitch bills $0.00042/s = $0.0252/min.',
    updated_at = now()
WHERE provider = 'spitch' AND model_name = 'spitch-stt' AND is_active;
