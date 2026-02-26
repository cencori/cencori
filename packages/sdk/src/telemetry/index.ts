/**
 * Cencori Telemetry Client
 *
 * Report web traffic from your application to the Cencori dashboard.
 * Logs appear under the project's "Web Gateway" tab with your app's
 * real domain as the host.
 *
 * @example
 * const cencori = new Cencori({ apiKey: 'csk_...' });
 *
 * // In your server middleware / API route handler:
 * await cencori.telemetry.reportWebRequest({
 *   host: 'dochat-zeta.vercel.app',
 *   method: 'GET',
 *   path: '/api/chat',
 *   statusCode: 200,
 * });
 */

import type { CencoriConfig } from '../types';

export interface WebTelemetryPayload {
    /** The hostname of your application, e.g. "dochat-zeta.vercel.app" */
    host: string;
    /** HTTP method: GET, POST, PUT, DELETE, etc. */
    method: string;
    /** Request path, e.g. "/api/chat" */
    path: string;
    /** HTTP status code returned */
    statusCode: number;

    /** Optional unique request ID for tracing */
    requestId?: string;
    /** Query string without the leading "?" */
    queryString?: string;
    /** Human-readable log message */
    message?: string;
    /** Client User-Agent string */
    userAgent?: string;
    /** Referer header value */
    referer?: string;
    /** Client IP address */
    ipAddress?: string;
    /** ISO 3166-1 alpha-2 country code */
    countryCode?: string;
    /** Request latency in milliseconds */
    latencyMs?: number;
}

export class TelemetryClient {
    private config: Required<CencoriConfig>;

    constructor(config: Required<CencoriConfig>) {
        this.config = config;
    }

    /**
     * Report a web request to the Cencori dashboard.
     *
     * Fire-and-forget — this method never throws and never blocks
     * your application. If the request fails, the error is silently
     * swallowed so it cannot disrupt your app's critical path.
     *
     * @param payload - Web request details to log
     *
     * @example
     * await cencori.telemetry.reportWebRequest({
     *   host: req.headers.get('host') || 'unknown',
     *   method: req.method,
     *   path: new URL(req.url).pathname,
     *   statusCode: response.status,
     *   userAgent: req.headers.get('user-agent') || undefined,
     *   latencyMs: Date.now() - startTime,
     * });
     */
    async reportWebRequest(payload: WebTelemetryPayload): Promise<void> {
        try {
            const url = `${this.config.baseUrl}/api/v1/telemetry/web`;

            await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CENCORI_API_KEY': this.config.apiKey,
                },
                body: JSON.stringify(payload),
            });
        } catch {
            // Telemetry is best-effort — never disrupt the customer's app.
        }
    }
}
