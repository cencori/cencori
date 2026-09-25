import { describe, expect, it } from 'vitest';
import { normalizeManifest, REASONING_EFFORTS } from '@/lib/embedded/manifest';
import { installedTurnTools } from '@/lib/embedded/turn-tools';
import { intersectBrowserEnabled } from '@/lib/embedded/net-policy';
import { validateVersionConfig } from '@/lib/embedded/agents';

describe('capability manifest normalization', () => {
    it('maps legacy fields to the canonical manifest', () => {
        const m = normalizeManifest({
            model: 'gpt-5-mini',
            system_prompt: 'Be helpful.',
            tools: ['web_search', { type: 'function', name: 'calc' }],
            temperature: 0.5,
        });
        expect(m.model).toBe('gpt-5-mini');
        expect(m.temperature).toBe(0.5);
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

    it('preserves typed tool schemas and subagent limits through normalization', () => {
        const m = normalizeManifest({
            model: 'gpt-5-mini',
            tools: [{ type: 'function', name: 'lookup', description: 'Look up a record', parameters: { type: 'object', properties: { id: { type: 'string' } } } }],
            subagents: [{ agent_version_id: 'agv_1', max_calls: 2, timeout_ms: 5000, budget_limit: 0.25 }],
        });
        expect(validateVersionConfig({ model: m.model, tools: m.tools }).ok).toBe(true);
        expect(m.tools[0]).toMatchObject({ name: 'lookup', parameters: { type: 'object' } });
        expect(m.subagents).toEqual([{ agent_version_id: 'agv_1', max_calls: 2, timeout_ms: 5000, budget_limit: 0.25 }]);
    });

    it('offers only published built-ins and function schemas on installed turns', () => {
        const m = normalizeManifest({
            model: 'gpt-5-mini',
            tools: ['web_search', { type: 'function', name: 'lookup', parameters: { type: 'object' } }, { type: 'function', name: 'bad', parameters: 'nope' }],
            policy: { browser: { enabled: true }, network: { mode: 'allowlist', allowed_hosts: ['example.com'] } },
        });
        expect(installedTurnTools(m, { mode: 'allowlist', allowed_hosts: ['example.com'] })).toEqual([
            { type: 'web_search_preview' },
            { type: 'function', function: { name: 'lookup', description: '', parameters: { type: 'object' } } },
        ]);
        expect(installedTurnTools(m, { mode: 'none', allowed_hosts: [] })).toEqual([
            { type: 'function', function: { name: 'lookup', description: '', parameters: { type: 'object' } } },
        ]);
        // Overlay browser:false strips even when the manifest grants it.
        expect(installedTurnTools(m, { mode: 'allowlist', allowed_hosts: ['example.com'] }, false)).toEqual([
            { type: 'function', function: { name: 'lookup', description: '', parameters: { type: 'object' } } },
        ]);
    });

    it('intersects browser grants (either side may only narrow)', () => {
        expect(intersectBrowserEnabled({ browser: { enabled: true } }, null)).toBe(true);
        expect(intersectBrowserEnabled({ browser: { enabled: true } }, { browser: { enabled: false } })).toBe(false);
        expect(intersectBrowserEnabled({ browser: { enabled: false } }, { browser: { enabled: true } })).toBe(false);
        expect(intersectBrowserEnabled(null, null)).toBe(false);
    });
});
