/**
 * Cencori's margin on managed model usage: every call paid from credits is
 * charged at the provider's cost plus this percentage. BYOK, sponsored and
 * free models are charged nothing, so the markup never applies to them
 * (callers apply it only where they charge the provider cost).
 *
 * Set 2026-11-07. Before this, usage was charged at cost and the only margin
 * was the one-time top-up fee, which Bachs's card fees can exceed on small
 * dollar top-ups.
 */
export const USAGE_MARKUP_PERCENT = 5;

/** What the customer is charged for a managed call that cost the provider `providerCostUsd`. */
export function withUsageMarkup(providerCostUsd: number): number {
    if (!Number.isFinite(providerCostUsd) || providerCostUsd <= 0) return 0;
    return providerCostUsd * (1 + USAGE_MARKUP_PERCENT / 100);
}
