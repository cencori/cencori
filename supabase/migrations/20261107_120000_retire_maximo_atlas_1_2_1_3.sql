-- Retire Maximo Atlas 1.2 and 1.3 (removed from the catalog 2026-11-07).
--
-- Atlas 1.4 and 1.5 replace them. The gateway aliases the old ids before
-- billing (lib/providers/router.ts MODEL_ALIASES: 1.2 -> 1.5, 1.3 -> 1.4), so
-- requests still naming them are served and priced as the successor; these
-- rows are no longer looked up for new traffic.
--
-- Deactivate rather than delete: ai_requests rows still reference 1.2/1.3
-- historically, and cost re-computation over old logs must keep resolving the
-- price that applied at the time.

UPDATE model_pricing
SET is_active = false,
    review_notes = 'Retired 2026-11-07: removed from the catalog; aliased to 1.5 (from 1.2) and 1.4 (from 1.3).',
    updated_at = NOW()
WHERE provider = 'maximo'
  AND model_name IN ('maximo-atlas-1.2', 'maximo-atlas-1.3');
