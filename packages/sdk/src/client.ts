import type { CencoriConfig, RequestOptions } from './types/common';
import { AIModule } from './modules/ai';
import { fetchWithRetry } from './utils';
import {
    CencoriError,
    AuthenticationError,
    RateLimitError,
    SafetyError
} from './errors';

interface ErrorResponse {
    error?: string;
    reasons?: string[];
}

export class CencoriClient {
    private apiKey: string;
    private baseUrl: string;

    public ai: AIModule;

    constructor(config: CencoriConfig) {
        if (!config.apiKey) {
            throw new Error('API key is required');
        }

        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://cencori.com';

        this.ai = new AIModule(this);
    }

    async request<T>(endpoint: string, options: RequestOptions): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'CENCORI_API_KEY': this.apiKey,
            ...options.headers
        };

        try {
            const response = await fetchWithRetry(url, {
                method: options.method,
                headers,
                body: options.body
            });

            const data: unknown = await response.json();

            // Handle API errors
            if (!response.ok) {
                const errorData = data as ErrorResponse;

                if (response.status === 401) {
                    throw new AuthenticationError(errorData.error || 'Invalid API key');
                }
                if (response.status === 429) {
                    throw new RateLimitError(errorData.error || 'Rate limit exceeded');
                }
                if (response.status === 400 && errorData.reasons) {
                    throw new SafetyError(errorData.error, errorData.reasons);
                }
                throw new CencoriError(
                    errorData.error || 'Request failed',
                    response.status
                );
            }

            return data as T;
        } catch (error) {
            // Re-throw custom errors
            if (error instanceof CencoriError) {
                throw error;
            }

            // Wrap unknown errors
            throw new CencoriError(
                error instanceof Error ? error.message : 'Unknown error occurred'
            );
        }
    }
}
