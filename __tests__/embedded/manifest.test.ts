import { describe, expect, it } from 'vitest';
import { normalizeManifest, REASONING_EFFORTS } from '@/lib/embedded/manifest';

describe('capability manifest normalization', () => {
    it('maps legacy fields to the canonical manifest', () => {
        const m = normalizeManifest({
            model: 'gpt-5-mini',
            system_prompt: 'Be helpful.',
            tools: ['web_search', { type: 'function', name: 'calc' }],
            temperature: 0.5,
        });
        expect(m.model).toBe('gpt-5-mini');
        expect(m.instructions).toBe('Be helpful.');
        expect(m.tools).toEqual([
            { type: 'builtin', name: 'web_search' },
            { type: 'function', name: 'calc' },
        ]);
    });

    it('defaults to default-deny execution policy', () => {
        const m = normalizeManifest({ model: 'x' });
        expect(m.policy.browser.enabled).toBe(false);
        expect(m.policy.network.mode).toBe('none');
        expect(m.policy.network.allowed_hosts).toEqual([]);
        expect(m.policy.max_delegation_depth).toBe(0);
        expect(m.skills).toEqual([]);
        expect(m.subagents).toEqual([]);
    });

    it('normalizes skill, connection, MCP, and subagent references', () => {
        const m = normalizeManifest({
            skills: [{ skill_version_id: 'skv_1' }, {}],
            connection_requirements: [{ connector: 'gmail', scopes: ['a'] }],
            mcp_tools: [{ server_id: 'mcp_1', tool: 't' }],
            subagents: [{ agent_version_id: 'agv_1' }],
        });
        expect(m.skills).toEqual([{ skill_version_id: 'skv_1' }]);
        expect(m.connection_requirements).toEqual([{ connector: 'gmail', scopes: ['a'] }]);
        expect(m.mcp_tools).toEqual([{ server_id: 'mcp_1', tool: 't' }]);
        expect(m.subagents).toEqual([{ agent_version_id: 'agv_1', max_calls: 1 }]);
    });

    it('advertises the supported reasoning efforts', () => {
        expect(REASONING_EFFORTS).toEqual(['low', 'medium', 'high']);
    });
});
