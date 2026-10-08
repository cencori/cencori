import crypto from 'node:crypto';
import { getCachedTensorAccess } from '@/lib/config-cache';
import { loadApiKeyConfig } from '@/lib/gateway-middleware';
import { resolveGatewayProvider } from '@/lib/gateway/providers-setup';
import { warmGatewayProjectConfig } from '@/lib/gateway/request-config';
import { createAdminClient } from '@/lib/supabaseAdmin';

/**
 * Readies the gateway for a Tensor turn that is about to be sent.
 *
 * Its per-project caches live for 60 seconds, which is also what bounds a revoked key or a changed
 * setting, so they stay short. But a prompt typed after a minute's pause met every one of them
 * cold: 2.2–2.9s of preflight against 0.16–0.2s warm, most of it the API key lookup, the project
 * bundle, and provider resolution (custom providers, BYOK keys, pricing), several of them serial.
 * The app calls this while the prompt is being typed, so those lookups have run by the time it is
 * sent. It runs exactly what a request runs, calls no model, and never fails a caller.
 */
export async function warmTensorGateway(userId: string, requestedModel: string | null): Promise<void> {
    const productKey = process.env.BASECODE_GATEWAY_API_KEY?.trim();
    if (!productKey) return;
    const supabase = createAdminClient();
    try {
        const keyHash = crypto.createHash('sha256').update(productKey).digest('hex');
        const { data: key } = await loadApiKeyConfig(supabase, keyHash);
        const projectId = typeof key?.project_id === 'string' ? key.project_id : null;
        const organizationId = key?.projects?.organization_id;
        if (!projectId || typeof organizationId !== 'string') return;

        await warmGatewayProjectConfig(supabase, projectId);
        if (!requestedModel) return;
        const access = await getCachedTensorAccess<{ model_policy?: string }>(userId);
        const policy = access?.model_policy;
        await resolveGatewayProvider({
            supabase,
            projectId,
            organizationId,
            requestedModel,
            tensorModelPolicy:
                policy === 'auto' || policy === 'open_weight' || policy === 'frontier' || policy === 'custom'
                    ? policy
                    : null,
            allowedModels: Array.isArray(key.allowed_models) ? key.allowed_models : null,
            sponsoredModels: Array.isArray(key.sponsored_models) ? key.sponsored_models : null,
        });
    } catch {
        // A model the plan refuses, or a lookup that failed: the real request will say so properly.
    }
}
