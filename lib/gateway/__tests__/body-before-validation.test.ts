/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

/**
 * validateGatewayRequest reads the request body: with an empty wallet it needs
 * the model to tell whether the call runs on the customer's own key. A body
 * that a route has already started reading can't be read or cloned again, so
 * the check fails closed and a customer on their own key gets 403
 * credit_balance_exhausted. That shipped on /v1/chat/completions.
 */
const ROUTES = [
    'app/api/v1/chat/completions/route.ts',
    'app/api/v1/responses/route.ts',
    'app/api/v1/sessions/route.ts',
    'app/api/v1/sessions/[id]/turns/route.ts',
    'app/api/ai/completions/route.ts',
    'app/api/ai/embeddings/route.ts',
    'app/api/ai/images/generate/route.ts',
    'app/api/ai/audio/speech/route.ts',
    'lib/gateway/ai-chat-handler.ts',
];

describe('routes leave the body readable for validation', () => {
    it('a body being read can no longer be cloned, which is why this matters', async () => {
        const make = () => new NextRequest('http://localhost/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4.1-mini' }),
        });
        const readFirst = make();
        const pending = readFirst.json();
        expect(() => readFirst.clone()).toThrow();
        await pending;

        const cloneFirst = make();
        const body = cloneFirst.clone().json();
        expect(await cloneFirst.clone().json()).toEqual({ model: 'gpt-4.1-mini' });
        expect(await body).toEqual({ model: 'gpt-4.1-mini' });
    });

    it.each(ROUTES)('%s does not read the request itself before validating it', (file) => {
        const source = readFileSync(path.join(process.cwd(), file), 'utf8');
        const validates = source.indexOf('validateGatewayRequest(req');
        expect(validates).toBeGreaterThan(-1);
        const before = source.slice(0, validates);
        // `req.clone().json()` is fine; a direct read of `req` is not.
        expect(before).not.toMatch(/\breq\.(json|text|formData|arrayBuffer|blob)\(\)/);
    });
});
