import type { CencoriConfig } from '../types';

export interface Session {
    id: string;
    status: 'active' | 'paused' | 'completed' | 'failed';
    turn_count: number;
    created_at: string;
    updated_at: string;
    agent_id: string | null;
    metadata: Record<string, unknown>;
    total_cost: number;
}

export interface SessionEvent {
    id: string;
    session_id: string;
    turn_number: number;
    sequence: number;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
}

export interface CreateSessionParams {
    agent_id?: string;
    metadata?: Record<string, unknown>;
}

export interface TurnParams {
    input: string | Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    instructions?: string;
    agent_id?: string;
    model?: string;
    temperature?: number;
    max_output_tokens?: number;
    tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string };
    response_format?: Record<string, unknown>;
    user?: string;
    pause_on_tool_calls?: boolean;
}

export interface ApproveRejectParams {
    action_id: string;
    tool_results?: Array<{ action_id: string; output: string }>;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

export interface SessionListParams {
    page?: number;
    limit?: number;
    status?: 'active' | 'paused' | 'completed' | 'failed';
    agent_id?: string;
}

export class SessionsNamespace {
    private config: Required<CencoriConfig>;

    constructor(config: Required<CencoriConfig>) {
        this.config = config;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const response = await fetch(`${this.config.baseUrl}${path}`, {
            method,
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: { message?: string } };
            throw new Error(`Cencori API error: ${errorData.error?.message || response.statusText}`);
        }

        if (response.status === 204) return undefined as T;
        return response.json() as Promise<T>;
    }

    async create(params?: CreateSessionParams): Promise<Session> {
        return this.request<Session>('POST', '/v1/sessions', params || {});
    }

    async list(params?: SessionListParams): Promise<PaginatedResponse<Session>> {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));
        if (params?.status) searchParams.set('status', params.status);
        if (params?.agent_id) searchParams.set('agent_id', params.agent_id);
        const qs = searchParams.toString();
        return this.request<PaginatedResponse<Session>>('GET', `/v1/sessions${qs ? `?${qs}` : ''}`);
    }

    async get(sessionId: string): Promise<Session> {
        return this.request<Session>('GET', `/v1/sessions/${sessionId}`);
    }

    async delete(sessionId: string): Promise<{ id: string; deleted: boolean }> {
        return this.request<{ id: string; deleted: boolean }>('DELETE', `/v1/sessions/${sessionId}`);
    }

    async submitTurn(sessionId: string, params: TurnParams): Promise<Response> {
        const url = `${this.config.baseUrl}/v1/sessions/${sessionId}/turns`;
        return fetch(url, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify(params),
        });
    }

    async submitTurnStream(sessionId: string, params: TurnParams): Promise<ReadableStream<Uint8Array> | null> {
        const response = await this.submitTurn(sessionId, params);
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`Cencori API error: ${err.error?.message || response.statusText}`);
        }
        return response.body;
    }

    async getEvents(
        sessionId: string,
        params?: { page?: number; limit?: number; turn_number?: number },
    ): Promise<PaginatedResponse<SessionEvent>> {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));
        if (params?.turn_number) searchParams.set('turn_number', String(params.turn_number));
        const qs = searchParams.toString();
        return this.request<PaginatedResponse<SessionEvent>>('GET', `/v1/sessions/${sessionId}/events${qs ? `?${qs}` : ''}`);
    }

    async approve(sessionId: string, params: ApproveRejectParams): Promise<Response> {
        const url = `${this.config.baseUrl}/v1/sessions/${sessionId}/approve`;
        return fetch(url, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.config.apiKey,
                'Content-Type': 'application/json',
                ...this.config.headers,
            },
            body: JSON.stringify(params),
        });
    }

    async approveStream(sessionId: string, params: ApproveRejectParams): Promise<ReadableStream<Uint8Array> | null> {
        const response = await this.approve(sessionId, params);
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`Cencori API error: ${err.error?.message || response.statusText}`);
        }
        return response.body;
    }

    async reject(sessionId: string, params: ApproveRejectParams): Promise<{ id: string; action_id: string; resolution: string; status: string }> {
        return this.request('POST', `/v1/sessions/${sessionId}/reject`, params);
    }
}
