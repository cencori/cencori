import { vi } from 'vitest';

type SecuritySettingsRow = {
    security_enabled?: boolean;
    safety_threshold: number;
    filter_jailbreaks: boolean;
    filter_pii: boolean;
    filter_prompt_injection: boolean;
};

/**
 * Minimal Supabase mock for input-pipeline contract tests (security_settings + custom_data_rules).
 *
 * Scanning is explicit opt-in: tests that need the scanners use tier 'pro'
 * (which defaults the switch on) or pass security_enabled explicitly; tier
 * 'free' and explicit null rows mean no scanning.
 */
export function createMockSupabaseForSecurity(options?: {
    tier?: 'free' | 'pro';
    securitySettings?: SecuritySettingsRow | null;
    customRules?: unknown[];
}) {
    const securitySettings =
        options?.securitySettings ??
        (options?.tier === 'free'
            ? null
            : {
                  security_enabled: true,
                  safety_threshold: 0.5,
                  filter_jailbreaks: true,
                  filter_pii: true,
                  filter_prompt_injection: true,
              });

    const customRules = options?.customRules ?? [];

    return {
        from: vi.fn((table: string) => {
            if (table === 'security_settings') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: async () => ({
                                data: securitySettings,
                                error: securitySettings ? null : { code: 'PGRST116' },
                            }),
                        }),
                    }),
                };
            }
            if (table === 'custom_data_rules') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                order: () => ({
                                    data: customRules,
                                    error: null,
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'security_incidents') {
                return {
                    insert: async () => ({ error: null }),
                };
            }
            return {
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null, error: null }),
                    }),
                }),
            };
        }),
    };
}
