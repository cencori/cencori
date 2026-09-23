import type { ResponsesTool } from '@/lib/gateway/v1-responses-execute';
import type { CapabilityManifest } from './manifest';
import type { NetworkPolicy } from './net-policy';

/**
 * Only published declarations become executable tools on installed turns.
 * Browser-gated builtins require both the manifest grant and an effective
 * network allowlist; function tools require an object-shaped parameters
 * schema (matching manifest validation — truthy non-objects are dropped).
 */
export function installedTurnTools(manifest: CapabilityManifest, network: NetworkPolicy, browserEnabled?: boolean): ResponsesTool[] {
    const tools: ResponsesTool[] = [];
    const seen = new Set<string>();
    const browser = browserEnabled ?? manifest.policy.browser.enabled;
    for (const declaration of manifest.tools) {
        if (declaration.type === 'builtin' && ['web_search', 'web_search_preview'].includes(declaration.name)) {
            if (!browser || network.mode !== 'allowlist' || network.allowed_hosts.length === 0) continue;
            if (!seen.has('web_search_preview')) {
                tools.push({ type: 'web_search_preview' });
                seen.add('web_search_preview');
            }
        } else if (declaration.type === 'function' && !seen.has(`function:${declaration.name}`)) {
            const parameters: unknown = declaration.parameters;
            if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) continue;
            tools.push({
                type: 'function',
                function: {
                    name: declaration.name,
                    description: typeof declaration.description === 'string' ? declaration.description : '',
                    parameters: parameters as Record<string, unknown>,
                },
            });
            seen.add(`function:${declaration.name}`);
        }
    }
    return tools;
}
