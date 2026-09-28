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
 * Settings-row state. Scanning is explicit opt-in: nothing runs unless the
 * project turned it on on the dashboard (`security_settings.security_enabled`).
 * There are no defaults — no row or an unset flag means fully disabled.
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
 * Pure row → cache-shape mapper. Shared by the DB reader below and the
 * gateway request warmer so a packed bundle seeds exactly what a DB read
 * would have cached.
 */
export function toCachedSecuritySettings(row: SecuritySettingsRow): CachedSecuritySettings {
    if (!row || row.security_enabled !== true) {
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
 * Explicit opt-in only: scanning runs iff the project enabled it on the
 * dashboard (`security_settings.security_enabled`). No row or an unset flag
 * means every scanner is off, on every tier. The cached value carries the
 * switch, so tier plays no role in the decision.
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

        // Null row (never configured) maps to fully disabled, as does any
        // warmer-seeded bundle without the explicit switch.
        const resolved = toCachedSecuritySettings(settings);
        void setCachedSecurityConfig(projectId, resolved);
        return applyExplicit(resolved);
    } catch (error) {
        console.warn('[Security] Failed to fetch security settings:', error);
        return {
            enabled: false,
            inputThreshold: 0.5,
            outputThreshold: 0.6,
            jailbreakThreshold: 0.7,
            enableOutputScanning: false,
            enableJailbreakDetection: false,
            enableObfuscatedPII: false,
            enableIntentAnalysis: false,
        };
    }
}
