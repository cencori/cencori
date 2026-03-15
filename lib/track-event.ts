import { createAdminClient } from '@/lib/supabaseAdmin';

export type PlatformEventType =
    // Auth
    | 'user.signup'
    | 'user.invite_accepted'
    // Organization
    | 'org.invite_sent'
    | 'org.provider_added'
    // API Keys
    | 'api_key.generated'
    | 'api_key.revoked'
    | 'api_key.deleted'
    // Scan Web
    | 'scan.project_imported'
    | 'scan.triggered'
    | 'scan.completed'
    | 'scan.fixes_generated'
    | 'scan.fixes_applied'
    // Config
    | 'custom_rule.created'
    | 'prompt.created'
    | 'cache.settings_changed'
    | 'provider.added'
    // Billing
    | 'subscription.created'
    | 'subscription.canceled'
    | 'credits.topup'
    // Webhooks
    | 'webhook.created';

export type PlatformProduct =
    | 'gateway'
    | 'scan_web'
    | 'scan_cli'
    | 'dashboard'
    | 'billing';

interface TrackEventOptions {
    event_type: PlatformEventType;
    product: PlatformProduct;
    user_id?: string | null;
    organization_id?: string | null;
    project_id?: string | null;
    metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget platform event tracking.
 * Never throws, never blocks the caller.
 */
export function trackEvent(options: TrackEventOptions): void {
    _trackEventAsync(options).catch((err) => {
        console.error('[trackEvent] Failed:', options.event_type, err);
    });
}

async function _trackEventAsync(options: TrackEventOptions): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from('platform_events').insert({
        event_type: options.event_type,
        product: options.product,
        user_id: options.user_id ?? null,
        organization_id: options.organization_id ?? null,
        project_id: options.project_id ?? null,
        metadata: options.metadata ?? {},
    });

    if (error) {
        console.error('[trackEvent] Insert error:', error);
    }
}
