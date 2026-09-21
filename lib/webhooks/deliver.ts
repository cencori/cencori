import crypto from 'crypto';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

interface WebhookPayload {
    event: string;
    project_id: string;
    timestamp: string;
    data: Record<string, unknown>;
}

interface Webhook {
    id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
}

/**
 * Sign a webhook payload using HMAC-SHA256
 */
export function signPayload(payload: object, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
}

/**
 * Deliver a webhook with retry logic
 */
export async function deliverWebhook(
    webhook: Webhook,
    payload: WebhookPayload,
    maxRetries = 3
): Promise<{ success: boolean; statusCode?: number; error?: string; attempts: number }> {
    const signature = signPayload(payload, webhook.secret);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await safeOutboundFetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                    'X-Webhook-Event': payload.event,
                    'X-Webhook-Timestamp': payload.timestamp,
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000), // 10 second timeout
            }, { maxRedirects: 0 });

            if (response.ok) {
                return { success: true, statusCode: response.status, attempts: attempt };
            }

            // Non-retryable status codes (4xx except 429)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                return {
                    success: false,
                    statusCode: response.status,
                    error: `HTTP ${response.status}`,
                    attempts: attempt,
                };
            }

            // Retryable - wait with exponential backoff
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            if (attempt >= maxRetries) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    attempts: attempt,
                };
            }
            // Wait before retry
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return { success: false, error: 'Max retries exceeded', attempts: maxRetries };
}

/**
 * Create a webhook event payload
 */
export function createWebhookEvent(
    eventType: string,
    projectId: string,
    data: Record<string, unknown>
): WebhookPayload {
    return {
        event: eventType,
        project_id: projectId,
        timestamp: new Date().toISOString(),
        data,
    };
}

/**
 * Event types
 */
export const WEBHOOK_EVENTS = {
    REQUEST_COMPLETED: 'request.completed',
    REQUEST_FAILED: 'request.failed',
    SECURITY_INCIDENT: 'security.incident',
    QUOTA_WARNING: 'quota.warning',
    QUOTA_EXCEEDED: 'quota.exceeded',
    ANOMALY_DETECTED: 'anomaly.detected',
    COST_THRESHOLD: 'cost.threshold',
    // M1 Embedded Agents slice.
    RUN_QUEUED: 'run.queued',
    RUN_STARTED: 'run.started',
    RUN_COMPLETED: 'run.completed',
    RUN_FAILED: 'run.failed',
    RUN_CANCELLED: 'run.cancelled',
    KNOWLEDGE_SOURCE_QUEUED: 'knowledge_source.queued',
    KNOWLEDGE_SOURCE_READY: 'knowledge_source.ready',
    KNOWLEDGE_SOURCE_FAILED: 'knowledge_source.failed',
    // M2 Embedded Agents slice.
    ACTION_REQUIRED: 'action.required',
    ACTION_APPROVED: 'action.approved',
    ACTION_REJECTED: 'action.rejected',
    ACTION_EXPIRED: 'action.expired',
    ACTION_EXECUTED: 'action.executed',
    ACTION_FAILED: 'action.failed',
    CONNECTION_PENDING: 'connection.pending',
    CONNECTION_ACTIVE: 'connection.active',
    CONNECTION_EXPIRED: 'connection.expired',
    CONNECTION_REVOKED: 'connection.revoked',
    CONNECTION_ERROR: 'connection.error',
    // M4 lifecycle.
    TENANT_DELETED: 'tenant.deleted',
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];
