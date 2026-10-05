/**
 * @vitest-environment node
 *
 * Extraction retry: an empty/unparseable first completion (or a dead chain)
 * gets exactly one retry — usually a spent reasoning budget, not a verdict.
 * An explicit `[]` is a verdict and is never retried.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm', async importOriginal => {
    const actual = await importOriginal<typeof import('../llm')>();
    return { ...actual, callMemoryLlm: vi.fn() };
});

import { callMemoryLlm, MemoryLlmExhaustedError } from '../llm';
import { extractFacts, isExplicitEmptyVerdict } from '../extraction';
import type { MemorySettings } from '../types';

const mockedCall = vi.mocked(callMemoryLlm);

const SETTINGS: MemorySettings = {
    enabled: true,
    extractionModel: 'gpt-oss-120b',
    extractionPrompt: null,
    minImportance: 0.5,
    maxMemoriesPerExchange: 5,
    sessionTtlSeconds: 86400,
    graphEnabled: true,
};

function base() {
    return {
        supabase: {} as never,
        projectId: 'p1',
        organizationId: 'o1',
        tier: 'pro' as const,
        settings: SETTINGS,
        extractOverride: null,
        userText: 'I prefer dark mode.',
        assistantText: 'Noted.',
    };
}

function llmResult(content: string) {
    return { content, model: 'gpt-oss-120b', provider: 'cerebras', costUsd: 0.001 };
}

describe('isExplicitEmptyVerdict', () => {
    it('accepts only a genuine empty array', () => {
        expect(isExplicitEmptyVerdict('[]')).toBe(true);
        expect(isExplicitEmptyVerdict('[  ]')).toBe(true);
        expect(isExplicitEmptyVerdict('```json\n[]\n```')).toBe(true);
        expect(isExplicitEmptyVerdict('')).toBe(false);
        expect(isExplicitEmptyVerdict('no array here')).toBe(false);
        expect(isExplicitEmptyVerdict('[{"fact": "x", "importance": 0.5}]')).toBe(false);
        expect(isExplicitEmptyVerdict('[{"nope": 1}]')).toBe(false);
        expect(isExplicitEmptyVerdict('[{"fact": "x"')).toBe(false);
    });
});

describe('extractFacts retry', () => {
    beforeEach(() => {
        mockedCall.mockReset();
    });

    it('retries once on empty output then succeeds', async () => {
        mockedCall
            .mockRejectedValueOnce(new MemoryLlmExhaustedError(['gpt-oss-120b: timed out']))
            .mockResolvedValueOnce(llmResult('[{"fact": "Prefers dark mode", "importance": 0.7}]'));
        const result = await extractFacts(base());
        expect(result.facts).toEqual([{ content: 'Prefers dark mode', importance: 0.7 }]);
        expect(result.attempts).toBe(2);
        expect(result.provider).toBe('cerebras');
        expect(result.parsedCount).toBe(1);
        expect(result.attemptErrors).toEqual(['gpt-oss-120b: timed out']);
        expect(mockedCall).toHaveBeenCalledTimes(2);
    });

    it('retries once on unparseable output then succeeds', async () => {
        mockedCall
            .mockResolvedValueOnce(llmResult('thinking thinking thinking'))
            .mockResolvedValueOnce(llmResult('[{"fact": "Prefers dark mode", "importance": 0.7}]'));
        const result = await extractFacts(base());
        expect(result.facts).toHaveLength(1);
        expect(result.attempts).toBe(2);
    });

    it('accepts an explicit [] verdict without retrying', async () => {
        mockedCall.mockResolvedValueOnce(llmResult('[]'));
        const result = await extractFacts(base());
        expect(result.facts).toEqual([]);
        expect(result.attempts).toBe(1);
        expect(mockedCall).toHaveBeenCalledTimes(1);
    });

    it('reports parsedCount separately from filtered facts (no retry on filtering)', async () => {
        mockedCall.mockResolvedValueOnce(llmResult('[{"fact": "Trivia", "importance": 0.1}]'));
        const result = await extractFacts(base());
        expect(result.facts).toEqual([]);
        expect(result.parsedCount).toBe(1);
        expect(result.attempts).toBe(1);
        expect(mockedCall).toHaveBeenCalledTimes(1);
    });

    it('collects per-attempt causes when the chain is exhausted', async () => {
        mockedCall.mockRejectedValue(
            new MemoryLlmExhaustedError(['gpt-oss-120b: 429 rate limited', 'vercel/openai/gpt-oss-20b: 429 rate limited'])
        );
        const result = await extractFacts(base());
        expect(result.facts).toEqual([]);
        expect(result.attempts).toBe(2);
        expect(result.attemptErrors).toEqual([
            'gpt-oss-120b: 429 rate limited',
            'vercel/openai/gpt-oss-20b: 429 rate limited',
            'gpt-oss-120b: 429 rate limited',
            'vercel/openai/gpt-oss-20b: 429 rate limited',
        ]);
        expect(mockedCall).toHaveBeenCalledTimes(2);
    });

    it('succeeds first try with a single attempt', async () => {
        mockedCall.mockResolvedValueOnce(llmResult('[{"fact": "Prefers dark mode", "importance": 0.7}]'));
        const result = await extractFacts(base());
        expect(result.facts).toHaveLength(1);
        expect(result.attempts).toBe(1);
        expect(mockedCall).toHaveBeenCalledTimes(1);
    });
});
