import { describe, expect, it } from 'vitest';
import { isCanonicalOfficialBaseUrl, isOfficialProvider, sanitizeConnection, validateConnectionInput } from '@/lib/embedded/provider-connections';
import { extractUpstreamErrorDetails } from '@/lib/embedded/upstream-error';

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
        if (!result.ok) {
            // Actionable message — must name the fix (omit base_url), not just "not editable".
            expect(result.message).toMatch(/must be omitted/i);
        }
    });

    it('accepts the canonical vendor URL for official providers (normalized to managed endpoint)', async () => {
        expect(isCanonicalOfficialBaseUrl('openai', 'https://api.openai.com/v1')).toBe(true);
        expect(isCanonicalOfficialBaseUrl('openai', 'https://api.openai.com/v1/')).toBe(true);
        const result = await validateConnectionInput(
            { name: 'x', provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiFormat: 'openai-compatible' },
            { organizationId: 'org_1' },
        );
        expect(result).toEqual({ ok: true, baseUrl: null });
    });

    it('extracts and redacts upstream error details without leaking keys', () => {
        const details = extractUpstreamErrorDetails(
            JSON.stringify({ error: { message: 'Invalid API key sk-abc123XYZ789 provided', code: 'invalid_request_error' } }),
        );
        expect(details.code).toBe('invalid_request_error');
        expect(details.message).not.toMatch(/sk-abc123/);
        expect(details.message).toMatch(/\[redacted\]/);
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
