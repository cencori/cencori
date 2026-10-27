import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { COPILOT_AGENT_PAGES, COPILOT_PAGES, COPILOT_SPOTS, prepareNavigation, resolveCopilotHref, spotSelector } from '@/lib/copilot/navigation';
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

    it('opens the page a highlight lives on, and names the spot', async () => {
        expect(await prepareNavigation({ page: 'overview', highlight: 'spend_cap' }, { hasProject: true }, findAgent))
            .toEqual({ navigation: { path: '/settings?tab=budget', label: 'Budget settings · Spend cap', spot: 'spend_cap' } });
        expect(await prepareNavigation({ highlight: 'agent_whatsapp', agent: 'Support Bot' }, { hasProject: true }, findAgent))
            .toEqual({ navigation: { path: '/agents/agent-1/settings#whatsapp', label: 'Support Bot · WhatsApp', spot: 'agent_whatsapp' } });
        expect(await prepareNavigation({ highlight: 'agent_model' }, { hasProject: true }, findAgent)).toHaveProperty('error');
        expect(await prepareNavigation({ highlight: 'body' }, { hasProject: true }, findAgent)).toHaveProperty('error');
        expect(spotSelector('spend_cap')).toBe('[data-copilot-spot="spend_cap"]');
        expect(spotSelector('nope')).toBeNull();
    });

    it('points at anything by its visible text, here or on another page', async () => {
        expect(await prepareNavigation({ page: 'integrations', highlight_text: 'CostGraph' }, { hasProject: true }, findAgent))
            .toEqual({ navigation: { path: '/settings?tab=integrations', label: 'Integrations · CostGraph', text: 'CostGraph' } });
        expect(await prepareNavigation({ page: 'current', highlight_text: 'Rate limiting' }, { hasProject: true }, findAgent))
            .toEqual({ navigation: { path: null, label: 'Rate limiting', text: 'Rate limiting' } });
        expect(await prepareNavigation({ page: 'current' }, { hasProject: true }, findAgent)).toHaveProperty('error');
    });

    it('has every spot marked somewhere in the console', () => {
        const marked = execSync('grep -rhoE "data-copilot-spot=\\"[a-z_]+\\"|spot=\\"[a-z_]+\\"" app components', { encoding: 'utf8' });
        for (const [id, spot] of Object.entries(COPILOT_SPOTS)) {
            if ('selector' in spot) continue;
            expect(marked, id).toContain(`"${id}"`);
        }
    });
});
