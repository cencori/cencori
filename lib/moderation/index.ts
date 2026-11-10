/**
 * Cencori moderation pipeline.
 *
 * Layers, cheapest first:
 *   1. rules  — local pattern rules for fraud and local-language abuse (free).
 *   2. openai — OpenAI omni-moderation for the standard categories, text and
 *               images (free from OpenAI).
 * Category scores are the max across layers. The response keeps OpenAI's shape
 * (flagged / categories / category_scores) so it is a drop-in replacement, and
 * adds a recommended action and the evidence behind each flag.
 */

import OpenAI from 'openai';
import {
    ALL_CATEGORIES,
    DEFAULT_BLOCK_THRESHOLD,
    DEFAULT_FLAG_THRESHOLD,
    OPENAI_CATEGORIES,
    type ModerationCategory,
} from './categories';
import { runRules, RULES_VERSION, type RuleMatch } from './rules';

export type ModerationLayer = 'rules' | 'openai';
export type ModerationAction = 'allow' | 'review' | 'block';

export type MultiModalPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

/** Same shapes OpenAI accepts. A multimodal array is one item with one result. */
export type ModerationInput = string | string[] | MultiModalPart[];

export interface ModerationOptions {
    model?: string;
    layers?: ModerationLayer[];
    /** Per-category flag thresholds; "*" sets the default for all. */
    thresholds?: Partial<Record<ModerationCategory | '*', number>>;
    block_threshold?: number;
}

export interface ModerationMatch {
    layer: ModerationLayer;
    category: ModerationCategory;
    score: number;
    rule?: string;
    text?: string;
}

export interface ModerationResult {
    flagged: boolean;
    action: ModerationAction;
    categories: Record<ModerationCategory, boolean>;
    category_scores: Record<ModerationCategory, number>;
    category_applied_input_types?: Record<string, string[]>;
    flagged_categories: ModerationCategory[];
    matches: ModerationMatch[];
}

export interface ModerationResponse {
    id: string;
    model: string;
    results: ModerationResult[];
    layers: Partial<Record<ModerationLayer, 'ok' | 'skipped' | 'error'>>;
    rules_version?: string;
    errors?: string[];
}

export const DEFAULT_MODEL = 'omni-moderation-latest';
export const MAX_ITEMS = 100;
export const MAX_TOTAL_CHARS = 400_000;

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

function totalChars(items: NormalizedItem[]): number {
    return items.reduce((n, i) => n + i.text.length, 0);
}

function emptyRecord<T>(value: T): Record<ModerationCategory, T> {
    return Object.fromEntries(ALL_CATEGORIES.map((c) => [c, value])) as Record<ModerationCategory, T>;
}

function clamp01(n: unknown, fallback: number): number {
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

export interface ModerateDeps {
    /** Returns an OpenAI client, or null when no key is configured. */
    getOpenAI: () => Promise<OpenAI | null>;
}

export async function moderate(
    input: unknown,
    options: ModerationOptions,
    deps: ModerateDeps,
): Promise<ModerationResponse> {
    const items = normalizeInput(input);
    if (totalChars(items) > MAX_TOTAL_CHARS) {
        throw new ModerationInputError(`input is too long (max ${MAX_TOTAL_CHARS} characters in total)`);
    }

    const layers = new Set<ModerationLayer>(options.layers?.length ? options.layers : ['rules', 'openai']);
    const model = options.model || DEFAULT_MODEL;
    if (!layers.has('openai') && items.some((i) => i.hasImages)) {
        throw new ModerationInputError('image inputs need the "openai" layer');
    }

    const layerStatus: ModerationResponse['layers'] = {};
    const errors: string[] = [];

    // Layer 2 runs remotely, start it first.
    let openaiPromise: Promise<OpenAI.Moderations.ModerationCreateResponse | null> = Promise.resolve(null);
    if (layers.has('openai')) {
        openaiPromise = (async () => {
            const client = await deps.getOpenAI();
            if (!client) throw new Error('No OpenAI key configured for moderation');
            return client.moderations.create({ model, input: input as OpenAI.Moderations.ModerationCreateParams['input'] });
        })();
    } else {
        layerStatus.openai = 'skipped';
    }

    // Layer 1: local rules.
    const ruleResults = layers.has('rules') ? items.map((i) => runRules(i.text)) : null;
    layerStatus.rules = ruleResults ? 'ok' : 'skipped';

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

    if (!ruleResults && !openai) {
        throw new Error(errors[0] ?? 'No moderation layer produced a result');
    }

    const blockAt = clamp01(options.block_threshold, DEFAULT_BLOCK_THRESHOLD);
    const defaultFlag = clamp01(options.thresholds?.['*'], DEFAULT_FLAG_THRESHOLD);
    const thresholdFor = (c: ModerationCategory) => clamp01(options.thresholds?.[c], defaultFlag);
    const openaiSet = new Set<string>(OPENAI_CATEGORIES);
    const customThreshold = (c: ModerationCategory) => options.thresholds?.[c] !== undefined || options.thresholds?.['*'] !== undefined;

    const results: ModerationResult[] = items.map((_, idx) => {
        const scores = emptyRecord(0);
        const flags = emptyRecord(false);
        const matches: ModerationMatch[] = [];

        const o = openai?.results[idx];
        if (o) {
            for (const [category, score] of Object.entries(o.category_scores ?? {})) {
                if (!openaiSet.has(category)) continue;
                const c = category as ModerationCategory;
                scores[c] = Math.max(scores[c], score);
                // OpenAI's own flag uses its tuned thresholds; honour it unless
                // the caller set an explicit threshold for this category.
                const openaiFlag = (o.categories as unknown as Record<string, boolean>)[category] === true;
                if (openaiFlag && !customThreshold(c)) flags[c] = true;
                if (openaiFlag || score >= thresholdFor(c)) {
                    matches.push({ layer: 'openai', category: c, score: round(score) });
                }
            }
        }

        const rr = ruleResults?.[idx];
        if (rr) {
            for (const [category, score] of Object.entries(rr.scores) as [ModerationCategory, number][]) {
                scores[category] = Math.max(scores[category], score);
            }
            for (const m of dedupeMatches(rr.matches)) {
                matches.push({ layer: 'rules', category: m.category, score: m.weight, rule: m.rule, text: m.text });
            }
        }

        for (const c of ALL_CATEGORIES) {
            if (scores[c] >= thresholdFor(c)) flags[c] = true;
            scores[c] = round(scores[c]);
        }
        // "fraud" rolls up the fraud/* categories.
        if (ALL_CATEGORIES.some((c) => c.startsWith('fraud/') && flags[c])) flags.fraud = true;

        const flaggedCategories = ALL_CATEGORIES.filter((c) => flags[c]);
        const maxScore = Math.max(0, ...flaggedCategories.map((c) => scores[c]));
        const action: ModerationAction =
            flaggedCategories.length === 0 ? 'allow' : maxScore >= blockAt || flags['sexual/minors'] ? 'block' : 'review';

        return {
            flagged: flaggedCategories.length > 0,
            action,
            categories: flags,
            category_scores: scores,
            ...(o?.category_applied_input_types
                ? { category_applied_input_types: o.category_applied_input_types as unknown as Record<string, string[]> }
                : {}),
            flagged_categories: flaggedCategories,
            matches,
        };
    });

    return {
        id: openai?.id ?? `modr-cencori-${cryptoRandom()}`,
        model: openai?.model ?? (layers.has('openai') ? model : RULES_VERSION),
        results,
        layers: layerStatus,
        ...(ruleResults ? { rules_version: RULES_VERSION } : {}),
        ...(errors.length ? { errors } : {}),
    };
}

function dedupeMatches(matches: RuleMatch[]): RuleMatch[] {
    const seen = new Set<string>();
    return matches.filter((m) => {
        const key = `${m.rule}:${m.category}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function round(n: number): number {
    return Math.round(n * 10000) / 10000;
}

function cryptoRandom(): string {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}
