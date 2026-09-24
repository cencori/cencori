import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function verifyWebhook(
    rawBody: string,
    signature: string | null | undefined,
    secret: string,
): boolean {
    if (!signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;

    const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const receivedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    return receivedBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

describe('Embedded Agents webhook documentation', () => {
    it('fails closed without throwing for malformed signatures', () => {
        for (const signature of [undefined, null, '', 'bad', 'sha256=abc']) {
            expect(() => verifyWebhook('{}', signature, 'whsec_test')).not.toThrow();
            expect(verifyWebhook('{}', signature, 'whsec_test')).toBe(false);
        }
    });

    it('accepts the documented HMAC and keeps the defensive guards in the example', () => {
        const body = JSON.stringify({ id: 'evt_test' });
        const secret = 'whsec_test';
        const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
        const docs = readFileSync(
            resolve(process.cwd(), 'content/docs/embedded-agents/webhooks.mdx'),
            'utf8',
        );

        expect(verifyWebhook(body, signature, secret)).toBe(true);
        expect(docs).toContain('/^sha256=[0-9a-f]{64}$/i.test(signature)');
        expect(docs).toContain('receivedBuffer.length === expectedBuffer.length');
    });
});
