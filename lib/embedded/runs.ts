import { createAdminClient } from '@/lib/supabaseAdmin';
import { triggerWebhooks, type WebhookDeliveryResult } from '@/lib/webhooks/trigger';
import { withPublicIds } from './public-ids';

type Admin = ReturnType<typeof createAdminClient>;

export const RUN_TERMINAL = ['completed', 'failed', 'cancelled', 'expired'] as const;

export function canTransition(from: string, to: string): boolean {
    if (RUN_TERMINAL.includes(from as never)) return false;
    const allowed: Record<string, string[]> = {
        queued: ['running', 'cancelled', 'expired'],
        running: ['requires_action', 'completed', 'failed', 'cancelled', 'expired'],
        requires_action: ['running', 'completed', 'failed', 'cancelled', 'expired'],
    };
    return (allowed[from] ?? []).includes(to);
}

/**
 * Send a signed project webhook and log one delivery per endpoint: what it
 * answered, how many attempts it took, and the data sent (so a replay can
 * send the same event again). Ids go out as the API returns them.
 */
export async function emitEmbeddedEvent(projectId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
    const supabase = createAdminClient();
    const eventId = `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const payload = { ...withPublicIds(data), event_id: eventId };
    let deliveries: WebhookDeliveryResult[] = [];
    try {
        deliveries = (await triggerWebhooks(projectId, eventType as never, payload)).deliveries;
    } catch {
        return;
    }
    try {
        for (const delivery of deliveries) {
            const row = {
                endpoint_id: delivery.webhookId,
                event_id: eventId,
                event_type: eventType,
                status: delivery.success ? 'delivered' : 'failed',
                attempt_count: delivery.attempts,
                response_code: delivery.statusCode,
            };
            const { error } = await supabase.from('webhook_deliveries').insert({ ...row, payload });
            // A database without the payload column yet still gets its log row.
            if (error) await supabase.from('webhook_deliveries').insert(row);
        }
    } catch {
        // Delivery logging must never break the run lifecycle.
    }
}

export async function appendRunEvent(supabase: Admin, runId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    await supabase.from('embedded_run_events').insert({ run_id: runId, event_type: eventType, payload });
}
