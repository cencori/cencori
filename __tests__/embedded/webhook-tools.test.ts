import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/security/outbound-url', () => ({ safeOutboundFetch: fetchMock }));

import { buildWebhookTools, executeWebhookTool, publicWebhookTools, readWebhookTools, webhookToolDefinitions, withoutWebhookEndpoints, withoutWebhookTools } from '@/lib/embedded/webhook-tools';

const ORG = 'org_1';
const input = (overrides: Record<string, unknown> = {}) => ({
    name: 'book_meeting',
    description: 'Book a demo slot',
    method: 'POST',
    url: 'https://api.example.com/book',
    headers: [{ name: 'Authorization', value: 'Bearer secret-token' }],
    parameters: [{ name: 'time', type: 'string', description: 'ISO time', required: true }, { name: 'notes', type: 'string', description: '', required: false }],
    ...overrides,
});

describe('webhook tools', () => {
    beforeEach(() => {
        process.env.ENCRYPTION_SECRET ??= 'test-encryption-secret-at-least-32-chars-long';
        fetchMock.mockReset();
    });

    it('validates, encrypts header values and never returns them to the console', () => {
        const built = buildWebhookTools([input()], [], ORG);
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        const [tool] = built.tools;
        expect(tool.headers[0].value_encrypted).not.toContain('secret-token');
        expect(publicWebhookTools(built.tools)[0].headers).toEqual([{ name: 'Authorization' }]);
        expect(webhookToolDefinitions(built.tools)[0].function.parameters).toEqual({
            type: 'object',
            properties: { time: { type: 'string', description: 'ISO time' }, notes: { type: 'string' } },
            required: ['time'],
        });
    });

    it('keeps a stored header value when the console sends keep', () => {
        const first = buildWebhookTools([input()], [], ORG);
        if (!first.ok) throw new Error(first.message);
        const second = buildWebhookTools([input({ headers: [{ name: 'Authorization', keep: true }] })], first.tools, ORG);
        if (!second.ok) throw new Error(second.message);
        expect(second.tools[0].headers[0].value_encrypted).toBe(first.tools[0].headers[0].value_encrypted);
    });

    it('rejects plain http, bad names, duplicates and reserved headers', () => {
        expect(buildWebhookTools([input({ url: 'http://api.example.com' })], [], ORG).ok).toBe(false);
        expect(buildWebhookTools([input({ name: '1bad' })], [], ORG).ok).toBe(false);
        expect(buildWebhookTools([input(), input()], [], ORG).ok).toBe(false);
        expect(buildWebhookTools([input({ headers: [{ name: 'Host', value: 'x' }] })], [], ORG).ok).toBe(false);
        expect(buildWebhookTools([input({ description: '' })], [], ORG).ok).toBe(false);
    });

    it('sends only declared inputs as JSON with the decrypted header', async () => {
        const built = buildWebhookTools([input()], [], ORG);
        if (!built.ok) throw new Error(built.message);
        fetchMock.mockResolvedValue(new Response('{"booked":true}', { status: 200 }));
        const outcome = await executeWebhookTool(built.tools[0], '{"time":"15:00","injected":"x"}', { organizationId: ORG });
        expect(outcome).toEqual({ ok: true, status: 200, output: '{"booked":true}' });
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(url.toString()).toBe('https://api.example.com/book');
        expect(JSON.parse(init.body as string)).toEqual({ time: '15:00' });
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    });

    it('puts GET inputs in the query string', async () => {
        const built = buildWebhookTools([input({ method: 'GET', headers: [] })], [], ORG);
        if (!built.ok) throw new Error(built.message);
        fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
        await executeWebhookTool(built.tools[0], '{"time":"15:00"}', { organizationId: ORG });
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(url.searchParams.get('time')).toBe('15:00');
        expect(init.body).toBeUndefined();
    });

    it('asks for missing required inputs instead of calling', async () => {
        const built = buildWebhookTools([input()], [], ORG);
        if (!built.ok) throw new Error(built.message);
        const outcome = await executeWebhookTool(built.tools[0], '{}', { organizationId: ORG });
        expect(outcome.ok).toBe(false);
        expect(outcome.output).toContain('time');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports HTTP errors to the model', async () => {
        const built = buildWebhookTools([input()], [], ORG);
        if (!built.ok) throw new Error(built.message);
        fetchMock.mockResolvedValue(new Response('slot taken', { status: 409 }));
        const outcome = await executeWebhookTool(built.tools[0], '{"time":"15:00"}', { organizationId: ORG });
        expect(outcome).toMatchObject({ ok: false, status: 409 });
        expect(outcome.output).toContain('slot taken');
    });

    it('hides endpoints publicly and drops tools on fork', () => {
        const built = buildWebhookTools([input()], [], ORG);
        if (!built.ok) throw new Error(built.message);
        const config = { model: 'x', webhook_tools: built.tools };
        expect(withoutWebhookEndpoints(config).webhook_tools).toEqual([{ name: 'book_meeting', description: 'Book a demo slot' }]);
        expect('webhook_tools' in withoutWebhookTools(config)).toBe(false);
        expect(readWebhookTools(config)).toHaveLength(1);
    });
});
