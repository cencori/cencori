import { createAdminClient } from '@/lib/supabaseAdmin';
import { triggerWebhooks } from '@/lib/webhooks/trigger';

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

/** Emit a signed project webhook + record per-endpoint delivery rows (M1). */
export async function emitEmbeddedEvent(projectId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
    const supabase = createAdminClient();
    const eventId = `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    let succeeded = 0;
    let failed = 0;
    try {
        const result = await triggerWebhooks(projectId, eventType as never, { ...data, event_id: eventId });
        succeeded = result.succeeded;
        failed = result.failed;
    } catch {
        failed += 1;
    }
    try {
        const { data: endpoints } = await supabase.from('webhooks').select('id').eq('project_id', projectId).eq('is_active', true).contains('events', [eventType]);
        for (const ep of (endpoints ?? []) as Array<{ id: string }>) {
            await supabase.from('webhook_deliveries').insert({
                endpoint_id: ep.id,
                event_id: eventId,
                event_type: eventType,
                status: failed > 0 && succeeded === 0 ? 'failed' : 'delivered',
                attempt_count: 1,
            });
        }
    } catch {
        // Delivery logging must never break the run lifecycle.
    }
}

export async function appendRunEvent(supabase: Admin, runId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    await supabase.from('embedded_run_events').insert({ run_id: runId, event_type: eventType, payload });
}
