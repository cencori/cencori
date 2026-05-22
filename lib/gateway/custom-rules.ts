import type { createAdminClient } from '@/lib/supabaseAdmin';
import {
    processCustomRules,
    type CustomDataRule,
    type ProcessedContent,
} from '@/lib/safety/custom-data-rules';
import type { UnifiedMessage } from '@/lib/providers/base';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export type CustomRulesPipelineResult = {
    rules: CustomDataRule[];
    inputResult: ProcessedContent;
};

export async function fetchAndProcessCustomRules(
    supabase: SupabaseAdmin,
    projectId: string,
    inputText: string
): Promise<CustomRulesPipelineResult> {
    try {
        const { data: rules, error } = await supabase
            .from('custom_data_rules')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('priority', { ascending: false });

        if (error || !rules || rules.length === 0) {
            return {
                rules: [],
                inputResult: {
                    content: inputText,
                    wasProcessed: false,
                    matchedRules: [],
                    shouldBlock: false,
                },
            };
        }

        const inputResult = await processCustomRules(inputText, rules as CustomDataRule[]);
        return { rules: rules as CustomDataRule[], inputResult };
    } catch (error) {
        console.warn('[CustomRules] Failed to process:', error);
        return {
            rules: [],
            inputResult: {
                content: inputText,
                wasProcessed: false,
                matchedRules: [],
                shouldBlock: false,
            },
        };
    }
}

/** Apply mask/redact/tokenize rules to all user messages in the conversation. */
export async function applyCustomRulesToUserMessages(
    messages: UnifiedMessage[],
    rules: CustomDataRule[],
    initialTokenMap?: Map<string, string>
): Promise<{ messages: UnifiedMessage[]; tokenMap?: Map<string, string> }> {
    if (rules.length === 0) {
        return { messages, tokenMap: initialTokenMap };
    }

    let tokenMap = initialTokenMap;
    const updated = [...messages];

    for (let i = 0; i < updated.length; i++) {
        if (updated[i].role !== 'user') continue;
        const msgResult = await processCustomRules(updated[i].content, rules);
        updated[i] = { ...updated[i], content: msgResult.content };
        if (msgResult.tokenMap) {
            if (!tokenMap) tokenMap = new Map();
            for (const [key, value] of msgResult.tokenMap.entries()) {
                tokenMap.set(key, value);
            }
        }
    }

    return { messages: updated, tokenMap };
}
