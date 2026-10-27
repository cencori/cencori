import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '../config';
import { publicProviderLabel } from '../branding';
import { ProviderRouter } from '../router';

/**
 * Duplicate catalog row guard.
 *
 * components/models/ModelCatalog.tsx builds its table by flattening every
 * provider's `models` array with no de-duplication, so a model id listed under
 * two providers renders as two rows. That is usually survivable — the rows at
 * least name different providers — but not for free models: publicProviderLabel
 * used to brand every free model "Cencori", so both rows showed the same id,
 * the same provider and the same FREE badge, with nothing to tell them apart.
 *
 * That is exactly what happened to `glm-5.3-flash` before 2026-09-10. It was
 * listed under `zai` for branding and again under `bai` (the provider that
 * actually serves it). Since 2026-10-15 `zai` is hidden and `bai` is the
 * public catalog provider, so there is exactly one row per id again.
 *
 * The rule now: one catalog entry per servable id, under the provider that
 * routes it. This test holds that line.
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

    it('keeps judgment ids under the provider that serves them, off the chat path', () => {
        // Jev is evaluation-only (POST /v1/judgments, never chat completions).
        // Each id must live under exactly one provider — `typesafe` — route
        // there, and carry the `judgment` type so chat surfaces (playground,
        // agent studio, tensor policies) never pick it up. Clef rides the
        // same judgment route under `cloudflare` (lib/judgment/clef.ts).
        const router = new ProviderRouter();
        for (const [id, provider] of [
            ['jev-latest', 'typesafe'],
            ['jev-preview', 'typesafe'],
            ['jev-1.13.0', 'typesafe'],
            ['clef-latest', 'cloudflare'],
            ['clef-flash', 'cloudflare'],
            ['clef-omni', 'cloudflare'],
        ] as const) {
            const rows = SUPPORTED_PROVIDERS.flatMap(p => p.models.filter(m => m.id === id).map(m => ({ provider: p.id, types: Array.isArray(m.type) ? m.type : [m.type] })));
            expect(rows.map(r => r.provider), id).toEqual([provider]);
            expect(rows[0].types, id).toContain('judgment');
            expect(rows[0].types, id).not.toContain('chat');
            expect(router.detectProvider(id), id).toBe(provider);
        }
    });
    it('keeps the B.AI flash ids under the provider that routes them', () => {
        // Since 2026-10-15 `bai` is the public catalog provider for the flash
        // tiers (Z.AI rows hidden). Each id must live under exactly one
        // provider — `bai` — and route there, otherwise the row strands in the
        // wrong provider filter or 503s on missing pricing.
        const router = new ProviderRouter();
        for (const id of ['glm-5.3-flash', 'qwen3.8-flash']) {
            const owners = SUPPORTED_PROVIDERS.filter(p => p.models.some(m => m.id === id)).map(p => p.id);
            expect(owners, id).toEqual(['bai']);
            expect(router.detectProvider(id), id).toBe('bai');
        }
        // DeepSeek V4.1 Flash moved to DeepSeek's own API on 2026-10-28 (B.AI is its fallback).
        const flashOwners = SUPPORTED_PROVIDERS.filter(p => p.models.some(m => m.id === 'deepseek-v4.1-flash')).map(p => p.id);
        expect(flashOwners).toEqual(['deepseek']);
        expect(router.detectProvider('deepseek-v4.1-flash')).toBe('deepseek');
        // The hidden vendor stays hidden.
        expect(SUPPORTED_PROVIDERS.find(p => p.id === 'zai')!.models).toEqual([]);
    });
});
