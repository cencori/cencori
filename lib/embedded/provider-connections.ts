import type { createAdminClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/encryption';
import { assertSafeOutboundUrl, UnsafeOutboundUrlError } from '@/lib/security/outbound-url';
import type { ProviderApiFormat } from './types';

type Admin = ReturnType<typeof createAdminClient>;

// Official providers must use Cencori-owned origins; base_url is never caller-editable.
const OFFICIAL_PROVIDERS = new Set([
    'openai', 'anthropic', 'google', 'cohere', 'xai', 'deepseek', 'groq', 'mistral',
    'together', 'openrouter', 'perplexity', 'huggingface', 'zai', 'cerebras', 'qwen',
    'meta', 'maximo', 'helix', 'centaur', 'bai',
]);

export function isOfficialProvider(provider: string): boolean {
    return OFFICIAL_PROVIDERS.has(provider.toLowerCase());
}

export function keyHintFor(apiKey: string): string {
    return apiKey.length > 4 ? `...${apiKey.slice(-4)}` : '****';
}

export interface CreateConnectionInput {
    name: string;
    provider: string;
    apiFormat?: ProviderApiFormat;
    baseUrl?: string;
    apiKey?: string;
}

export async function validateConnectionInput(
    input: CreateConnectionInput,
    _opts?: { organizationId: string },
): Promise<{ ok: true; baseUrl: string | null } | { ok: false; code: string; message: string }> {
    if (!input.name?.trim()) return { ok: false, code: 'invalid_request_error', message: 'name is required' };
    if (!input.provider?.trim()) return { ok: false, code: 'invalid_request_error', message: 'provider is required' };
    const provider = input.provider.trim().toLowerCase();

    if (isOfficialProvider(provider)) {
        if (input.baseUrl && input.baseUrl.trim()) {
            return { ok: false, code: 'invalid_request_error', message: 'base_url is not editable for official providers' };
        }
        return { ok: true, baseUrl: null };
    }

    // Custom compatible provider: explicit public HTTPS base URL required.
    if (!input.baseUrl?.trim()) {
        return { ok: false, code: 'invalid_request_error', message: 'base_url is required for custom providers' };
    }
    try {
        const url = await assertSafeOutboundUrl(input.baseUrl.trim());
        if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
            return { ok: false, code: 'unsafe_provider_url', message: 'Custom provider base_url must be public HTTPS' };
        }
        return { ok: true, baseUrl: url.toString() };
    } catch (e) {
        if (e instanceof UnsafeOutboundUrlError) {
            return { ok: false, code: 'unsafe_provider_url', message: e.message };
        }
        return { ok: false, code: 'unsafe_provider_url', message: 'Invalid base_url' };
    }
}

export async function persistConnection(
    supabase: Admin,
    opts: { projectId: string; organizationId: string; input: CreateConnectionInput; idempotencyKey?: string | null },
): Promise<{ id: string }> {
    const validated = await validateConnectionInput(opts.input, { organizationId: opts.organizationId });
    if (!validated.ok) throw Object.assign(new Error(validated.message), { code: validated.code, status: 400 });

    const provider = opts.input.provider.trim().toLowerCase();
    const format = (opts.input.apiFormat ?? (provider === 'anthropic' ? 'anthropic' : 'openai')).toLowerCase() as ProviderApiFormat;
    const encrypted = opts.input.apiKey ? encryptApiKey(opts.input.apiKey, opts.organizationId) : null;

    // Idempotent create: reuse existing row with same name+provider when key supplied.
    if (opts.idempotencyKey) {
        const { data: existing } = await supabase
            .from('provider_connections')
            .select('id')
            .eq('project_id', opts.projectId)
            .eq('provider', provider)
            .eq('name', opts.input.name.trim())
            .maybeSingle();
        if (existing) return { id: existing.id as string };
    }

    const { data, error } = await supabase
        .from('provider_connections')
        .insert({
            project_id: opts.projectId,
            name: opts.input.name.trim(),
            provider,
            api_format: isOfficialProvider(provider) && (format === 'openai-compatible' || format === 'anthropic-compatible') ? 'openai' : format,
            base_url: validated.baseUrl,
            encrypted_key_ref: encrypted,
            key_hint: opts.input.apiKey ? keyHintFor(opts.input.apiKey) : null,
            status: 'active',
        })
        .select('id')
        .single();
    if (error || !data) throw Object.assign(new Error(error?.message ?? 'Failed to create provider connection'), { status: 500 });
    return { id: data.id as string };
}

export function sanitizeConnection<T extends Record<string, unknown>>(row: T): T {
    const clone = { ...row };
    delete (clone as Record<string, unknown>).encrypted_key_ref;
    return clone;
}
