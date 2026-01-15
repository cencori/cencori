import { createAdminClient } from '@/lib/supabaseAdmin';
import { deliverWebhook, createWebhookEvent, WEBHOOK_EVENTS, type WebhookEventType } from './deliver';

interface Webhook {
    id: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    is_active: boolean;
}

/**
 * Trigger webhooks for a given event in a project
 */
export async function triggerWebhooks(
    projectId: string,
    eventType: WebhookEventType,
    eventData: Record<string, unknown>
): Promise<{ triggered: number; succeeded: number; failed: number }> {
    const supabase = createAdminClient();

    // Fetch active webhooks subscribed to this event
    const { data: webhooks, error } = await supabase
        .from('webhooks')
        .select('id, name, url, secret, events, is_active')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .contains('events', [eventType]);

    if (error || !webhooks || webhooks.length === 0) {
        return { triggered: 0, succeeded: 0, failed: 0 };
    }

    const payload = createWebhookEvent(eventType, projectId, eventData);

    // Deliver to all matching webhooks
    const results = await Promise.allSettled(
        webhooks.map(async (webhook: Webhook) => {
            const result = await deliverWebhook(webhook, payload);

            // Update webhook stats
            if (result.success) {
                await supabase
                    .from('webhooks')
                    .update({
                        last_triggered_at: new Date().toISOString(),
                        failure_count: 0,
                    })
                    .eq('id', webhook.id);
            } else {
                // Increment failure count using raw SQL
                const { data: currentWebhook } = await supabase
                    .from('webhooks')
                    .select('failure_count')
                    .eq('id', webhook.id)
                    .single();

                await supabase
                    .from('webhooks')
                    .update({
                        failure_count: (currentWebhook?.failure_count || 0) + 1,
                    })
                    .eq('id', webhook.id);
            }

            return result;
        })
    );

    const succeeded = results.filter(
        r => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - succeeded;

    return { triggered: webhooks.length, succeeded, failed };
}

/**
 * Helper to trigger security incident webhooks
 */
export async function triggerSecurityIncidentWebhook(
    projectId: string,
    incidentData: {
        incident_type: string;
        severity: string;
        description: string;
        risk_score: number;
    }
) {
    return triggerWebhooks(projectId, WEBHOOK_EVENTS.SECURITY_INCIDENT, incidentData);
}

/**
 * Helper to trigger request completed webhooks
 */
export async function triggerRequestCompletedWebhook(
    projectId: string,
    requestData: {
        request_id: string;
        model: string;
        tokens: number;
        latency_ms: number;
        cost_usd: number;
    }
) {
    return triggerWebhooks(projectId, WEBHOOK_EVENTS.REQUEST_COMPLETED, requestData);
}

/**
 * Helper to trigger quota warning webhooks
 */
export async function triggerQuotaWarningWebhook(
    projectId: string,
    quotaData: {
        current_usage: number;
        limit: number;
        percentage: number;
    }
) {
    return triggerWebhooks(projectId, WEBHOOK_EVENTS.QUOTA_WARNING, quotaData);
}

export { WEBHOOK_EVENTS };
