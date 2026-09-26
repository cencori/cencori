import { describe, expect, it } from 'vitest';
import { classifyTool } from '@/lib/embedded/tool-risk';
import { applyAllowlist, diffToolSnapshot, toMcpDiscoveryResult } from '@/lib/embedded/mcp';
import { codeChallenge, newCodeVerifier, signOAuthState } from '@/lib/embedded/oauth';

describe('tool risk classification', () => {
    it('auto-approves reads', () => {
        expect(classifyTool('getMessages', { readOnlyHint: true }).approval).toBe('auto');
        expect(classifyTool('listFiles').risk).toBe('read');
    });

    it('requires approval for gmail send', () => {
        const c = classifyTool('gmail.send');
        expect(c.approval).toBe('required');
        expect(c.idempotent).toBe(false);
    });

    it('marks destructive tools', () => {
        expect(classifyTool('deleteAccount').risk).toBe('destructive');
        expect(classifyTool('deleteAccount').approval).toBe('required');
    });
});

describe('mcp snapshot + allowlist', () => {
    it('diffs discovered tools', () => {
        const diff = diffToolSnapshot([{ name: 'a' }, { name: 'b' }], [{ name: 'b' }, { name: 'c' }]);
        expect(diff.added).toEqual(['c']);
        expect(diff.removed).toEqual(['a']);
        expect(diff.unchanged).toEqual(['b']);
    });

    it('empty allowlist allows all (M2 default)', () => {
        expect(applyAllowlist(['a', 'b'], [])).toEqual(['a', 'b']);
        expect(applyAllowlist(['a', 'b'], null)).toEqual(['a', 'b']);
    });

    it('non-empty allowlist intersects', () => {
        expect(applyAllowlist(['a', 'b', 'c'], ['a', 'c'])).toEqual(['a', 'c']);
    });

    it('shapes registration as the contracted McpDiscoveryResult', () => {
        const server = { id: 'mcp_abc', name: 'wiki', url: 'https://mcp.deepwiki.com/mcp', transport: 'streamable-http', status: 'active' };
        const result = toMcpDiscoveryResult(server, [{ name: 'search' }, { name: 'read' }]);
        expect(result.server).toEqual(server);
        expect(result.tools).toHaveLength(2);
        expect(result.added).toEqual(['search', 'read']);
        expect(result.removed).toEqual([]);
        expect(result.changed).toEqual([]);
    });
});

describe('oauth broker primitives', () => {
    it('signs state stably', () => {
        const a = signOAuthState('p:c:s');
        expect(a).toBe(signOAuthState('p:c:s'));
        expect(a).not.toBe(signOAuthState('p:c:other'));
    });

    it('builds PKCE challenges', () => {
        const verifier = newCodeVerifier();
        expect(verifier.length).toBeGreaterThan(20);
        const challenge = codeChallenge(verifier);
        expect(challenge).not.toBe(verifier);
        expect(challenge).toBe(codeChallenge(verifier));
    });
});
