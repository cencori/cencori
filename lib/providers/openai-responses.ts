/**
 * OpenAI Responses API wire mapping.
 *
 * GPT-6 reasons by default (effort "medium"), and OpenAI rejects function tools
 * combined with reasoning on /v1/chat/completions for that family: "Function
 * tools with reasoning_effort are not supported for gpt-6-luna in
 * /v1/chat/completions". Those calls go to /v1/responses upstream instead, and
 * this file translates the unified request/response shapes to and from it so
 * callers still see Chat Completions semantics.
 */

import type OpenAI from 'openai';
import type {
    FunctionTool,
    Response,
    ResponseCreateParamsNonStreaming,
    ResponseInputContent,
    ResponseInputItem,
} from 'openai/resources/responses/responses';
import type { StreamChunk, ToolCall, UnifiedChatRequest, UnifiedMessage } from './base';

/**
 * True when this request has to use the Responses API: a GPT-6 model with
 * function tools and reasoning left on (anything but an explicit 'none').
 */
export function needsOpenAIResponsesApi(request: Pick<UnifiedChatRequest, 'model' | 'tools' | 'reasoningEffort'>): boolean {
    return /^gpt-6(?:[.-]|$)/.test(request.model)
        && (request.tools?.length ?? 0) > 0
        && request.reasoningEffort !== 'none';
}

export function toResponsesInput(messages: UnifiedMessage[]): ResponseInputItem[] {
    const input: ResponseInputItem[] = [];
    for (const msg of messages) {
        if (msg.role === 'tool') {
            // A function_call_output carries text only; images on a tool turn
            // are dropped, matching the Chat Completions mapping.
            input.push({ type: 'function_call_output', call_id: msg.toolCallId ?? '', output: msg.content });
            continue;
        }

        if (msg.role === 'assistant') {
            if (msg.content) input.push({ role: 'assistant', content: msg.content });
            for (const tc of msg.tool_calls ?? []) {
                input.push({
                    type: 'function_call',
                    call_id: tc.id,
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                });
            }
            continue;
        }

        if (msg.images?.length) {
            const content: ResponseInputContent[] = [];
            if (msg.content) content.push({ type: 'input_text', text: msg.content });
            for (const image of msg.images) {
                content.push({ type: 'input_image', image_url: image.url, detail: image.detail ?? 'auto' });
            }
            input.push({ role: msg.role, content });
        } else {
            input.push({ role: msg.role, content: msg.content });
        }
    }
    return input;
}

function toResponsesTools(tools: UnifiedChatRequest['tools']): FunctionTool[] | undefined {
    return tools?.map((t) => ({
        type: 'function',
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
        // Chat Completions tools are non-strict unless asked; keep that.
        strict: false,
    }));
}

function toResponsesToolChoice(choice: UnifiedChatRequest['toolChoice']): ResponseCreateParamsNonStreaming['tool_choice'] {
    if (!choice) return undefined;
    if (typeof choice === 'string') return choice;
    return { type: 'function', name: choice.function.name };
}

export function toResponsesParams(request: UnifiedChatRequest): Omit<ResponseCreateParamsNonStreaming, 'stream'> {
    return {
        model: request.model,
        input: toResponsesInput(request.messages),
        // Chat Completions history is resent on every turn, so nothing needs
        // to persist upstream.
        store: false,
        ...(request.maxTokens ? { max_output_tokens: request.maxTokens } : {}),
        // The SDK types predate the max effort used by newer reasoning models.
        ...(request.reasoningEffort ? { reasoning: { effort: request.reasoningEffort as OpenAI.ReasoningEffort } } : {}),
        tools: toResponsesTools(request.tools),
        ...(request.toolChoice ? { tool_choice: toResponsesToolChoice(request.toolChoice) } : {}),
        ...(request.parallelToolCalls !== undefined ? { parallel_tool_calls: request.parallelToolCalls } : {}),
        ...(request.userId ? { user: request.userId } : {}),
        ...(request.promptCacheKey ? { prompt_cache_key: request.promptCacheKey } : {}),
    };
}

/** Responses usage in the Chat Completions shape splitOpenAICachedTokens reads. */
export function responsesUsageAsChat(usage: Response['usage']) {
    return {
        prompt_tokens: usage?.input_tokens ?? 0,
        completion_tokens: usage?.output_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
        prompt_tokens_details: { cached_tokens: usage?.input_tokens_details?.cached_tokens ?? 0 },
    };
}

export function responsesToolCalls(response: Pick<Response, 'output'>): ToolCall[] | undefined {
    const calls = response.output
        .filter((item) => item.type === 'function_call')
        .map((item) => ({
            id: item.call_id,
            type: 'function' as const,
            function: { name: item.name, arguments: item.arguments },
        }));
    return calls.length > 0 ? calls : undefined;
}

export function responsesText(response: Pick<Response, 'output'>): string {
    let text = '';
    for (const item of response.output) {
        if (item.type !== 'message') continue;
        for (const part of item.content) {
            if (part.type === 'output_text') text += part.text;
        }
    }
    return text;
}

export function responsesFinishReason(
    response: Pick<Response, 'output' | 'status' | 'incomplete_details'>,
): StreamChunk['finishReason'] {
    if (response.status === 'incomplete') {
        return response.incomplete_details?.reason === 'content_filter' ? 'content_filter' : 'length';
    }
    return response.output.some((item) => item.type === 'function_call') ? 'tool_calls' : 'stop';
}
