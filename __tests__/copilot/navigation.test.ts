import { describe, expect, it } from 'vitest';
import { COPILOT_AGENT_PAGES, COPILOT_PAGES, prepareNavigation, resolveCopilotHref } from '@/lib/copilot/navigation';
import { getConsoleRoute } from '@/lib/console/routing';

const agents = [{ id: 'agent-1', name: 'Support Bot' }];
const findAgent = async (ref: unknown) => {
    const agent = agents.find((a) => a.id === ref || a.name === ref);
    return agent ? { agent } : { error: `No agent named "${ref}" in this project.` };
};
const console = { hostname: 'console.cencori.com', pathname: '/home', organizationSlug: 'acme', projectSlug: 'shop' };
const legacy = { hostname: 'cencori.com', pathname: '/acme/shop/logs', organizationSlug: 'acme', projectSlug: 'shop' };

describe('copilot navigation', () => {
    it('only lists pages the console routes', () => {
        for (const { path } of Object.values(COPILOT_PAGES)) {
            if (path.startsWith('/account/')) continue;
            expect(getConsoleRoute(path.split(/[?#]/)[0]), path).not.toBeNull();
        }
    });

    it('opens a named page, or an agent by name or id', async () => {
        expect(await prepareNavigation({ page: 'billing' }, { hasProject: true }, findAgent)).toEqual({ navigation: { path: '/billing', label: 'Billing' } });
        expect(await prepareNavigation({ page: 'agent', agent: 'Support Bot' }, { hasProject: true }, findAgent)).toEqual({ navigation: { path: '/agents/agent-1', label: 'Support Bot' } });
        expect(await prepareNavigation({ page: 'agent', agent: 'agent-1', agent_page: 'whatsapp' }, { hasProject: true }, findAgent))
            .toEqual({ navigation: { path: `/agents/agent-1${COPILOT_AGENT_PAGES.whatsapp.path}`, label: 'Support Bot · WhatsApp' } });
    });

    it('refuses unknown pages, missing agents, and project pages without a project', async () => {
        expect(await prepareNavigation({ page: 'https://evil.example' }, { hasProject: true }, findAgent)).toHaveProperty('error');
        expect(await prepareNavigation({ page: 'agent', agent: 'Nobody' }, { hasProject: true }, findAgent)).toHaveProperty('error');
        expect(await prepareNavigation({ page: 'gateway_logs' }, { hasProject: false }, findAgent)).toHaveProperty('error');
        expect(await prepareNavigation({ page: 'billing' }, { hasProject: false }, findAgent)).toHaveProperty('navigation');
    });

    it('keeps flat paths on the console and scopes them elsewhere', () => {
        expect(resolveCopilotHref('/settings?tab=budget', console)).toBe('/settings?tab=budget');
        expect(resolveCopilotHref('/settings?tab=budget', legacy)).toBe('/acme/shop/settings?tab=budget');
        expect(resolveCopilotHref('/home', legacy)).toBe('/acme/shop');
        expect(resolveCopilotHref('/agents/agent-1/settings#whatsapp', legacy)).toBe('/acme/shop/agents/agent-1/settings#whatsapp');
        expect(resolveCopilotHref('/billing', legacy)).toBe('/acme/~/billing');
        expect(resolveCopilotHref('/organization/settings', legacy)).toBe('/acme/~/settings');
        expect(resolveCopilotHref('/account/profile', legacy)).toBe('/account/profile');
        expect(resolveCopilotHref('/logs', { ...legacy, projectSlug: null })).toBeNull();
    });
});
