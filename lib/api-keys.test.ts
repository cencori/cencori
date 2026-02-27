import { describe, expect, it } from 'vitest';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';

class MockHeaders implements Pick<Headers, 'get'> {
    private readonly values: Record<string, string>;

    constructor(values: Record<string, string>) {
        this.values = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
        );
    }

    get(name: string): string | null {
        return this.values[name.toLowerCase()] ?? null;
    }
}

describe('extractCencoriApiKeyFromHeaders', () => {
    it('returns explicit CENCORI_API_KEY header', () => {
        const headers = new MockHeaders({ CENCORI_API_KEY: 'csk_test_abc123' });
        expect(extractCencoriApiKeyFromHeaders(headers)).toBe('csk_test_abc123');
    });

    it('returns known bearer API key formats', () => {
        const headers = new MockHeaders({ Authorization: 'Bearer cpk_abc123' });
        expect(extractCencoriApiKeyFromHeaders(headers)).toBe('cpk_abc123');
    });

    it('returns opaque non-JWT bearer tokens for legacy API keys', () => {
        const headers = new MockHeaders({ Authorization: 'Bearer sk_live_legacyKey123' });
        expect(extractCencoriApiKeyFromHeaders(headers)).toBe('sk_live_legacyKey123');
    });

    it('does not treat JWT bearer tokens as API keys', () => {
        const headers = new MockHeaders({
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature',
        });
        expect(extractCencoriApiKeyFromHeaders(headers)).toBeNull();
    });

    it('supports lowercase bearer scheme', () => {
        const headers = new MockHeaders({ Authorization: 'bearer csk_lowercase_scheme' });
        expect(extractCencoriApiKeyFromHeaders(headers)).toBe('csk_lowercase_scheme');
    });
});
