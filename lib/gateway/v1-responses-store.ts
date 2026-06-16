/**
 * In-memory response store for Responses API multi-turn.
 * Responses are stored with TTL and can be referenced
 * via previous_response_id for conversation chaining.
 */

import type { ResponsesResponse } from './v1-responses-execute';

const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface StoredResponse {
    response: ResponsesResponse;
    expiresAt: number;
}

const store = new Map<string, StoredResponse>();

const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of store) {
        if (entry.expiresAt < now) store.delete(id);
    }
}, 60_000);

if (cleanup.unref) cleanup.unref();

export function storeResponse(response: ResponsesResponse): void {
    store.set(response.id, {
        response,
        expiresAt: Date.now() + TTL_MS,
    });
}

export function getResponse(id: string): ResponsesResponse | null {
    const entry = store.get(id);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        store.delete(id);
        return null;
    }
    return entry.response;
}
