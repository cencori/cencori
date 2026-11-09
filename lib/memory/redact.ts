/**
 * Pre-write redaction — the project's custom data rules run on any string
 * headed for memory storage. The redacted/tokenized value is what persists;
 * raw values never do. Blocked content is dropped entirely.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import { fetchAndProcessCustomRules } from '@/lib/gateway/custom-rules';
import { projectIncludesSecurity } from '@/lib/safety/utils';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface RedactedFact {
    content: string;
    redactions: number;
    blocked: boolean;
}

export async function redactFact(
    supabase: SupabaseAdmin,
    projectId: string,
    text: string
): Promise<RedactedFact> {
    try {
        // Custom data rules are a Pro security feature: off the plan, nothing to apply.
        if (!(await projectIncludesSecurity(supabase, projectId))) {
            return { content: text, redactions: 0, blocked: false };
        }
        const { inputResult } = await fetchAndProcessCustomRules(supabase, projectId, text);

        return {
            // Tokenized values persist as tokens by design — the tokenMap is
            // discarded, so raw values are unrecoverable from storage.
            content: inputResult.content,
            redactions: inputResult.matchedRules?.length ?? 0,
            blocked: inputResult.shouldBlock === true,
        };
    } catch (error) {
        // Fail closed. Memory is durable and may be recalled into unrelated
        // future prompts, so raw content must never persist when redaction is
        // unavailable.
        console.error('[Memory] Redaction failed; dropping fact:', error);
        return { content: '', redactions: 0, blocked: true };
    }
}
