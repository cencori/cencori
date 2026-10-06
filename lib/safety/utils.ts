/**
 * Shared Safety Utilities
 * 
 * Functions used across multiple AI gateway routes for security config.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { ProjectSecurityConfig } from '@/lib/safety/multi-layer-check';
import type { SubscriptionTier } from '@/lib/entitlements';
import {
    getCachedSecurityConfig,
    setCachedSecurityConfig,
} from '@/lib/config-cache';

/**
 * Settings-row state. Lexical scanning (jailbreak patterns, content filter,
 * regex PII) is secure-by-default: a project that never configured security
 * is protected, at ~0ms cost. An explicit `security_enabled: false` row opts
 * out and is respected. Model-backed checks (custom `ai_detect` rules) stay
 * strictly opt-in per rule — those cost seconds per request.
 */
export type CachedSecuritySettings = {
    enabled: boolean;
    inputThreshold: number;
    outputThreshold: number;
    jailbreakThreshold: number;
    filterJailbreaks: boolean;
    filterPII: boolean;
    filterPromptInjection: boolean;
};

type SecuritySettingsRow = {
    security_enabled?: boolean | null;
    safety_threshold?: number | null;
    filter_jailbreaks?: boolean | null;
    filter_pii?: boolean | null;
    filter_prompt_injection?: boolean | null;
} | null | undefined;

const DISABLED_SECURITY_SETTINGS: CachedSecuritySettings = {
    enabled: false,
    inputThreshold: 0.5,
    outputThreshold: 0.6,
    jailbreakThreshold: 0.7,
    filterJailbreaks: false,
    filterPII: false,
    filterPromptInjection: false,
};

/**
 * Secure default for never-configured projects: the lexical scanners on,
 * model-backed checks off. Same thresholds as an explicit enablement with
 * all lexical filters ticked — the dashboard shows the same state.
 */
const LEXICAL_DEFAULT_SECURITY_SETTINGS: CachedSecuritySettings = {
    enabled: true,
    inputThreshold: 0.5,
    outputThreshold: 0.6,
    jailbreakThreshold: 0.7,
    filterJailbreaks: true,
    filterPII: true,
    filterPromptInjection: true,
};

/**
 * Pure row → cache-shape mapper. Shared by the DB reader below and the
 * gateway request warmer so a packed bundle seeds exactly what a DB read
 * would have cached.
 */
export function toCachedSecuritySettings(row: SecuritySettingsRow): CachedSecuritySettings {
    // Never configured (no row): lexical secure default. Explicit opt-out
    // (security_enabled false): fully disabled, respected as-is.
    if (!row) {
        return { ...LEXICAL_DEFAULT_SECURITY_SETTINGS };
    }
    if (row.security_enabled !== true) {
        return { ...DISABLED_SECURITY_SETTINGS };
    }
    const safetyThreshold = row.safety_threshold ?? 0.7;
    const inputThreshold = safetyThreshold; // Strictly follow the UI value
    return {
        enabled: true,
        inputThreshold,
        outputThreshold: Math.max(0.1, inputThreshold - 0.1), // Slightly more lenient output check
        jailbreakThreshold: Math.max(0.2, inputThreshold),
        filterJailbreaks: row.filter_jailbreaks ?? true,
        filterPII: row.filter_pii ?? true,
        filterPromptInjection: row.filter_prompt_injection ?? true,
    };
}

/**
 * Get project security configuration from database.
 *
 * Secure by default: a project with no settings row gets the lexical
 * scanners on (jailbreak patterns, content filter, regex PII — ~0ms). An
 * explicit `security_enabled: false` row opts out and is respected.
 * Model-backed checks (custom `ai_detect` rules) are never implied by this
 * switch; they stay opt-in per rule.
 */
export async function getProjectSecurityConfig(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    _tier: SubscriptionTier = 'free'
): Promise<ProjectSecurityConfig> {
    const applyExplicit = (settings: CachedSecuritySettings): ProjectSecurityConfig => ({
        enabled: settings.enabled,
        inputThreshold: settings.inputThreshold,
        outputThreshold: settings.outputThreshold,
        jailbreakThreshold: settings.jailbreakThreshold,
        enableOutputScanning: settings.enabled,
        enableJailbreakDetection: settings.enabled && settings.filterJailbreaks,
        enableObfuscatedPII: settings.enabled && settings.filterPII,
        enableIntentAnalysis: settings.enabled && settings.filterPromptInjection,
    });

    const cached = await getCachedSecurityConfig(projectId);
    if (cached?.data) {
        return applyExplicit(cached.data as CachedSecuritySettings);
    }

    try {
        const { data: settings } = await supabase
            .from('security_settings')
            .select('*')
            .eq('project_id', projectId)
            .single();

        // Null row (never configured) maps to the lexical secure default.
        // An explicit opt-out row (security_enabled false) maps to fully
        // disabled inside toCachedSecuritySettings; warmer-seeded bundles go
        // through the same mapper.
        const resolved = toCachedSecuritySettings(settings);
        void setCachedSecurityConfig(projectId, resolved);
        return applyExplicit(resolved);
    } catch (error) {
        console.warn('[Security] Failed to fetch security settings:', error);
        // Fail closed on lexical (~0ms, low false-positive): transient DB
        // errors must not open a hole for never-configured projects.
        // Model-backed ai_detect rules stay off — those are opt-in per rule.
        return applyExplicit({ ...LEXICAL_DEFAULT_SECURITY_SETTINGS });
    }
}
