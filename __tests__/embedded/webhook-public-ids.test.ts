import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    triggerWebhooks: vi.fn(),
    insert: vi.fn(),
}));

vi.mock('@/lib/webhooks/trigger', () => ({ triggerWebhooks: mocks.triggerWebhooks }));
vi.mock('@/lib/supabaseAdmin', () => ({
    createAdminClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));

import { emitEmbeddedEvent } from '@/lib/embedded/runs';
import { actionEventData, serializeAction, withPublicIds } from '@/lib/embedded/public-ids';

const ACTION = '30dc90ba-1111-4222-8333-444455556666';
const TENANT = 'e9d4aaaa-1111-4222-8333-444455556666';
const RUN = '7b0c1d2e-1111-4222-8333-444455556666';

describe('ids in webhooks match the API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.insert.mockResolvedValue({ error: null });
    });

    it('prefixes bare ids and leaves everything else alone', () => {
        expect(withPublicIds({ action_id: ACTION, tenant_id: TENANT, run_id: RUN, parent_run_id: RUN, installation_id: null, tool: 'gmail.send' })).toEqual({
            action_id: `act_${ACTION}`,
            tenant_id: `ten_${TENANT}`,
            run_id: `run_${RUN}`,
            parent_run_id: `run_${RUN}`,
            installation_id: null,
            tool: 'gmail.send',
        });
        // Already prefixed, or not one of our ids (a model's tool-call id).
        expect(withPublicIds({ action_id: `act_${ACTION}` })).toEqual({ action_id: `act_${ACTION}` });
        expect(withPublicIds({ action_id: 'call_1' })).toEqual({ action_id: 'call_1' });
    });

    it('sends action.required with the ids the actions API returns', async () => {
        mocks.triggerWebhooks.mockResolvedValue({ deliveries: [{ webhookId: 'wh-1', success: true, statusCode: 204, attempts: 1 }] });
        const row = { id: ACTION, tool_name: 'gmail.send', tenant_id: TENANT, run_id: null, session_id: 'ses-1' };

        await emitEmbeddedEvent('project-1', 'action.required', actionEventData(row));

        const sent = mocks.triggerWebhooks.mock.calls[0][2];
        expect(sent).toMatchObject({ action_id: `act_${ACTION}`, tenant_id: `ten_${TENANT}`, run_id: null, session_id: 'ses-1', tool: 'gmail.send' });
        expect(sent.action_id).toBe(serializeAction(row).id);
        expect(sent.tenant_id).toBe(serializeAction(row).tenant_id);
    });

    it('logs what each endpoint answered and the data it was sent', async () => {
        mocks.triggerWebhooks.mockResolvedValue({
            deliveries: [
                { webhookId: 'wh-1', success: true, statusCode: 204, attempts: 1 },
                { webhookId: 'wh-2', success: false, statusCode: 500, attempts: 3 },
            ],
        });

        await emitEmbeddedEvent('project-1', 'run.completed', { run_id: RUN });

        expect(mocks.insert).toHaveBeenCalledTimes(2);
        expect(mocks.insert.mock.calls[0][0]).toMatchObject({
            endpoint_id: 'wh-1', event_type: 'run.completed', status: 'delivered', attempt_count: 1, response_code: 204,
            payload: { run_id: `run_${RUN}` },
        });
        expect(mocks.insert.mock.calls[0][0].payload.event_id).toBe(mocks.insert.mock.calls[0][0].event_id);
        expect(mocks.insert.mock.calls[1][0]).toMatchObject({ endpoint_id: 'wh-2', status: 'failed', attempt_count: 3, response_code: 500 });
    });

    it('still logs the delivery when the payload column is missing', async () => {
        mocks.triggerWebhooks.mockResolvedValue({ deliveries: [{ webhookId: 'wh-1', success: true, statusCode: 200, attempts: 1 }] });
        mocks.insert.mockResolvedValueOnce({ error: { message: 'column "payload" does not exist' } });

        await emitEmbeddedEvent('project-1', 'run.started', { run_id: RUN });

        expect(mocks.insert).toHaveBeenCalledTimes(2);
        expect(mocks.insert.mock.calls[1][0]).not.toHaveProperty('payload');
        expect(mocks.insert.mock.calls[1][0]).toMatchObject({ endpoint_id: 'wh-1', response_code: 200 });
    });
});

describe('an action says who it belongs to', () => {
    it('returns tenant, run and session on every actions endpoint', () => {
        const out = serializeAction({ id: ACTION, tool_name: 'gmail.send', status: 'pending', tenant_id: TENANT, run_id: RUN, session_id: 'ses-1', created_at: 't', updated_at: 't' });
        expect(out).toMatchObject({ id: `act_${ACTION}`, tenant_id: `ten_${TENANT}`, run_id: `run_${RUN}`, session_id: 'ses-1' });
    });
});
