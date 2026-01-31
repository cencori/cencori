/**
 * Mock AI Provider Utilities for Integration Tests
 * 
 * Provides mock responses for AI providers to test integrations
 * without making actual API calls.
 */

import type { UnifiedChatResponse, StreamChunk, TokenUsage, CostBreakdown } from '@/lib/providers/base';

/**
 * Create a mock token usage object
 */
export function createMockTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
    return {
        promptTokens: overrides.promptTokens ?? 100,
        completionTokens: overrides.completionTokens ?? 50,
        totalTokens: overrides.totalTokens ?? 150,
    };
}

/**
 * Create a mock cost breakdown
 */
export function createMockCostBreakdown(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
    return {
        providerCostUsd: overrides.providerCostUsd ?? 0.001,
        cencoriChargeUsd: overrides.cencoriChargeUsd ?? 0.0012,
        markupPercentage: overrides.markupPercentage ?? 20,
    };
}

/**
 * Create a mock chat response
 */
export function createMockChatResponse(overrides: Partial<UnifiedChatResponse> = {}): UnifiedChatResponse {
    return {
        content: overrides.content ?? 'This is a mock response from the AI provider.',
        model: overrides.model ?? 'gpt-4o-mini',
        provider: overrides.provider ?? 'openai',
        usage: overrides.usage ?? createMockTokenUsage(),
        cost: overrides.cost ?? createMockCostBreakdown(),
        latencyMs: overrides.latencyMs ?? 250,
        finishReason: overrides.finishReason ?? 'stop',
        toolCalls: overrides.toolCalls,
    };
}

/**
 * Create mock stream chunks
 */
export function* createMockStreamChunks(
    content: string = 'This is a streamed response.',
    chunkSize: number = 5
): Generator<StreamChunk> {
    const words = content.split(' ');

    for (let i = 0; i < words.length; i++) {
        const isLast = i === words.length - 1;
        yield {
            delta: words[i] + (isLast ? '' : ' '),
            finishReason: isLast ? 'stop' : undefined,
        };
    }
}

/**
 * Create an async generator for mock streaming
 */
export async function* createMockAsyncStream(
    content: string = 'This is a streamed response.',
    delayMs: number = 10
): AsyncGenerator<StreamChunk> {
    for (const chunk of createMockStreamChunks(content)) {
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        yield chunk;
    }
}

/**
 * Mock OpenAI-style response (raw API format)
 */
export function createMockOpenAIResponse(overrides: {
    content?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
} = {}) {
    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: overrides.model ?? 'gpt-4o-mini',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: overrides.content ?? 'Mock OpenAI response',
                },
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: overrides.promptTokens ?? 100,
            completion_tokens: overrides.completionTokens ?? 50,
            total_tokens: (overrides.promptTokens ?? 100) + (overrides.completionTokens ?? 50),
        },
    };
}

/**
 * Mock Anthropic-style response (raw API format)
 */
export function createMockAnthropicResponse(overrides: {
    content?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
} = {}) {
    return {
        id: `msg-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: overrides.model ?? 'claude-3-5-sonnet-20241022',
        content: [
            {
                type: 'text',
                text: overrides.content ?? 'Mock Anthropic response',
            },
        ],
        stop_reason: 'end_turn',
        usage: {
            input_tokens: overrides.inputTokens ?? 100,
            output_tokens: overrides.outputTokens ?? 50,
        },
    };
}

/**
 * Mock Google Gemini-style response (raw API format)
 */
export function createMockGeminiResponse(overrides: {
    content?: string;
    model?: string;
    promptTokens?: number;
    candidatesTokens?: number;
} = {}) {
    return {
        candidates: [
            {
                content: {
                    parts: [
                        {
                            text: overrides.content ?? 'Mock Gemini response',
                        },
                    ],
                    role: 'model',
                },
                finishReason: 'STOP',
                index: 0,
            },
        ],
        usageMetadata: {
            promptTokenCount: overrides.promptTokens ?? 100,
            candidatesTokenCount: overrides.candidatesTokens ?? 50,
            totalTokenCount: (overrides.promptTokens ?? 100) + (overrides.candidatesTokens ?? 50),
        },
    };
}
