import { beforeEach, describe, expect, it, vi } from 'vitest';

const notify = vi.hoisted(() => vi.fn(async () => true));
vi.mock('@/lib/embedded/owner-alerts', async (original) => ({
    ...(await original<typeof import('@/lib/embedded/owner-alerts')>()),
    notifyCallback: notify,
}));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({}) }));

import { agentToolset } from '@/lib/embedded/agent-tools';

const context = { organizationId: 'o1', projectId: 'p1', agentId: 'a1', agentName: 'Kapadoccia Lagos', surface: 'conversation' as const, conversationId: 's1' };
const call = (args: unknown) => ({ id: 'c1', name: 'request_callback', args: JSON.stringify(args) });

describe('request a callback', () => {
    beforeEach(() => notify.mockReset().mockResolvedValue(true));

    it('is offered only when switched on', () => {
        expect(agentToolset({}).has('request_callback')).toBe(false);
        const toolset = agentToolset({ system_tools: { request_callback: {} } });
        expect(toolset.has('request_callback')).toBe(true);
        expect(toolset.definitions.find((d) => d.function.name === 'request_callback')?.function.parameters).toMatchObject({ required: ['phone', 'reason'] });
    });

    it('passes the request to the owner and says so only when it went through', async () => {
        const toolset = agentToolset({ system_tools: { request_callback: {} } });
        const outcome = await toolset.run(call({ name: 'Ada', phone: '08031234567', reason: 'Birthday for 20 on Saturday' }), context);
        expect(outcome).toMatchObject({ ok: true });
        expect(notify).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', agentId: 'a1', conversationId: 's1' }), { name: 'Ada', contact: '08031234567', reason: 'Birthday for 20 on Saturday' });

        notify.mockResolvedValueOnce(false);
        const nobody = await toolset.run(call({ phone: '08031234567', reason: 'Complaint' }), context);
        expect(nobody.ok).toBe(false);
        expect(nobody.output).toMatch(/Don't promise a callback/);
    });

    it('asks for the number and the reason first', async () => {
        const toolset = agentToolset({ system_tools: { request_callback: {} } });
        expect((await toolset.run(call({ reason: 'x' }), context)).output).toMatch(/number/);
        expect((await toolset.run(call({ phone: '0803' }), context)).output).toMatch(/what they need/);
        expect(notify).not.toHaveBeenCalled();
    });
});
