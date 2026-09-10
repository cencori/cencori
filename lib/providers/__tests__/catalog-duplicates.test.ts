import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '../config';
import { publicProviderLabel } from '../branding';

/**
 * Duplicate catalog row guard.
 *
 * components/models/ModelCatalog.tsx builds its table by flattening every
 * provider's `models` array with no de-duplication, so a model id listed under
 * two providers renders as two rows. That is usually survivable — the rows at
 * least name different providers — but not for free models: publicProviderLabel
 * brands every free model "Cencori", so both rows show the same id, the same
 * provider and the same FREE badge, with nothing to tell them apart.
 *
 * That is exactly what happened to `glm-5.3-flash`. It was listed under `zai`
 * for branding and again under `bai` (the provider that actually serves it) on
 * the belief that the pricing catalog test needed a catalog entry per pricing
 * row. It does not — that test reads the reviewed-pricing migration, which has
 * no `bai` rows — so the second entry bought nothing and cost a phantom row in
 * the customer-facing catalog.
 *
 * The fix is structural: a backend provider carries pricing rows and routing
 * overrides, never catalog entries. This test holds that line.
 */
describe('catalog has no duplicate model ids', () => {
    const rows = SUPPORTED_PROVIDERS.flatMap(p => p.models.map(m => ({ provider: p.id, id: m.id, free: m.free })));

    it('lists every model id exactly once', () => {
        const byId = new Map<string, string[]>();
        for (const row of rows) byId.set(row.id, [...(byId.get(row.id) ?? []), row.provider]);

        const duplicates = [...byId]
            .filter(([, providers]) => providers.length > 1)
            .map(([id, providers]) => `${id} listed under ${providers.join(' and ')}`);

        expect(duplicates).toEqual([]);
    });

    it('never shows two free rows that a customer cannot tell apart', () => {
        // The specific failure the duplicate produced: same id, same displayed
        // provider. This would still catch it if the ids differed only by case
        // or by a "(via X)" display name, since neither reaches the id column.
        const seen = new Map<string, string>();
        const collisions: string[] = [];
        for (const row of rows) {
            if (!row.free) continue;
            const key = `${publicProviderLabel(row.provider, row.id)}:${row.id.toLowerCase()}`;
            const first = seen.get(key);
            if (first) collisions.push(`${row.id} appears under both ${first} and ${row.provider}, both shown as the same provider`);
            else seen.set(key, row.provider);
        }
        expect(collisions).toEqual([]);
    });

    it('keeps backend-only providers out of the catalog', () => {
        // B.AI serves GLM (and formerly DeepSeek) but is never a provider a
        // customer picks: its models are advertised under the vendor that makes
        // them. Pricing rows and router overrides carry it instead. `meta`,
        // `together`, `qwen` and `centaur` are empty for their own reasons —
        // see the comments on each block — but the same rule applies: adding a
        // row here puts it in front of customers.
        const bai = SUPPORTED_PROVIDERS.find(p => p.id === 'bai');
        expect(bai, 'bai provider should still exist for routing').toBeDefined();
        expect(bai!.models).toEqual([]);
    });
});
