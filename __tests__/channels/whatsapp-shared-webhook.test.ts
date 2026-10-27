import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handled = vi.hoisted(() => vi.fn(async () => undefined));
const channels = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@vercel/functions', () => ({ waitUntil: (promise: Promise<unknown>) => promise }));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/channels/whatsapp-runner', () => ({ handleInboundMessages: handled, handleOwnerEchoes: vi.fn(async () => undefined) }));
vi.mock('@/lib/channels/whatsapp', async (original) => ({
    ...(await original<typeof import('@/lib/channels/whatsapp')>()),
    getManagedChannelByPhoneNumberId: async (_db: unknown, id: string) => channels.get(id) ?? null,
}));

import { GET, POST } from '@/app/api/channels/whatsapp/route';

const delivery = (phoneNumberId: string) => JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneNumberId }, messages: [{ id: `wamid.${phoneNumberId}`, from: '2348011112222', type: 'text', text: { body: 'hi' } }] } }] }] });
const signed = (body: string, secret = 'cencori-secret') => new NextRequest('https://cencori.com/api/channels/whatsapp', { method: 'POST', body, headers: { 'X-Hub-Signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}` } });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('shared WhatsApp webhook (Embedded Signup numbers)', () => {
    beforeEach(() => {
        process.env.META_APP_SECRET = 'cencori-secret';
        process.env.META_WEBHOOK_VERIFY_TOKEN = 'verify-me';
        handled.mockClear();
        channels.clear();
    });

    it("answers Meta's webhook check only with Cencori's verify token", async () => {
        const ok = await GET(new NextRequest('https://cencori.com/api/channels/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42'));
        expect(ok.status).toBe(200);
        expect(await ok.text()).toBe('42');
        const bad = await GET(new NextRequest('https://cencori.com/api/channels/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42'));
        expect(bad.status).toBe(403);
    });

    it("rejects deliveries not signed with Cencori's app secret", async () => {
        expect((await POST(signed(delivery('111111'), 'someone-else'))).status).toBe(401);
        expect(handled).not.toHaveBeenCalled();
    });

    it('routes each number to its agent and drops numbers that are off or unknown', async () => {
        channels.set('111111', { id: 'c1', status: 'active', metadata: { enabled: true } });
        channels.set('222222', { id: 'c2', status: 'active', metadata: { enabled: false } });
        for (const id of ['111111', '222222', '333333']) expect((await POST(signed(delivery(id)))).status).toBe(200);
        await vi.waitFor(() => expect(handled).toHaveBeenCalledTimes(1));
        await flush();
        expect(handled).toHaveBeenCalledTimes(1);
        expect((handled.mock.calls[0] as unknown[])[1]).toMatchObject({ id: 'c1' });
    });
});
