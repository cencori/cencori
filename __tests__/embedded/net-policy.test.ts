import { describe, expect, it } from 'vitest';
import { canonicalAllowedHost, checkEgress, intersectNetworkPolicy } from '@/lib/embedded/net-policy';

describe('network policy intersection', () => {
    it('denies when either side is none', () => {
        expect(intersectNetworkPolicy({ network: { mode: 'none', allowed_hosts: [] } }, { network: { mode: 'allowlist', allowed_hosts: ['a.com'] } }).mode).toBe('none');
        expect(intersectNetworkPolicy({ network: { mode: 'allowlist', allowed_hosts: ['a.com'] } }, null).mode).toBe('allowlist');
    });

    it('intersects two allowlists', () => {
        const policy = intersectNetworkPolicy(
            { network: { mode: 'allowlist', allowed_hosts: ['a.com', 'b.com'] } },
            { network: { mode: 'allowlist', allowed_hosts: ['b.com', 'c.com'] } },
        );
        expect(policy.mode).toBe('allowlist');
        expect(policy.allowed_hosts).toEqual(['b.com']);
    });

    it('supports wildcard subdomains', () => {
        const policy = intersectNetworkPolicy(
            { network: { mode: 'allowlist', allowed_hosts: ['*.example.com'] } },
            { network: { mode: 'allowlist', allowed_hosts: ['*.example.com'] } },
        );
        expect(policy.allowed_hosts).toEqual(['*.example.com']);
    });

    it('keeps the narrower host when wildcard and exact entries overlap', () => {
        const policy = intersectNetworkPolicy(
            { network: { mode: 'allowlist', allowed_hosts: ['*.example.com'] } },
            { network: { mode: 'allowlist', allowed_hosts: ['api.example.com'] } },
        );
        expect(policy.allowed_hosts).toEqual(['api.example.com']);
        expect(intersectNetworkPolicy(
            { network: { mode: 'allowlist', allowed_hosts: ['api.example.com'] } },
            { network: { mode: 'allowlist', allowed_hosts: ['*.example.com'] } },
        ).allowed_hosts).toEqual(['api.example.com']);
    });

    it('keeps the narrower wildcard and excludes unrelated suffixes', () => {
        const policy = intersectNetworkPolicy(
            { network: { mode: 'allowlist', allowed_hosts: ['*.example.com'] } },
            { network: { mode: 'allowlist', allowed_hosts: ['*.us.example.com', '*.other.com'] } },
        );
        expect(policy.allowed_hosts).toEqual(['*.us.example.com']);
    });

    it('does not widen an exact host to another port', () => {
        expect(canonicalAllowedHost('https://api.example.com:8443')).toBe('api.example.com:8443');
        expect(canonicalAllowedHost('http://api.example.com')).toBeNull();
        expect(canonicalAllowedHost('api.example.com/path')).toBeNull();
        expect(intersectNetworkPolicy(
            { network: { mode: 'allowlist', allowed_hosts: ['api.example.com:8443'] } },
            { network: { mode: 'allowlist', allowed_hosts: ['api.example.com'] } },
        ).allowed_hosts).toEqual([]);
    });
});

describe('egress decisions (default-deny)', () => {
    it('denies without an allowlist entry', async () => {
        const decision = await checkEgress('https://evil.example.com/x', { mode: 'allowlist', allowed_hosts: ['api.example.com'] });
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toMatch(/allowlist/);
    });

    it('denies credential-bearing URLs', async () => {
        const decision = await checkEgress('https://user:pass@api.example.com/', { mode: 'allowlist', allowed_hosts: ['api.example.com'] });
        expect(decision.allowed).toBe(false);
    });

    it('denies non-http protocols and invalid URLs', async () => {
        expect((await checkEgress('ftp://api.example.com/', { mode: 'allowlist', allowed_hosts: ['api.example.com'] })).allowed).toBe(false);
        expect((await checkEgress('not a url', { mode: 'none', allowed_hosts: [] })).allowed).toBe(false);
    });

    it('denies everything in none mode', async () => {
        expect((await checkEgress('https://api.example.com/', { mode: 'none', allowed_hosts: [] })).allowed).toBe(false);
    });

    it('denies non-HTTPS requests and unlisted ports', async () => {
        const policy = { mode: 'allowlist' as const, allowed_hosts: ['api.example.com'] };
        expect((await checkEgress('http://api.example.com/', policy)).allowed).toBe(false);
        expect((await checkEgress('https://api.example.com:8443/', policy)).allowed).toBe(false);
    });
});
