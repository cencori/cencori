import type { createAdminClient } from '@/lib/supabaseAdmin';
import { generateApiKey, hashApiKey } from '@/lib/api-keys';
import { inferPorterFromSite } from '@/lib/porter/inference';

/**
 * Create a Porter, and the key its snippet needs, inside a project that already exists.
 *
 * Two callers reach this. Onboarding builds the organization and project first and then arrives
 * here; the console arrives here on its own, for a customer who came for the gateway and found
 * Porter in the sidebar. Both should produce the same Porter, which is the reason this is one
 * function rather than the same twenty lines written twice.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type ProvisionedPorter = {
    porterId: string;
    name: string;
    host: string;
    publishableKey: string;
    allowedDomains: string[];
};

/** Accept "acme.com", "acme.com/help", or a full URL, and reject anything that isn't web. */
export function parseSiteUrl(raw: string): { host: string } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    const host = url.hostname.toLowerCase();
    // A hostname with no dot is either localhost or a typo; neither can host a Porter.
    if (!host.includes('.') || host.endsWith('.')) return null;

    return { host };
}

/**
 * "shop.acme-bank.com" -> "Acme Bank". The registrable label is the closest thing a URL carries to
 * a company name on its own, and it is the fallback when the page itself will not say.
 */
export function nameFromHost(host: string): string {
    const withoutWww = host.replace(/^www\./, '');
    const labels = withoutWww.split('.');
    const label = labels.length > 2 ? labels[labels.length - 3] : labels[0];
    const words = label.split(/[-_]+/).filter(Boolean);
    if (words.length === 0) return withoutWww;
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/** Both spellings, because the browser sends whichever one the visitor typed. */
export function allowedDomainsForHost(host: string): string[] {
    const bare = host.replace(/^www\./, '');
    return Array.from(new Set([bare, `www.${bare}`]));
}

export async function createPorterForProject(
    supabase: AdminClient,
    input: { organizationId: string; projectId: string; host: string },
): Promise<{ porter: ProvisionedPorter } | { error: string; detail?: string }> {
    const { organizationId, projectId, host } = input;

    // Read the homepage before deciding what anything is called. Everything this returns is
    // optional: a site that will not load leaves the hostname-derived name in place.
    const inferred = await inferPorterFromSite(`https://${host}`, host);
    const name = inferred.name?.slice(0, 80) || nameFromHost(host);

    // The key ships in the page source of the customer's site, so it is domain locked at creation:
    // gateway-middleware rejects it from any other origin.
    const allowedDomains = allowedDomainsForHost(host);
    const keyPrefix = 'cpk_';
    const apiKey = generateApiKey(keyPrefix);

    const { error: keyError } = await supabase.from('api_keys').insert({
        project_id: projectId,
        name: `Porter (${host})`,
        key_hash: hashApiKey(apiKey),
        key_prefix: apiKey.substring(0, keyPrefix.length + 4) + '...',
        environment: 'production',
        key_type: 'publishable',
        allowed_domains: allowedDomains,
    });

    if (keyError) {
        console.error('[Porter] key insert failed:', keyError.message);
        return { error: 'Could not prepare your Porter.', detail: keyError.message };
    }

    // Disabled until its site has been read -- answering before the crawl would be worse than not
    // answering at all.
    const { data: porter, error: porterError } = await supabase
        .from('porters')
        .insert({
            project_id: projectId,
            organization_id: organizationId,
            name,
            source_url: `https://${host}`,
            system_prompt: inferred.systemPrompt ?? null,
            publishable_key: apiKey,
            enabled: false,
            surface: 'launcher',
            // Inferred values only. What the customer edits later lands in brand_overrides, so a
            // re-crawl can refresh this without undoing anything they chose.
            brand: inferred.brand,
            actions: inferred.contactEmail
                ? [{ type: 'email', to: inferred.contactEmail, source: 'inferred' }]
                : [],
        })
        .select('id')
        .single();

    if (porterError || !porter) {
        console.error('[Porter] porter insert failed:', porterError?.message);
        await supabase.from('api_keys').delete().eq('key_hash', hashApiKey(apiKey));
        return { error: 'Could not prepare your Porter.', detail: porterError?.message };
    }

    return {
        porter: {
            porterId: porter.id as string,
            name,
            host,
            publishableKey: apiKey,
            allowedDomains,
        },
    };
}
