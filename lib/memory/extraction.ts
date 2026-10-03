/**
 * Fact extraction — the "what should we remember from this exchange?" LLM
 * call. Runs post-response (async), uses the project's configured extraction
 * model via the internal chat executor (no second pass through gateway auth).
 *
 * Never throws: any failure returns zero facts.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import { callMemoryLlm } from './llm';
import type { SubscriptionTier } from '@/lib/entitlements';
import {
    MEMORY_CONTENT_MAX_CHARS,
    resolveMemoryModel,
    type ExtractedFact,
    type MemoryExtractOverride,
    type MemorySettings,
} from './types';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export const DEFAULT_EXTRACTION_PROMPT = `You extract durable facts about the user from a conversation exchange, for long-term memory.

Rules:
- Only extract facts worth remembering across future conversations: preferences, context about their work or projects, constraints, decisions, corrections.
- Capture dated events and changes WITH their when: job switches, moves, purchases, issues, deadlines ("switched to Rust last month", "moved to Berlin in March"). The date is part of the fact — a change without its when is half a memory.
- Skip small talk, one-off requests, and anything relevant only to this exchange.
- Never include secrets, passwords, API keys, or verbatim sensitive data (emails, phone numbers, government IDs) — describe the fact without the sensitive value if needed.
- If an exchange mixes secrets with benign facts, still extract the benign facts and drop only the secret itself — a password in the turn must not erase everything else said alongside it.
- Each fact must be a single, self-contained sentence.

Respond with ONLY a JSON array (no prose, no code fences):
[{"fact": "...", "importance": 0.0-1.0}]

importance: 0.9+ = core durable fact (name, role, main project), 0.7 = strong preference or decision, 0.5 = useful context, below 0.5 = trivia.

If nothing is worth remembering, respond with [].`;

export interface ExtractFactsResult {
    facts: ExtractedFact[];
    costUsd: number;
    model: string;
    /** Which provider actually answered ('' when the whole chain failed). */
    provider: string;
    /** LLM attempts used — 2 when the first attempt produced no parseable output and we retried. */
    attempts: number;
}

/**
 * True only for an explicit `[]` verdict — "nothing worth remembering".
 * Empty output, prose without an array, and malformed JSON are failure
 * signals (usually a reasoning model spending its token budget before
 * emitting) and may be retried; an explicit `[]` must never be.
 */
export function isExplicitEmptyVerdict(raw: string): boolean {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    }
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return false;
    try {
        const parsed: unknown = JSON.parse(arrayMatch[0]);
        return Array.isArray(parsed) && parsed.length === 0;
    } catch {
        return false;
    }
}

export async function extractFacts(params: {
    supabase: SupabaseAdmin;
    projectId: string;
    organizationId: string;
    tier: SubscriptionTier;
    settings: MemorySettings;
    extractOverride: MemoryExtractOverride | null;
    userText: string;
    assistantText: string;
    requestId?: string;
}): Promise<ExtractFactsResult> {
    const {
        supabase, projectId, organizationId, tier,
        settings, extractOverride, userText, assistantText, requestId,
    } = params;

    // Managed GPT-OSS preference pins the first provider in the fan-out;
    // callMemoryLlm falls across the provider-diverse defaults if it fails.
    const preferModel = resolveMemoryModel(extractOverride?.model || settings.extractionModel);
    const minImportance = extractOverride?.minImportance ?? settings.minImportance;
    const systemPrompt =
        extractOverride?.prompt || settings.extractionPrompt || DEFAULT_EXTRACTION_PROMPT;

    try {
        // Fan out across the managed production chain; first provider to answer wins.
        // NOTE: do NOT size maxTokens tight. The managed extraction models are
        // reasoning models: hidden reasoning tokens count against this budget,
        // and a too-small cap returns an EMPTY completion (proven: 350 → empty
        // 2/2 on the same prompt that works at 500/800).
        const exchangeMessages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content:
                    `Exchange to analyze:\n\n` +
                    `USER:\n${userText.slice(0, 8000)}\n\n` +
                    `ASSISTANT:\n${assistantText.slice(0, 8000)}`,
            },
        ] as { role: 'system' | 'user' | 'assistant'; content: string }[];
        let response = await callMemoryLlm({
            supabase,
            projectId,
            organizationId,
            tier,
            requestId,
            preferModel,
            maxTokens: 500,
            messages: exchangeMessages,
        });
        let attempts = 1;
        let costUsd = response?.costUsd ?? 0;
        const firstFacts = response ? parseExtractionOutput(response.content) : [];
        if (firstFacts.length === 0 && (!response || !isExplicitEmptyVerdict(response.content))) {
            // One retry: an empty/unparseable completion (or a dead chain) is
            // usually a spent reasoning budget, not a verdict. An explicit `[]`
            // never reaches here — it is accepted as-is below.
            const retry = await callMemoryLlm({
                supabase,
                projectId,
                organizationId,
                tier,
                requestId,
                preferModel,
                maxTokens: 500,
                messages: exchangeMessages,
            });
            attempts = 2;
            if (retry) {
                costUsd += retry.costUsd;
                response = retry;
            }
        }
        if (!response) {
            // Whole chain exhausted twice — fail open with zero facts.
            return { facts: [], costUsd, model: preferModel, provider: '', attempts };
        }

        const facts = parseExtractionOutput(response.content);
        const filtered = facts
            .filter(f => f.importance >= minImportance)
            .slice(0, settings.maxMemoriesPerExchange)
            .map(f => ({
                content: f.content.slice(0, MEMORY_CONTENT_MAX_CHARS),
                importance: f.importance,
            }));

        return {
            facts: filtered,
            costUsd,
            model: response.model,
            provider: response.provider,
            attempts,
        };
    } catch (error) {
        console.warn('[Memory] Fact extraction failed:', error);
        return { facts: [], costUsd: 0, model: preferModel, provider: '', attempts: 1 };
    }
}

/** Defensive parse of the extraction model's output. Exported for tests. */
export function parseExtractionOutput(raw: string): ExtractedFact[] {
    if (!raw) return [];

    // Strip code fences the model may add despite instructions.
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    }

    // Grab the first JSON array if the model added prose around it.
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        text = arrayMatch[0];
    }

    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map(item => {
                if (!item || typeof item !== 'object') return null;
                const content =
                    typeof item.fact === 'string' ? item.fact.trim()
                    : typeof item.content === 'string' ? item.content.trim()
                    : '';
                if (!content) return null;

                const importanceRaw = typeof item.importance === 'number' ? item.importance : 0.5;
                const importance = Math.min(1, Math.max(0, importanceRaw));

                return { content, importance } satisfies ExtractedFact;
            })
            .filter((f): f is ExtractedFact => f !== null);
    } catch {
        return [];
    }
}
