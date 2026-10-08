/**
 * @vitest-environment node
 *
 * Tensor's inference proxy.
 *
 * Tensor is a product built on Cencori: one customer, one project, one key. That key cannot ship
 * inside a desktop app — anyone who installs it could read it out of the bundle — so it lives here
 * and the app authenticates as the signed-in user instead.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticate = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/tensor-data', () => ({
    authenticateTensorDataRequest: (...args: unknown[]) => mockAuthenticate(...args),
}));

vi.mock('@/lib/tensor-auth', () => ({
    noStoreHeaders: () => ({ 'Cache-Control': 'no-store' }),
}));

const mockGetCachedAccess = vi.fn();
const mockSetCachedAccess = vi.fn();

vi.mock('@/lib/config-cache', () => ({
    getCachedTensorAccess: (...args: unknown[]) => mockGetCachedAccess(...args),
    setCachedTensorAccess: (...args: unknown[]) => mockSetCachedAccess(...args),
}));

const mockWarm = vi.fn();
vi.mock('@/lib/gateway/tensor-warm', () => ({
    warmTensorGateway: (...args: unknown[]) => mockWarm(...args),
}));
vi.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => void promise,
}));

const mockGatewayResponses = vi.fn();
const mockGatewayChat = vi.fn();
const mockGatewayModels = vi.fn();

vi.mock('@/app/api/v1/responses/route', () => ({
    POST: (...args: unknown[]) => mockGatewayResponses(...args),
}));
vi.mock('@/app/api/v1/chat/completions/route', () => ({
    POST: (...args: unknown[]) => mockGatewayChat(...args),
}));
vi.mock('@/app/api/v1/models/route', () => ({
    GET: (...args: unknown[]) => mockGatewayModels(...args),
}));

const PRODUCT_KEY = 'csk_the_products_own_key';
process.env.BASECODE_GATEWAY_API_KEY = PRODUCT_KEY;
const REMOTE_GATEWAY = 'https://api.cencori.com/v1';

const { GET, POST } = await import('@/app/api/tensor/inference/v1/[...path]/route');

function request(body: unknown = { model: 'gpt-4o', input: 'hi' }, token = 'session-token') {
    return new Request('https://cencori.com/api/tensor/inference/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }) as never;
}

/** The catch-all takes the path as a route parameter, the way Next hands it over. */
function at(...path: string[]) {
    return { params: Promise.resolve({ path }) } as never;
}

function signedIn(allowed: boolean, reason?: string) {
    mockRpc.mockResolvedValue({
        data: { allowed, ...(reason ? { reason } : {}) },
        error: null,
    });
    mockAuthenticate.mockResolvedValue({
        admin: { rpc: mockRpc },
        user: { id: 'user-tensor-1' },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    // Most tests drive the HTTP transport, which a configured gateway URL selects.
    process.env.BASECODE_GATEWAY_URL = REMOTE_GATEWAY;
    mockGetCachedAccess.mockResolvedValue(null);
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{"ok":true}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
        }))
    );
});

describe('who may run a turn', () => {
    it('refuses a request with no session', async () => {
        mockAuthenticate.mockResolvedValue(null);

        const response = await POST(request(), at('responses'));

        expect(response.status).toBe(401);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    /**
     * The gateway used to enforce this, because it recognised a Tensor key by `client_app` and
     * called the entitlement function itself. A product key carries no such mark, so without this
     * check a user could spend past their plan on the product's credits.
     */
    it('refuses a turn the plan does not allow', async () => {
        signedIn(false, 'weekly_budget_limit');

        const response = await POST(request(), at('responses'));

        expect(response.status).toBe(429);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('separates a concurrent turn from a spent budget', async () => {
        signedIn(false, 'concurrency_limit');

        expect((await POST(request(), at('responses'))).status).toBe(409);
    });
});

describe('what reaches the gateway', () => {
    it('sends the product key, and never returns it', async () => {
        signedIn(true);

        const response = await POST(request(), at('responses'));
        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            { headers: Record<string, string>; body: string },
        ];

        expect(init.headers.Authorization).toBe(`Bearer ${PRODUCT_KEY}`);
        // The decisive one: the key is the product's, and a client must never see it.
        const returned = await response.text();
        expect(returned).not.toContain(PRODUCT_KEY);
        expect(JSON.stringify([...response.headers])).not.toContain(PRODUCT_KEY);
    });

    /**
     * One key for the whole product would otherwise make every user indistinguishable in the
     * project's logs. The gateway reads `user` as the end user, so spend stays attributable.
     */
    it('attributes the turn to the person who ran it', async () => {
        signedIn(true);

        await POST(request(), at('responses'));
        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            { body: string },
        ];

        expect(JSON.parse(init.body)).toMatchObject({ model: 'gpt-4o', user: 'user-tensor-1' });
    });

    it('does not pass the caller their own session as a gateway credential', async () => {
        signedIn(true);

        await POST(request({ model: 'gpt-4o', input: 'hi' }, 'session-token'), at('responses'));
        const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            { headers: Record<string, string> },
        ];

        expect(init.headers.Authorization).not.toContain('session-token');
    });
});

describe('what the product key may be spent on', () => {
    function get(path: string[], token = 'session-token') {
        return [
            new Request(`https://cencori.com/api/tensor/inference/v1/${path.join('/')}`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            }) as never,
            at(...path),
        ] as const;
    }

    /**
     * An allowlist, because this route holds the product's key: anything it forwards is something
     * any signed-in user can spend that key on. A blind proxy would hand them the whole API.
     */
    it('refuses a path it does not serve', async () => {
        signedIn(true);

        const response = await POST(request(), at('embeddings'));

        expect(response.status).toBe(404);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refuses a method the path does not take', async () => {
        signedIn(true);

        expect((await GET(...get(['responses']))).status).toBe(404);
    });

    /**
     * Listing models costs nothing, and gating it would leave a user at their limit unable to see
     * which models exist — which reads as the app being broken rather than as a limit being hit.
     */
    it('lists models without charging them against the plan', async () => {
        signedIn(false, 'weekly_budget_limit');

        const response = await GET(...get(['models']));

        expect(response.status).toBe(200);
        expect(mockRpc).not.toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('still requires a session to list them', async () => {
        mockAuthenticate.mockResolvedValue(null);

        expect((await GET(...get(['models']))).status).toBe(401);
    });

    it('forwards chat completions under the plan, like a turn', async () => {
        signedIn(false, 'weekly_budget_limit');

        const response = await POST(request(), at('chat', 'completions'));

        expect(response.status).toBe(429);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sends each path on to its own upstream', async () => {
        signedIn(true);

        await POST(request(), at('chat', 'completions'));

        expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
            'https://api.cencori.com/v1/chat/completions'
        );
    });
});

/**
 * An agent turn makes many model calls under one reservation, and each one used to pay the
 * entitlement RPC again (0.8–1.7s). An allowed answer is cached; a refusal never is.
 */
describe('re-checking a turn already reserved', () => {
    it('skips the database when the turn was just confirmed', async () => {
        signedIn(true);
        mockGetCachedAccess.mockResolvedValue({ allowed: true });

        const response = await POST(request(), at('responses'));

        expect(response.status).toBe(200);
        expect(mockRpc).not.toHaveBeenCalled();
        expect(response.headers.get('Server-Timing')).toContain('tensor_lease_cached');
    });

    it('remembers an allowed turn for the next call', async () => {
        signedIn(true);

        await POST(request(), at('responses'));

        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockSetCachedAccess).toHaveBeenCalledWith('user-tensor-1', { allowed: true });
    });

    it('never remembers a refusal', async () => {
        signedIn(false, 'insufficient_credits');

        expect((await POST(request(), at('responses'))).status).toBe(429);
        expect(mockSetCachedAccess).not.toHaveBeenCalled();
    });

    it('does not touch the cache for calls that spend nothing', async () => {
        signedIn(true);

        await GET(
            new Request('https://cencori.com/api/tensor/inference/v1/models', {
                method: 'GET',
                headers: { Authorization: 'Bearer session-token' },
            }) as never,
            at('models'),
        );

        expect(mockGetCachedAccess).not.toHaveBeenCalled();
    });
});

/**
 * In production the gateway is this same deployment. Going out to api.cencori.com only to land back
 * here cost a TLS hop, edge routing and a second function invocation per call, so the handler is
 * called directly instead.
 */
describe('calling the gateway in-process', () => {
    beforeEach(() => {
        delete process.env.BASECODE_GATEWAY_URL;
        const ok = () => new Response('{"ok":true}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
        mockGatewayResponses.mockImplementation(async () => ok());
        mockGatewayChat.mockImplementation(async () => ok());
        mockGatewayModels.mockImplementation(async () => ok());
    });

    function lastGatewayRequest(mock: ReturnType<typeof vi.fn>) {
        return mock.mock.calls[0]?.[0] as Request;
    }

    it('hands the turn to the gateway handler without a network call', async () => {
        signedIn(true);

        const response = await POST(request(), at('responses'));

        expect(response.status).toBe(200);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockGatewayResponses).toHaveBeenCalledTimes(1);
        expect(new URL(lastGatewayRequest(mockGatewayResponses).url).pathname).toBe('/api/v1/responses');
    });

    it('routes each path to its own handler', async () => {
        signedIn(true);

        await POST(request(), at('chat', 'completions'));

        expect(mockGatewayChat).toHaveBeenCalledTimes(1);
        expect(mockGatewayResponses).not.toHaveBeenCalled();
        expect(new URL(lastGatewayRequest(mockGatewayChat).url).pathname).toBe('/api/v1/chat/completions');
    });

    it('authenticates with the product key and attributes the user', async () => {
        signedIn(true);

        const response = await POST(request(), at('responses'));
        const forwarded = lastGatewayRequest(mockGatewayResponses);

        expect(forwarded.headers.get('authorization')).toBe(`Bearer ${PRODUCT_KEY}`);
        expect(await forwarded.json()).toMatchObject({ model: 'gpt-4o', user: 'user-tensor-1' });
        expect(await response.text()).not.toContain(PRODUCT_KEY);
    });

    it("passes the caller's address through, not this function's", async () => {
        signedIn(true);
        const withIp = new Request('https://cencori.com/api/tensor/inference/v1/responses', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer session-token',
                'Content-Type': 'application/json',
                'x-forwarded-for': '203.0.113.7',
                'x-vercel-ip-country': 'NG',
            },
            body: JSON.stringify({ model: 'gpt-4o', input: 'hi' }),
        });

        await POST(new (await import('next/server')).NextRequest(withIp), at('responses'));
        const forwarded = lastGatewayRequest(mockGatewayResponses);

        expect(forwarded.headers.get('x-forwarded-for')).toBe('203.0.113.7');
        expect(forwarded.headers.get('x-vercel-ip-country')).toBe('NG');
    });

    it('still refuses a turn the plan does not allow, before the gateway', async () => {
        signedIn(false, 'weekly_budget_limit');

        expect((await POST(request(), at('responses'))).status).toBe(429);
        expect(mockGatewayResponses).not.toHaveBeenCalled();
    });

    it('lists models in-process too', async () => {
        signedIn(true);

        const response = await GET(
            new Request('https://cencori.com/api/tensor/inference/v1/models', {
                method: 'GET',
                headers: { Authorization: 'Bearer session-token' },
            }) as never,
            at('models'),
        );

        expect(response.status).toBe(200);
        expect(mockGatewayModels).toHaveBeenCalledTimes(1);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('readying the gateway while a prompt is typed', () => {
    beforeEach(() => {
        mockWarm.mockReset().mockResolvedValue(undefined);
        mockGatewayResponses.mockReset();
    });

    it('warms for the signed-in user and the model they picked, and calls no model', async () => {
        mockAuthenticate.mockResolvedValue({ admin: {}, user: { id: 'user-1' } });
        const response = await POST(
            new Request('https://cencori.com/api/tensor/inference/v1/warm', {
                method: 'POST',
                headers: { Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'deepseek-v4-pro' }),
            }) as never,
            at('warm'),
        );

        expect(response.status).toBe(204);
        expect(mockWarm).toHaveBeenCalledWith('user-1', 'deepseek-v4-pro');
        expect(mockGatewayResponses).not.toHaveBeenCalled();
    });

    it('refuses anyone who is not signed in', async () => {
        mockAuthenticate.mockResolvedValue(null);
        const response = await POST(
            new Request('https://cencori.com/api/tensor/inference/v1/warm', {
                method: 'POST',
                headers: { Authorization: 'Bearer forged' },
            }) as never,
            at('warm'),
        );

        expect(response.status).toBe(401);
        expect(mockWarm).not.toHaveBeenCalled();
    });
});
