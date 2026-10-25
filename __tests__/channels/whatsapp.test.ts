import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/security/outbound-url', () => ({ safeOutboundFetch: fetchMock }));

import { downloadMedia, parseInbound, sendText, splitForWhatsApp, toWhatsAppText, verifyWhatsAppSignature, type WhatsAppChannel } from '@/lib/channels/whatsapp';
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
        const media = await downloadMedia('token', 'media.9');
        expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v23.0/media.9');
        expect(fetchMock.mock.calls[1][0]).toBe('https://lookaside.fbsbx.com/whatsapp/media/9');
        expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({ Authorization: 'Bearer token' });
        expect(media).toMatchObject({ mimeType: 'audio/ogg' });
        expect(media.bytes.byteLength).toBe(4);

        fetchMock.mockResolvedValueOnce(json({ url: 'https://lookaside.fbsbx.com/x', file_size: 50 * 1024 * 1024 }));
        await expect(downloadMedia('token', 'media.10')).rejects.toThrow('Voice note too long');
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
