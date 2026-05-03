/**
 * Shared Safety Utilities
 * 
 * Functions used across multiple AI gateway routes for security config.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { ProjectSecurityConfig } from '@/lib/safety/multi-layer-check';
import type { SubscriptionTier } from '@/lib/entitlements';

/**
 * Get project security configuration from database.
 * Returns sensible defaults if no config is found.
 * Security features are disabled for free tier.
 */
export async function getProjectSecurityConfig(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string,
    tier: SubscriptionTier = 'free'
): Promise<ProjectSecurityConfig> {
    const securityEnabled = tier !== 'free';
    
    try {
        const { data: settings } = await supabase
            .from('security_settings')
            .select('*')
            .eq('project_id', projectId)
            .single();

        if (!settings) {
            return {
                inputThreshold: 0.5,
                outputThreshold: 0.6,
                jailbreakThreshold: 0.7,
                enableOutputScanning: securityEnabled,
                enableJailbreakDetection: securityEnabled,
                enableObfuscatedPII: securityEnabled,
                enableIntentAnalysis: securityEnabled,
            };
        }

        const safetyThreshold = settings.safety_threshold ?? 0.7;
        const inputThreshold = safetyThreshold; // Strictly follow the UI value
        const outputThreshold = Math.max(0.1, inputThreshold - 0.1); // Slightly more lenient output check
        const jailbreakThreshold = Math.max(0.2, inputThreshold);

        return {
            inputThreshold,
            outputThreshold,
            jailbreakThreshold,
            enableOutputScanning: securityEnabled,
            enableJailbreakDetection: securityEnabled && (settings.filter_jailbreaks ?? true),
            enableObfuscatedPII: securityEnabled && (settings.filter_pii ?? true),
            enableIntentAnalysis: securityEnabled && (settings.filter_prompt_injection ?? true),
        };
    } catch (error) {
        console.warn('[Security] Failed to fetch security settings:', error);
        return {
            inputThreshold: 0.5,
            outputThreshold: 0.6,
            jailbreakThreshold: 0.7,
            enableOutputScanning: securityEnabled,
            enableJailbreakDetection: securityEnabled,
            enableObfuscatedPII: securityEnabled,
            enableIntentAnalysis: securityEnabled,
        };
    }
}
