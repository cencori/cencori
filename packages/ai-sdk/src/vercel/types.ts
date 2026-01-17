/**
 * Types for Cencori AI Provider (Vercel AI SDK Integration)
 */

export interface CencoriProviderSettings {
    /**
     * Cencori API key (csk_ prefix)
     */
    apiKey?: string;

    /**
     * Base URL for the Cencori API
     * @default 'https://cencori.com'
     */
    baseUrl?: string;

    /**
     * Custom headers to include in requests
     */
    headers?: Record<string, string>;
}

export interface CencoriChatSettings {
    /**
     * Optional user ID for rate limiting and analytics
     */
    userId?: string;
}
