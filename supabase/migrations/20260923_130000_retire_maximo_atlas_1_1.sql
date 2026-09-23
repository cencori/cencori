-- Retire Maximo Atlas 1.1 (removed 2026-09-23).
--
-- Maximo's live /models serves 1.2/1.3/1.4 (plus the Pandora family) — 1.1 is
-- gone, so every request for it 404s upstream. Atlas 1.3/1.4 are deliberately
-- NOT added: Maximo publishes no rate for them yet, and an unpriced catalog row
-- only trades a missing model for a 503.
--
-- Deactivate rather than delete: ai_requests rows still reference 1.1
-- historically, and cost re-computation over old logs must keep resolving the
-- price that applied at the time.

UPDATE model_pricing
SET is_active = false,
    review_notes = 'Retired 2026-09-23: removed from Maximo live catalog (1.2/1.3/1.4 served).',
    updated_at = NOW()
WHERE provider = 'maximo'
  AND model_name IN ('maximo-atlas-1.1');
