import { waitUntil } from '@vercel/functions';
import { emitEmbeddedEvent } from './runs';

/** Keep customer-controlled webhook latency off the run's critical path. */
export function scheduleEmbeddedWebhook(
    projectId: string,
    event: string,
    data: Record<string, unknown>,
): void {
    waitUntil(emitEmbeddedEvent(projectId, event, data).catch((error: unknown) => {
        console.warn('[EmbeddedRun] Webhook delivery failed', {
            event,
            error: error instanceof Error ? error.name : 'unknown',
        });
    }));
}
