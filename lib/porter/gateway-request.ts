import { NextRequest } from 'next/server';
import { hashApiKey } from '@/lib/api-keys';

type PorterDelegation = {
    porterId: string;
    projectId: string;
    keyHash: string;
};

// A capability attached to this exact in-process request. Headers, cookies, and
// even a valid public Porter session cannot manufacture gateway authorization.
const delegations = new WeakMap<NextRequest, PorterDelegation>();

export function createPorterGatewayRequest(input: {
    requestUrl: string;
    porterId: string;
    projectId: string;
    apiKey: string;
    visitorIp: string;
    body: { model: string; messages: { role: string; content: string }[]; stream: boolean };
}): NextRequest {
    const request = new NextRequest(new URL('/api/v1/chat/completions', input.requestUrl), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${input.apiKey}`,
            'Content-Type': 'application/json',
            'X-Forwarded-For': input.visitorIp,
            'X-Cencori-App': 'porter',
        },
        body: JSON.stringify(input.body),
    });
    delegations.set(request, {
        porterId: input.porterId,
        projectId: input.projectId,
        keyHash: hashApiKey(input.apiKey),
    });
    return request;
}

export function consumePorterGatewayDelegation(request: NextRequest): PorterDelegation | undefined {
    const delegation = delegations.get(request);
    delegations.delete(request);
    if (request.method !== 'POST' || request.nextUrl.pathname !== '/api/v1/chat/completions') return;
    return delegation;
}
