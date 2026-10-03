/**
 * @vitest-environment node
 *
 * Extraction retry: an empty/unparseable first completion (or a dead chain)
 * gets exactly one retry — usually a spent reasoning budget, not a verdict.
 * An explicit `[]` is a verdict and is never retried.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm', () => ({
    callMemoryLlm: vi.fn(),
}));

import { callMemoryLlm } from '../llm';
import { extractFacts, isExplicitEmptyVerdict } from '../extraction';
import type { MemorySettings } from '../types';

const mockedCall = vi.mocked(callMemoryLlm);

const SETTINGS: MemorySettings = {
    enabled: true,
    extractionModel: 'openai/gpt-oss-20b',
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
    return { content, model: 'openai/gpt-oss-20b', provider: 'groq', costUsd: 0.001 };
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
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(llmResult('[{"fact": "Prefers dark mode", "importance": 0.7}]'));
        const result = await extractFacts(base());
        expect(result.facts).toEqual([{ content: 'Prefers dark mode', importance: 0.7 }]);
        expect(result.attempts).toBe(2);
        expect(result.provider).toBe('groq');
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

    it('gives up after the retry and reports attempts', async () => {
        mockedCall.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        const result = await extractFacts(base());
        expect(result.facts).toEqual([]);
        expect(result.attempts).toBe(2);
        expect(result.provider).toBe('');
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
