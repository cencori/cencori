import type { CencoriConfig } from '../types';

export interface AgentConfig {
    model: string;
    system_prompt: string | null;
    tools: string[];
    temperature: number | null;
}

export interface Agent {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    shadow_mode: boolean;
    created_at: string;
    updated_at?: string;
    config: AgentConfig;
}

export interface AgentListItem {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    shadow_mode: boolean;
    created_at: string;
}

export interface CreateAgentParams {
    name: string;
    description?: string;
    config?: {
        model?: string;
        system_prompt?: string;
        tools?: string[];
        temperature?: number;
    };
}

export interface UpdateAgentParams {
    name?: string;
    description?: string;
    is_active?: boolean;
    shadow_mode?: boolean;
    config?: {
        model?: string;
        system_prompt?: string;
        tools?: string[];
        temperature?: number;
    };
}

export interface AgentKey {
    id: string;
    name: string;
    key_prefix: string;
    full_key?: string;
    environment: string;
    key_type: string;
    agent_id: string;
    created_at: string;
}

export interface CreateAgentKeyParams {
    name?: string;
    environment?: 'production' | 'test';
    key_type?: 'secret' | 'publishable';
    allowed_domains?: string[];
}

export class AgentsNamespace {
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

    async create(params: CreateAgentParams): Promise<Agent> {
        return this.request<Agent>('POST', '/v1/agents', params);
    }

    async list(): Promise<{ data: AgentListItem[] }> {
        return this.request<{ data: AgentListItem[] }>('GET', '/v1/agents');
    }

    async get(agentId: string): Promise<Agent> {
        return this.request<Agent>('GET', `/v1/agents/${agentId}`);
    }

    async updateConfig(agentId: string, params: UpdateAgentParams): Promise<Agent> {
        return this.request<Agent>('PATCH', `/v1/agents/${agentId}`, params);
    }

    async delete(agentId: string): Promise<void> {
        return this.request<void>('DELETE', `/v1/agents/${agentId}`);
    }

    async createKey(agentId: string, params?: CreateAgentKeyParams): Promise<AgentKey> {
        return this.request<AgentKey>('POST', `/v1/agents/${agentId}/keys`, params || {});
    }
}
