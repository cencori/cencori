/**
 * Types for Cencori AI Provider
 */

export interface CencoriProviderSettings {
    /**
     * Cencori API key (csk_ or cpk_ prefix)
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
