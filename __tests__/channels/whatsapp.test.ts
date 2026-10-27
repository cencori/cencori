import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/security/outbound-url', () => ({ safeOutboundFetch: fetchMock }));

import { channelAccessToken, downloadMedia, parseInbound, parseOwnerEchoes, sendText, splitForWhatsApp, toWhatsAppText, verifyWhatsAppSignature, type WhatsAppChannel } from '@/lib/channels/whatsapp';
import { readReply } from '@/lib/channels/whatsapp-runner';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const delivery = (messages: unknown[], phoneNumberId = '1065') => ({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba', changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '2348000000000', phone_number_id: phoneNumberId },
        contacts: [{ wa_id: '2348011112222', profile: { name: 'Ada' } }],
        messages,
    } }] }],
});

const channel = { id: 'c1', projectId: 'p1', status: 'active', accessTokenEncrypted: 'x', metadata: { phone_number_id: '1065' } } as unknown as WhatsAppChannel;

describe('WhatsApp channel', () => {
    beforeEach(() => fetchMock.mockReset());

    it('accepts only deliveries signed with the app secret', () => {
        const body = JSON.stringify(delivery([]));
        const signature = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
        expect(verifyWhatsAppSignature(body, signature, 'secret')).toBe(true);
        expect(verifyWhatsAppSignature(body, signature, 'other')).toBe(false);
        expect(verifyWhatsAppSignature(`${body} `, signature, 'secret')).toBe(false);
        expect(verifyWhatsAppSignature(body, null, 'secret')).toBe(false);
        expect(verifyWhatsAppSignature(body, 'sha256=abc', 'secret')).toBe(false);
    });

    it('reads customer messages and skips status updates', () => {
        const parsed = parseInbound(delivery([
            { id: 'wamid.1', from: '2348011112222', type: 'text', text: { body: ' Do you have a table for 4? ' } },
            { id: 'wamid.2', from: '2348011112222', type: 'interactive', interactive: { button_reply: { id: 'b', title: 'Saturday' } } },
            { id: 'wamid.3', from: '2348011112222', type: 'image', image: { id: 'img' } },
            { id: 'wamid.4', from: '2348011112222', type: 'audio', audio: { id: 'media.9', mime_type: 'audio/ogg; codecs=opus', voice: true } },
        ]));
        expect(parsed).toEqual([
            { id: 'wamid.1', from: '2348011112222', name: 'Ada', text: 'Do you have a table for 4?', audio: null, type: 'text', phoneNumberId: '1065' },
            { id: 'wamid.2', from: '2348011112222', name: 'Ada', text: 'Saturday', audio: null, type: 'interactive', phoneNumberId: '1065' },
            { id: 'wamid.3', from: '2348011112222', name: 'Ada', text: null, audio: null, type: 'image', phoneNumberId: '1065' },
            { id: 'wamid.4', from: '2348011112222', name: 'Ada', text: null, audio: { id: 'media.9', mimeType: 'audio/ogg; codecs=opus' }, type: 'audio', phoneNumberId: '1065' },
        ]);
        const statuses = { entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }] };
        expect(parseInbound(statuses)).toEqual([]);
        expect(parseInbound(null)).toEqual([]);
    });

    it('turns markdown into WhatsApp formatting', () => {
        expect(toWhatsAppText('## Menu\n**Jollof** is ~~₦5,000~~ ₦4,500\n- Rice\n- [Book](https://example.com/book)'))
            .toBe('*Menu*\n*Jollof* is ~₦5,000~ ₦4,500\n• Rice\n• Book (https://example.com/book)');
    });

    it('splits long replies at natural breaks', () => {
        const text = `${'a'.repeat(60)}\n\n${'b'.repeat(60)}`;
        expect(splitForWhatsApp(text, 100)).toEqual(['a'.repeat(60), 'b'.repeat(60)]);
        expect(splitForWhatsApp('x'.repeat(250), 100).map((part) => part.length)).toEqual([100, 100, 50]);
        expect(splitForWhatsApp('short', 100)).toEqual(['short']);
    });

    it('sends the reply quoting the customer message', async () => {
        fetchMock.mockImplementation(async () => json({ messages: [{ id: 'wamid.out' }] }));
        await sendText(channel, 'token', '2348011112222', '**Yes**, we do.', 'wamid.1');
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://graph.facebook.com/v23.0/1065/messages');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token');
        expect(JSON.parse(String(init.body))).toMatchObject({ to: '2348011112222', type: 'text', text: { body: '*Yes*, we do.' }, context: { message_id: 'wamid.1' } });
    });

    it('downloads a voice note through its media id', async () => {
        fetchMock
            .mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/whatsapp/media/9', mime_type: 'audio/ogg; codecs=opus', file_size: 4 }))
            .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4])));
        const media = await downloadMedia(channel, 'token', 'media.9');
        expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/media.9');
        expect(fetchMock.mock.calls[1][0]).toBe('https://lookaside.fbsbx.com/whatsapp/media/9');
        expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({ Authorization: 'Bearer token' });
        expect(media).toMatchObject({ mimeType: 'audio/ogg' });
        expect(media.bytes.byteLength).toBe(4);

        fetchMock.mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/x', file_size: 50 * 1024 * 1024 }));
        await expect(downloadMedia(channel, 'token', 'media.10')).rejects.toThrow('Voice note too long');
    });

    it("reads the owner's own replies from the WhatsApp Business app, and nothing else", () => {
        const payload = {
            entry: [{
                changes: [
                    { field: 'smb_message_echoes', value: { metadata: { phone_number_id: '1065' }, message_echoes: [
                        { id: 'wamid.e1', from: '2347085231045', to: '2349126230221', type: 'text', text: { body: 'Yes, terrace at 8pm' } },
                        { id: 'wamid.e2', to: '2349126230221', type: 'image', image: { caption: '' } },
                        { id: 'wamid.e3', type: 'text', text: { body: 'no recipient' } },
                    ] } },
                    { field: 'messages', value: { metadata: { phone_number_id: '1065' }, messages: [{ id: 'wamid.m1', from: '2349126230221', type: 'text', text: { body: 'Hi' } }] } },
                ],
            }],
        };
        expect(parseOwnerEchoes(payload)).toEqual([
            { id: 'wamid.e1', to: '2349126230221', text: 'Yes, terrace at 8pm', phoneNumberId: '1065' },
            { id: 'wamid.e2', to: '2349126230221', text: '[Sent a photo]', phoneNumberId: '1065' },
        ]);
        // Echoes are never mistaken for customer messages.
        expect(parseInbound(payload).map((m) => m.id)).toEqual(['wamid.m1']);
    });

    it('goes through Kapso for numbers connected through Kapso', async () => {
        const kapso = { ...channel, metadata: { ...channel.metadata, provider: 'kapso' } } as WhatsAppChannel;
        fetchMock
            .mockResolvedValueOnce(json({ download_url: 'https://api.kapso.ai/meta/whatsapp/media_download?token=t', mime_type: 'audio/ogg', file_size: '4' }))
            .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4])));
        const media = await downloadMedia(kapso, 'kapso-key', 'media.9');
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.kapso.ai/meta/whatsapp/v24.0/media.9?phone_number_id=1065');
        expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'X-API-Key': 'kapso-key' });
        // Kapso's link carries its own token: no key sent to it.
        expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toBeUndefined();
        expect(media.bytes.byteLength).toBe(4);

        fetchMock.mockResolvedValueOnce(json({ messages: [{ id: 'wamid.1' }] }));
        await sendText(kapso, 'kapso-key', '2348000000000', 'Hi');
        expect(fetchMock.mock.calls[2][0]).toBe('https://api.kapso.ai/meta/whatsapp/v24.0/1065/messages');

        process.env.KAPSO_API_KEY = 'kapso-key';
        expect(channelAccessToken(kapso, () => 'stored')).toBe('kapso-key');
        delete process.env.KAPSO_API_KEY;
    });

    it("uses Cencori's permanent token for numbers it has a seat on, the stored token otherwise", () => {
        process.env.META_SYSTEM_USER_TOKEN = 'cencori-permanent';
        const decrypt = (value: string) => `decrypted:${value}`;
        const managed = { ...channel, accessTokenEncrypted: 'signup', metadata: { ...channel.metadata, managed: true, system_user_assigned: true } } as WhatsAppChannel;
        expect(channelAccessToken(managed, decrypt)).toBe('cencori-permanent');
        expect(channelAccessToken({ ...managed, metadata: { ...managed.metadata, system_user_assigned: false } }, decrypt)).toBe('decrypted:signup');
        expect(channelAccessToken({ ...channel, accessTokenEncrypted: 'own-app' } as WhatsAppChannel, decrypt)).toBe('decrypted:own-app');
        delete process.env.META_SYSTEM_USER_TOKEN;
        expect(channelAccessToken(managed, decrypt)).toBe('decrypted:signup');
    });

    it('reads the reply off the turn event stream', async () => {
        const events = [
            'event: turn.started\ndata: {"turn_number":1}\n\n',
            'event: output_text.delta\ndata: {"delta":"Hello"}\n\n',
            'event: output_text.delta\ndata: {"delta":" there"}\n\nevent: turn.completed\ndata: {"turn_number":1}\n\n',
        ];
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                for (const event of events) controller.enqueue(new TextEncoder().encode(event));
                controller.close();
            },
        });
        expect(await readReply(stream)).toBe('Hello there');

        const failed = new Response('event: turn.failed\ndata: {"output":{"error":"No credits"}}\n\n').body!;
        await expect(readReply(failed)).rejects.toThrow('No credits');
    });
});
