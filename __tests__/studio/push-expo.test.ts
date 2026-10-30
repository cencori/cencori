import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isExpoPushToken, sendExpo, type ExpoPushDevice } from '@/lib/studio/push';

const device = (token: string): ExpoPushDevice => ({ kind: 'expo', token, user_id: 'u1', created_at: '2026-10-30T00:00:00.000Z' });
const message = { title: 'Tolu needs you', body: 'Asking about delivery', url: '/inbox/abc', tag: 'needs-abc' };

describe('Expo push tokens', () => {
    it('accepts the app\'s tokens', () => {
        expect(isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
        expect(isExpoPushToken('ExpoPushToken[abc_DEF-123]')).toBe(true);
    });

    it('refuses anything else', () => {
        for (const bad of ['', 'ExponentPushToken[]', 'ExponentPushToken[a b]', 'https://exp.host/x', `ExponentPushToken[${'a'.repeat(300)}]`, 42, null]) {
            expect(isExpoPushToken(bad), String(bad)).toBe(false);
        }
    });
});

describe('sending through Expo', () => {
    it('sends one message per phone, with where tapping opens', async () => {
        const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{ status: 'ok' }] }), { status: 200 }));
        const gone = await sendExpo([device('ExponentPushToken[a]')], message, fetcher as unknown as typeof fetch);
        expect(gone).toEqual([]);
        const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://exp.host/--/api/v2/push/send');
        expect(JSON.parse(init.body as string)).toEqual([expect.objectContaining({ to: 'ExponentPushToken[a]', title: message.title, body: message.body, data: { url: '/inbox/abc', tag: 'needs-abc' } })]);
    });

    it('reports the phones Expo says are gone, and only those', async () => {
        const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [
            { status: 'ok' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
            { status: 'error', details: { error: 'MessageRateExceeded' } },
        ] }), { status: 200 }));
        const gone = await sendExpo([device('ExponentPushToken[a]'), device('ExponentPushToken[b]'), device('ExponentPushToken[c]')], message, fetcher as unknown as typeof fetch);
        expect(gone).toEqual(['ExponentPushToken[b]']);
    });

    it('sends in batches of 100', async () => {
        const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
        await sendExpo(Array.from({ length: 150 }, (_, i) => device(`ExponentPushToken[t${i}]`)), message, fetcher as unknown as typeof fetch);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('drops nobody when Expo can\'t be reached', async () => {
        const fetcher = vi.fn(async () => { throw new Error('offline'); });
        expect(await sendExpo([device('ExponentPushToken[a]')], message, fetcher as unknown as typeof fetch)).toEqual([]);
    });
});
