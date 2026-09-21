import { describe, expect, it } from 'vitest';
import { isOfficialProvider, sanitizeConnection, validateConnectionInput } from '@/lib/embedded/provider-connections';

describe('provider control plane guards', () => {
    it('treats known vendors as official', () => {
        expect(isOfficialProvider('openai')).toBe(true);
        expect(isOfficialProvider('OpenAI')).toBe(true);
        expect(isOfficialProvider('my-acme-proxy')).toBe(false);
    });

    it('rejects base_url overrides for official providers', async () => {
        const result = await validateConnectionInput(
            { name: 'x', provider: 'openai', baseUrl: 'https://evil.example.com/v1' },
            { organizationId: 'org_1' },
        );
        expect(result.ok).toBe(false);
    });

    it('requires base_url for custom providers', async () => {
        const result = await validateConnectionInput({ name: 'x', provider: 'my-acme-proxy' }, { organizationId: 'org_1' });
        expect(result.ok).toBe(false);
    });

    it('never leaks encrypted key material in sanitized rows', () => {
        const clean = sanitizeConnection({ id: '1', encrypted_key_ref: 'IV:TAG:DATA', key_hint: '...1234', name: 'x' });
        expect('encrypted_key_ref' in clean).toBe(false);
        expect(clean.key_hint).toBe('...1234');
    });
});
