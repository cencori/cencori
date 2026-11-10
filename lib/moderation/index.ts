/**
 * Cencori moderation pipeline.
 *
 * Layers, cheapest first:
 *   1. rules  — local pattern rules for fraud and local-language abuse, plus the
 *               caller's block list (free).
 *   2. openai — OpenAI omni-moderation for the standard categories, text and
 *               images (free from OpenAI).
 *   3. llm    — a cheap model, only for items the rules could not settle and
 *               for the caller's own categories. Batched and cached; billed.
 *
 * The response keeps OpenAI's shape (flagged / categories / category_scores)
 * so it is a drop-in replacement, and adds a recommended action and the
 * evidence behind each flag.
 */

import OpenAI from 'openai';
import {
    ALL_CATEGORIES,
    CENCORI_CATEGORIES,
    DEFAULT_BLOCK_THRESHOLD,
    DEFAULT_FLAG_THRESHOLD,
    OPENAI_CATEGORIES,
} from './categories';
import { normalize, runRules, RULES_VERSION, type RuleMatch, type RulesResult } from './rules';
import { classifyWithLlm, DEFAULT_LLM_MODEL, MAX_PREVIOUS, type LlmCall, type LlmCategory } from './llm';

export type ModerationLayer = 'rules' | 'openai' | 'llm';
export type ModerationAction = 'allow' | 'review' | 'block';
export type EscalationMode = 'auto' | 'always' | 'never';

export type MultiModalPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

/** Same shapes OpenAI accepts. A multimodal array is one item with one result. */
export type ModerationInput = string | string[] | MultiModalPart[];

export interface CustomCategory {
    /** Lowercase id; returned as "custom/<name>". */
    name: string;
    /** Plain-language description the model scores against. */
    description: string;
    /** Flag threshold for this category. */
    threshold?: number;
}

export interface ModerationOptions {
    model?: string;
    layers?: ModerationLayer[];
    /** Per-category flag thresholds; "*" sets the default for all. */
    thresholds?: Record<string, number>;
    block_threshold?: number;
    /** When the llm layer runs: auto (unclear items and custom categories), always, or never. */
    escalate?: EscalationMode;
    llm_model?: string;
    custom_categories?: CustomCategory[];
    /** Terms that always flag (category "custom/blocklist", score 1). */
    blocklist?: string[];
    /** Terms removed before the rules run, e.g. your own product names that look like scam words. */
    allowlist?: string[];
    /** Your brand and product names, to catch people posing as your staff. */
    brand_names?: string[];
    /** One or two sentences about your platform, given to the model layer. */
    context?: string;
    /**
     * Earlier messages from the same conversation, oldest first, so the model
     * can read tone (banter vs. a real ask). One array per input string, or a
     * single array when the input is one string.
     */
    previous_messages?: (string[] | null)[] | string[];
    /**
     * The strongest action each category may lead to. Defaults:
     * DEFAULT_CATEGORY_ACTIONS. Set "block" to let a review-only category block.
     */
    category_actions?: Record<string, 'review' | 'block'>;
}

export interface ModerationMatch {
    layer: ModerationLayer;
    category: string;
    score: number;
    rule?: string;
    text?: string;
    reason?: string;
}

export interface ModerationResult {
    flagged: boolean;
    action: ModerationAction;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
    category_applied_input_types?: Record<string, string[]>;
    flagged_categories: string[];
    matches: ModerationMatch[];
    /** Which layers decided this item. */
    layers_applied: ModerationLayer[];
}

export interface ModerationUsage {
    llm_items: number;
    llm_cached_items: number;
    llm_calls: number;
    llm_model: string | null;
    cost_usd: number;
}

export interface ModerationResponse {
    id: string;
    model: string;
    results: ModerationResult[];
    layers: Partial<Record<ModerationLayer, 'ok' | 'skipped' | 'error'>>;
    rules_version?: string;
    usage: ModerationUsage;
    errors?: string[];
}

export const DEFAULT_MODEL = 'omni-moderation-latest';
export const MAX_ITEMS = 100;
export const MAX_TOTAL_CHARS = 400_000;
export const MAX_CUSTOM_CATEGORIES = 20;
export const MAX_LIST_TERMS = 500;
/**
 * Risk signals rather than harm: never counted in the "fraud" roll-up.
 * Sharing a WhatsApp number is normal between friends; it only matters next
 * to a scam signal, which the rules already reward.
 */
export const SIGNAL_ONLY_CATEGORIES = new Set(['fraud/off_platform_contact']);

/**
 * Categories where banter is common, so a single message is never enough to
 * block: mock begging and cruise ("baby send me 2k"), trash talk ("una be
 * mumu"), sarcasm in custom categories like politics. They go to review
 * unless the caller raises them with category_actions. Categories not listed
 * may block.
 */
export const DEFAULT_CATEGORY_ACTIONS: Record<string, 'review' | 'block'> = {
    'fraud/off_platform_contact': 'review',
    'fraud/romance': 'review',
    harassment: 'review',
    hate: 'review',
};
/** Custom categories are review-only by default too. */
const CUSTOM_DEFAULT_ACTION: 'review' | 'block' = 'review';
/** Rule scores in [ESCALATE_FROM, block threshold) are "unclear" and go to the llm layer. */
export const ESCALATE_FROM = 0.2;

export class ModerationInputError extends Error {}

interface NormalizedItem {
    text: string;
    hasImages: boolean;
}

/** Validates the input and splits it into items, one per result. */
export function normalizeInput(input: unknown): NormalizedItem[] {
    if (typeof input === 'string') {
        if (!input.trim()) throw new ModerationInputError('input must not be empty');
        return [{ text: input, hasImages: false }];
    }
    if (!Array.isArray(input) || input.length === 0) {
        throw new ModerationInputError('input must be a string, an array of strings, or an array of text/image_url parts');
    }
    if (input.every((x) => typeof x === 'string')) {
        if (input.length > MAX_ITEMS) throw new ModerationInputError(`input may contain at most ${MAX_ITEMS} strings`);
        return (input as string[]).map((text) => ({ text, hasImages: false }));
    }
    const texts: string[] = [];
    let hasImages = false;
    for (const part of input as unknown[]) {
        const p = part as Partial<MultiModalPart> | null;
        if (p?.type === 'text' && typeof (p as { text?: unknown }).text === 'string') {
            texts.push((p as { text: string }).text);
        } else if (p?.type === 'image_url' && typeof (p as { image_url?: { url?: unknown } }).image_url?.url === 'string') {
            const url = (p as { image_url: { url: string } }).image_url.url;
            if (!/^https:\/\//i.test(url) && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) {
                throw new ModerationInputError('image_url.url must be an https URL or a base64 data:image URL');
            }
            hasImages = true;
        } else {
            throw new ModerationInputError('each part must be {type:"text",text} or {type:"image_url",image_url:{url}}; do not mix plain strings with parts');
        }
    }
    return [{ text: texts.join('\n'), hasImages }];
}

function validateOptions(options: ModerationOptions): { custom: CustomCategory[] } {
    const custom = options.custom_categories ?? [];
    if (!Array.isArray(custom) || custom.length > MAX_CUSTOM_CATEGORIES) {
        throw new ModerationInputError(`custom_categories must be an array of at most ${MAX_CUSTOM_CATEGORIES}`);
    }
    const seen = new Set<string>();
    for (const c of custom) {
        if (!c || typeof c.name !== 'string' || !/^[a-z0-9_]{1,40}$/.test(c.name)) {
            throw new ModerationInputError('custom_categories[].name must be 1-40 chars of a-z, 0-9 and _');
        }
        if (seen.has(c.name)) throw new ModerationInputError(`duplicate custom category "${c.name}"`);
        seen.add(c.name);
        if (typeof c.description !== 'string' || c.description.trim().length < 5 || c.description.length > 500) {
            throw new ModerationInputError(`custom_categories["${c.name}"].description must be 5-500 characters`);
        }
    }
    for (const key of ['blocklist', 'allowlist', 'brand_names'] as const) {
        const list = options[key];
        if (list === undefined) continue;
        if (!Array.isArray(list) || list.length > MAX_LIST_TERMS || list.some((t) => typeof t !== 'string' || t.length > 200)) {
            throw new ModerationInputError(`${key} must be an array of at most ${MAX_LIST_TERMS} strings (200 chars each)`);
        }
    }
    if (options.context !== undefined && (typeof options.context !== 'string' || options.context.length > 1000)) {
        throw new ModerationInputError('context must be a string of at most 1000 characters');
    }
    if (options.category_actions !== undefined) {
        const ca = options.category_actions;
        if (!ca || typeof ca !== 'object' || Array.isArray(ca) || Object.values(ca).some((v) => v !== 'review' && v !== 'block')) {
            throw new ModerationInputError('category_actions must map categories to "review" or "block"');
        }
    }
    if (custom.length && options.layers && !options.layers.includes('llm')) {
        throw new ModerationInputError('custom_categories need the "llm" layer');
    }
    return { custom };
}

function normalizePrevious(value: ModerationOptions['previous_messages'], count: number): (string[] | undefined)[] {
    if (value === undefined || value === null) return Array(count).fill(undefined);
    if (!Array.isArray(value)) throw new ModerationInputError('previous_messages must be an array');
    const isString = (x: unknown) => typeof x === 'string';
    // One input string: a flat array of strings is its conversation.
    const perItem: unknown[] = count === 1 && value.every(isString) ? [value] : value;
    if (perItem.length !== count) {
        throw new ModerationInputError('previous_messages must have one entry (an array of strings, or null) per input string');
    }
    return perItem.map((entry) => {
        if (entry === null || entry === undefined) return undefined;
        if (!Array.isArray(entry) || !entry.every(isString)) {
            throw new ModerationInputError('each previous_messages entry must be an array of strings or null');
        }
        return entry.length ? (entry as string[]).slice(-MAX_PREVIOUS) : undefined;
    });
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termsRegex(terms: string[] | undefined): RegExp | null {
    const clean = (terms ?? []).map((t) => normalize(t).trim()).filter(Boolean);
    if (!clean.length) return null;
    // Longest first so overlapping terms remove the whole phrase.
    clean.sort((a, b) => b.length - a.length);
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${clean.map((t) => escapeRegex(t).replace(/\s+/g, '\\s+')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
}

function clamp01(n: unknown, fallback: number): number {
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function round(n: number): number {
    return Math.round(n * 10000) / 10000;
}

const OPENAI_SET = new Set<string>(OPENAI_CATEGORIES);
/** Categories the model layer judges by default: ours, plus the abuse categories OpenAI misses in local languages. */
const LLM_BASE_CATEGORIES: LlmCategory[] = [
    ...Object.entries(CENCORI_CATEGORIES)
        .filter(([id]) => id !== 'fraud')
        .map(([id, description]) => ({ id, description })),
    { id: 'harassment', description: 'Insults, bullying or abuse aimed at a person, including in Pidgin, Yoruba, Igbo or Hausa.' },
    { id: 'harassment/threatening', description: 'Threats of harm against a person.' },
    { id: 'hate', description: 'Hate against a group based on ethnicity, religion, gender or similar.' },
    { id: 'sexual', description: 'Sexual content or sexual solicitation.' },
];

export interface ModerateDeps {
    /** Returns an OpenAI client, or null when no key is configured. */
    getOpenAI: () => Promise<OpenAI | null>;
    /** Runs one model call for the llm layer. Absent → the layer is unavailable. */
    llm?: LlmCall;
}

export async function moderate(input: unknown, options: ModerationOptions, deps: ModerateDeps): Promise<ModerationResponse> {
    const items = normalizeInput(input);
    if (items.reduce((n, i) => n + i.text.length, 0) > MAX_TOTAL_CHARS) {
        throw new ModerationInputError(`input is too long (max ${MAX_TOTAL_CHARS} characters in total)`);
    }
    const { custom } = validateOptions(options);
    const previous = normalizePrevious(options.previous_messages, items.length);

    const layers = new Set<ModerationLayer>(options.layers?.length ? options.layers : ['rules', 'openai', 'llm']);
    const escalate: EscalationMode = options.escalate ?? 'auto';
    const model = options.model || DEFAULT_MODEL;
    if (!layers.has('openai') && items.some((i) => i.hasImages)) {
        throw new ModerationInputError('image inputs need the "openai" layer');
    }

    const layerStatus: ModerationResponse['layers'] = {};
    const errors: string[] = [];
    const blockAt = clamp01(options.block_threshold, DEFAULT_BLOCK_THRESHOLD);
    const defaultFlag = clamp01(options.thresholds?.['*'], DEFAULT_FLAG_THRESHOLD);
    const customThresholds = new Map(custom.map((c) => [`custom/${c.name}`, c.threshold]));
    const thresholdFor = (c: string) => clamp01(options.thresholds?.[c] ?? customThresholds.get(c), defaultFlag);
    const hasExplicitThreshold = (c: string) =>
        options.thresholds?.[c] !== undefined || options.thresholds?.['*'] !== undefined;

    // ── Layer 2 (remote) starts first ──────────────────────────────────────
    let openaiPromise: Promise<OpenAI.Moderations.ModerationCreateResponse | null> = Promise.resolve(null);
    if (layers.has('openai')) {
        openaiPromise = (async () => {
            const client = await deps.getOpenAI();
            if (!client) throw new Error('No OpenAI key configured for moderation');
            return client.moderations.create({ model, input: input as OpenAI.Moderations.ModerationCreateParams['input'] });
        })();
        // Avoid an unhandled rejection while layer 1 runs.
        openaiPromise.catch(() => undefined);
    } else {
        layerStatus.openai = 'skipped';
    }

    // ── Layer 1: rules + block list ────────────────────────────────────────
    const allow = termsRegex(options.allowlist);
    const block = termsRegex(options.blocklist);
    let ruleResults: RulesResult[] | null = null;
    if (layers.has('rules')) {
        ruleResults = items.map((item) => {
            const text = allow ? normalize(item.text).replace(allow, ' ') : item.text;
            const res = runRules(text, { brandNames: options.brand_names });
            if (block) {
                const m = normalize(item.text).match(block);
                if (m) {
                    (res.scores as Record<string, number>)['custom/blocklist'] = 1;
                    (res.matches as { rule: string; category: string; weight: number; text: string }[]).push({
                        rule: 'blocklist',
                        category: 'custom/blocklist',
                        weight: 1,
                        text: m[0],
                    });
                }
            }
            return res;
        });
        layerStatus.rules = 'ok';
    } else {
        layerStatus.rules = 'skipped';
    }

    let openai: OpenAI.Moderations.ModerationCreateResponse | null = null;
    if (layers.has('openai')) {
        try {
            openai = await openaiPromise;
            layerStatus.openai = 'ok';
        } catch (error) {
            layerStatus.openai = 'error';
            errors.push(`openai: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // ── Layer 3: model, only where needed ──────────────────────────────────
    const usage: ModerationUsage = { llm_items: 0, llm_cached_items: 0, llm_calls: 0, llm_model: null, cost_usd: 0 };
    const llmCategories: LlmCategory[] = [
        ...LLM_BASE_CATEGORIES,
        ...custom.map((c) => ({ id: `custom/${c.name}`, description: c.description.trim() })),
    ];
    let llmResults: Map<number, { scores: Record<string, number>; reason?: string; cached: boolean }> | null = null;

    if (layers.has('llm') && escalate !== 'never') {
        const toEscalate = items
            .map((item, index) => ({ index, text: item.text, previous: previous[index] }))
            .filter(({ index, text }) => {
                if (!text.trim()) return false;
                // Without rules there is nothing to triage on, so the model sees everything.
                if (escalate === 'always' || custom.length || !ruleResults) return true;
                const scores = Object.entries(ruleResults?.[index]?.scores ?? {}).filter(([c]) => c !== 'custom/blocklist');
                const top = Math.max(0, ...scores.map(([, s]) => s ?? 0));
                // Unclear: some signal, but not enough to block on rules alone.
                return top >= ESCALATE_FROM && top < blockAt;
            });

        if (toEscalate.length && !deps.llm) {
            layerStatus.llm = 'error';
            errors.push('llm: not configured');
        } else if (toEscalate.length) {
            const run = await classifyWithLlm({
                items: toEscalate,
                categories: llmCategories,
                context: options.context,
                model: options.llm_model || DEFAULT_LLM_MODEL,
                call: deps.llm!,
            });
            llmResults = run.results;
            usage.llm_items = toEscalate.length;
            usage.llm_cached_items = run.cachedItems;
            usage.llm_calls = run.calls;
            usage.llm_model = run.model ?? (options.llm_model || DEFAULT_LLM_MODEL);
            usage.cost_usd = Number(run.costUsd.toFixed(8));
            errors.push(...run.errors);
            layerStatus.llm = run.results.size ? 'ok' : 'error';
        } else {
            layerStatus.llm = 'skipped';
        }
    } else {
        layerStatus.llm = 'skipped';
    }

    if (!ruleResults && !openai && !llmResults?.size) {
        throw new Error(errors[0] ?? 'No moderation layer produced a result');
    }

    const maxActionFor = (c: string): 'review' | 'block' =>
        options.category_actions?.[c] ??
        DEFAULT_CATEGORY_ACTIONS[c] ??
        (c.startsWith('custom/') && c !== 'custom/blocklist' ? CUSTOM_DEFAULT_ACTION : 'block');

    const categoryIds = [...ALL_CATEGORIES, ...custom.map((c) => `custom/${c.name}`), ...(block ? ['custom/blocklist'] : [])];
    const llmJudged = new Set(llmCategories.map((c) => c.id));

    const results: ModerationResult[] = items.map((_, idx) => {
        const scores: Record<string, number> = Object.fromEntries(categoryIds.map((c) => [c, 0]));
        const flags: Record<string, boolean> = Object.fromEntries(categoryIds.map((c) => [c, false]));
        const matches: ModerationMatch[] = [];
        const applied: ModerationLayer[] = [];

        // OpenAI
        const o = openai?.results[idx];
        if (o) {
            applied.push('openai');
            for (const [category, score] of Object.entries(o.category_scores ?? {})) {
                if (!OPENAI_SET.has(category)) continue;
                scores[category] = Math.max(scores[category], score);
                // OpenAI's own flag uses its tuned thresholds; honour it unless
                // the caller set an explicit threshold for this category.
                const openaiFlag = (o.categories as unknown as Record<string, boolean>)[category] === true;
                if (openaiFlag && !hasExplicitThreshold(category)) flags[category] = true;
                if (openaiFlag || score >= thresholdFor(category)) {
                    matches.push({ layer: 'openai', category, score: round(score) });
                }
            }
        }

        // Rules, overridden by the model where the model judged the item:
        // escalated items are the unclear ones, and the model reads context.
        const rr = ruleResults?.[idx];
        const lr = llmResults?.get(idx);
        if (rr) {
            applied.push('rules');
            for (const [category, score] of Object.entries(rr.scores) as [string, number][]) {
                if (lr && llmJudged.has(category)) continue;
                scores[category] = Math.max(scores[category] ?? 0, score);
            }
            const seen = new Set<string>();
            for (const m of rr.matches as RuleMatch[]) {
                const key = `${m.rule}:${m.category}`;
                if (seen.has(key)) continue;
                seen.add(key);
                matches.push({ layer: 'rules', category: m.category, score: m.weight, rule: m.rule, text: m.text });
            }
        }
        if (lr) {
            applied.push('llm');
            for (const category of llmJudged) {
                const score = lr.scores[category] ?? 0;
                scores[category] = OPENAI_SET.has(category) ? Math.max(scores[category], score) : score;
                if (score >= 0.1) matches.push({ layer: 'llm', category, score: round(score), reason: lr.reason });
            }
        }

        let fraud = 0;
        for (const c of categoryIds) {
            if (c.startsWith('fraud/') && !SIGNAL_ONLY_CATEGORIES.has(c)) fraud = Math.max(fraud, scores[c]);
        }
        scores.fraud = fraud;

        for (const c of categoryIds) {
            if (scores[c] >= thresholdFor(c)) flags[c] = true;
            scores[c] = round(scores[c]);
        }
        if (categoryIds.some((c) => c.startsWith('fraud/') && !SIGNAL_ONLY_CATEGORIES.has(c) && flags[c])) flags.fraud = true;

        const flagged = categoryIds.filter((c) => flags[c]);
        // "fraud" is a roll-up; its parts decide the action.
        const canBlock = flagged.some(
            (c) => c !== 'fraud' && scores[c] >= blockAt && maxActionFor(c) === 'block',
        );
        const action: ModerationAction =
            flagged.length === 0 ? 'allow' : canBlock || flags['sexual/minors'] || flags['custom/blocklist'] ? 'block' : 'review';

        return {
            flagged: flagged.length > 0,
            action,
            categories: flags,
            category_scores: scores,
            ...(o?.category_applied_input_types
                ? { category_applied_input_types: o.category_applied_input_types as unknown as Record<string, string[]> }
                : {}),
            flagged_categories: flagged,
            matches,
            layers_applied: applied,
        };
    });

    return {
        id: openai?.id ?? `modr-cencori-${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        model: openai?.model ?? (layers.has('openai') ? model : RULES_VERSION),
        results,
        layers: layerStatus,
        ...(ruleResults ? { rules_version: RULES_VERSION } : {}),
        usage,
        ...(errors.length ? { errors } : {}),
    };
}
