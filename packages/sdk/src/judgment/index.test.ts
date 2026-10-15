import { describe, it, expect, vi, afterEach } from 'vitest';
import { JudgmentNamespace } from './index';

afterEach(() => {
    vi.restoreAllMocks();
});

function client() {
    return new JudgmentNamespace({ apiKey: 'csk_test', baseUrl: 'https://cencori.com', headers: {} });
}

describe('judgment', () => {
    it('posts state and questions to /api/v1/judgments', async () => {
        const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({
                object: 'judgment',
                model: 'jev-1.13.0',
                answers: { refund: { type: 'noul', noul: 0.95 } },
                usage: { input_tokens: 100, output_tokens: 5 },
            }), { status: 200 }),
        );

        const res = await client().judge({
            state: 'Charged twice, refund please',
            questions: { refund: { type: 'noul', instructions: 'Requests a refund?' } },
        });

        expect(spy).toHaveBeenCalledOnce();
        const [url, init] = spy.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://cencori.com/api/v1/judgments');
        expect((init.headers as Record<string, string>)['CENCORI_API_KEY']).toBe('csk_test');
        const body = JSON.parse(String(init.body));
        expect(body.questions.refund.type).toBe('noul');
        expect(res.model).toBe('jev-1.13.0');
        expect(res.answers.refund).toEqual({ type: 'noul', noul: 0.95 });
    });

    it('rejects empty questions client-side', async () => {
        const spy = vi.spyOn(global, 'fetch');
        await expect(client().judge({ state: 'x', questions: {} })).rejects.toThrowError(/non-empty/);
        expect(spy).not.toHaveBeenCalled();
    });

    it('throws coded errors from the gateway', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'provider_connection_required', message: 'No typesafe key configured.' }), { status: 402 }),
        );
        const error = await client().judge({
            state: 'x',
            questions: { q: { type: 'noul', instructions: 'Yes?' } },
        }).catch((e) => e) as Error & { code?: string };
        expect(error.code).toBe('provider_connection_required');
    });

    it('lists models', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({
                object: 'list',
                endpoint: 'POST /v1/judgments',
                context_tokens: 64000,
                data: [{ id: 'jev-latest', owned_by: 'typesafe', type: 'judgment' }],
                question_types: ['noul', 'choice', 'score'],
                default_model: 'jev-latest',
            }), { status: 200 }),
        );
        const res = await client().listModels();
        expect(res.data.map((m) => m.id)).toEqual(['jev-latest']);
        expect(res.default_model).toBe('jev-latest');
    });
});
