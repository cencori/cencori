/**
 * Cencori Memory SDK
 * 
 * Vector storage for RAG, conversation history, and semantic search.
 */

import type { CencoriConfig } from '../types';

// Types
export interface MemoryNamespace {
    id: string;
    name: string;
    description?: string;
    embeddingModel: string;
    dimensions: number;
    metadata: Record<string, unknown>;
    memoryCount?: number;
    createdAt: string;
}

export interface Memory {
    id: string;
    namespace: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity?: number;
    expiresAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateNamespaceOptions {
    name: string;
    description?: string;
    embeddingModel?: string;
    dimensions?: number;
    metadata?: Record<string, unknown>;
}

export interface StoreMemoryOptions {
    namespace: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
    expiresAt?: string | Date;
}

export interface SearchMemoryOptions {
    namespace: string;
    query: string;
    limit?: number;
    threshold?: number;
    filter?: Record<string, unknown>;
}

export interface SearchResult {
    results: Memory[];
    query: string;
    namespace: string;
    count: number;
    latencyMs: number;
}

/**
 * Memory class for vector storage operations
 */
export class MemoryClient {
    private config: CencoriConfig;
    private baseUrl: string;

    constructor(config: CencoriConfig) {
        this.config = config;
        this.baseUrl = config.baseUrl || 'https://cencori.com';
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
        };

        if (this.config.apiKey) {
            headers['CENCORI_API_KEY'] = this.config.apiKey;
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Request failed: ${response.status}`);
        }

        return response.json();
    }

    // ==================
    // Namespace Methods
    // ==================

    /**
     * Create a new memory namespace
     */
    async createNamespace(options: CreateNamespaceOptions): Promise<MemoryNamespace> {
        return this.request<MemoryNamespace>('/api/memory/namespaces', {
            method: 'POST',
            body: JSON.stringify(options),
        });
    }

    /**
     * List all namespaces for the project
     */
    async listNamespaces(): Promise<MemoryNamespace[]> {
        const response = await this.request<{ namespaces: MemoryNamespace[] }>(
            '/api/memory/namespaces'
        );
        return response.namespaces;
    }

    // ==================
    // Memory Methods
    // ==================

    /**
     * Store a memory in a namespace
     * 
     * @example
     * ```typescript
     * await cencori.memory.store({
     *   namespace: "conversations",
     *   content: "User asked about pricing plans",
     *   metadata: { userId: "user_123" }
     * });
     * ```
     */
    async store(options: StoreMemoryOptions): Promise<Memory> {
        const body = {
            ...options,
            expiresAt: options.expiresAt instanceof Date
                ? options.expiresAt.toISOString()
                : options.expiresAt,
        };

        return this.request<Memory>('/api/memory/store', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /**
     * Semantic search across memories
     * 
     * @example
     * ```typescript
     * const results = await cencori.memory.search({
     *   namespace: "conversations",
     *   query: "what did we discuss about pricing?",
     *   limit: 5
     * });
     * ```
     */
    async search(options: SearchMemoryOptions): Promise<SearchResult> {
        return this.request<SearchResult>('/api/memory/search', {
            method: 'POST',
            body: JSON.stringify(options),
        });
    }

    /**
     * Get a memory by ID
     */
    async get(id: string): Promise<Memory> {
        return this.request<Memory>(`/api/memory/${id}`);
    }

    /**
     * Delete a memory by ID
     */
    async delete(id: string): Promise<{ deleted: boolean; id: string }> {
        return this.request<{ deleted: boolean; id: string }>(`/api/memory/${id}`, {
            method: 'DELETE',
        });
    }

    /**
     * Store multiple memories in batch
     */
    async storeBatch(
        namespace: string,
        items: Array<{ content: string; metadata?: Record<string, unknown> }>
    ): Promise<Memory[]> {
        const results = await Promise.all(
            items.map(item => this.store({ namespace, ...item }))
        );
        return results;
    }

    /**
     * Delete all memories in a namespace matching a filter
     */
    async deleteByFilter(
        namespace: string,
        filter: Record<string, unknown>
    ): Promise<{ deleted: number }> {
        // First search to find matching memories
        const searchResult = await this.search({
            namespace,
            query: '*',
            limit: 1000,
            threshold: 0,
            filter,
        });

        // Delete each one
        await Promise.all(searchResult.results.map(r => this.delete(r.id)));

        return { deleted: searchResult.results.length };
    }
}

export function createMemoryClient(config: CencoriConfig): MemoryClient {
    return new MemoryClient(config);
}
