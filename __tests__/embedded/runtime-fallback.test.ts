import { describe, expect, it } from 'vitest';
import { indexEmbeddedConnections, pickEmbeddedFallbackRow } from '@/lib/embedded/runtime-fallback';

describe('embedded runtime fallback picker', () => {
    it('returns null when nothing is usable', () => {
        expect(pickEmbeddedFallbackRow([])).toBeNull();
        expect(
            pickEmbeddedFallbackRow([
                { provider: 'openai', status: 'unhealthy', base_url: null, encrypted_key_ref: 'k' },
                { provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: null },
                { provider: 'openai', status: 'active', base_url: 'https://proxy.example.com/v1', encrypted_key_ref: 'k' },
                { provider: 'openai', status: 'disabled', base_url: null, encrypted_key_ref: 'k' },
            ]),
        ).toBeNull();
    });

    it('picks the newest active managed-endpoint row', () => {
        const winner = pickEmbeddedFallbackRow([
            { id: 'old', provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: 'k1', created_at: '2026-09-25T23:00:47Z' },
            { id: 'new', provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: 'k2', created_at: '2026-09-25T23:35:39Z' },
        ]);
        expect(winner?.id).toBe('new');
    });

    it('indexes the newest usable connection per provider', () => {
        const index = indexEmbeddedConnections([
            { id: 'a', provider: 'OpenAI', status: 'active', base_url: null, encrypted_key_ref: 'k' },
            { id: 'b', provider: 'anthropic', status: 'active', base_url: null, encrypted_key_ref: null },
        ]);
        expect(index.get('openai')?.id).toBe('a');
        expect(index.has('anthropic')).toBe(false);
    });
});
