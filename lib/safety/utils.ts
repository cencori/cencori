/**
 * Shared Safety Utilities
 * 
 * Functions used across multiple AI gateway routes for security config.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { ProjectSecurityConfig } from '@/lib/safety/multi-layer-check';

/**
 * Get project security configuration from database.
 * Returns sensible defaults if no config is found.
 */
export async function getProjectSecurityConfig(
    supabase: ReturnType<typeof createAdminClient>,
    projectId: string
): Promise<ProjectSecurityConfig> {
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
                enableOutputScanning: true,
                enableJailbreakDetection: true,
                enableObfuscatedPII: true,
                enableIntentAnalysis: true,
            };
        }

        const safetyThreshold = settings.safety_threshold ?? 0.7;
        const inputThreshold = 1 - safetyThreshold;
        const outputThreshold = Math.max(0.1, inputThreshold - 0.1);
        const jailbreakThreshold = Math.max(0.2, inputThreshold);

        return {
            inputThreshold,
            outputThreshold,
            jailbreakThreshold,
            enableOutputScanning: true,
            enableJailbreakDetection: settings.filter_jailbreaks ?? true,
            enableObfuscatedPII: settings.filter_pii ?? true,
            enableIntentAnalysis: settings.filter_prompt_injection ?? true,
        };
    } catch (error) {
        console.warn('[Security] Failed to fetch security settings:', error);
        return {
            inputThreshold: 0.5,
            outputThreshold: 0.6,
            jailbreakThreshold: 0.7,
            enableOutputScanning: true,
            enableJailbreakDetection: true,
            enableObfuscatedPII: true,
            enableIntentAnalysis: true,
        };
    }
}
