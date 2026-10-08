/**
 * Provider Utility Functions
 * 
 * Helper functions for message normalization and common provider operations
 */

import { UnifiedMessage, ToolCall } from './base';
import { InvalidRequestError } from './errors';

/**
 * Image formats and per-image byte caps per provider. This mirrors
 * `VISION_PROVIDER_LIMITS` in lib/vision/analyze.ts — duplicated rather than
 * imported so providers never depend on the vision layer (analyze.ts imports
 * the OpenAI-compatible registry from here, so importing it back would cycle).
 */
const ANTHROPIC_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const GOOGLE_IMAGE_FORMATS = [...ANTHROPIC_IMAGE_FORMATS, 'image/heic', 'image/heif'];
const ANTHROPIC_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const GOOGLE_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function normalizeImageMime(mimeType: string): string {
    const lower = mimeType.toLowerCase().trim();
    // Anthropic and Google both expect the canonical `image/jpeg`.
    return lower === 'image/jpg' ? 'image/jpeg' : lower;
}

function imageByteLength(base64: string): number {
    // 4 base64 chars encode 3 bytes; trailing '=' padding trims the last group.
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor((base64.length * 3) / 4) - padding;
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
    return `${(bytes / 1024).toFixed(0)}KB`;
}

/**
 * Split a `data:<mime>;base64,...` URL into its parts, validating mime and
 * size for the target provider. Anything malformed, foreign, or oversized
 * throws InvalidRequestError (a 400, never retried) rather than being
 * silently dropped — a dropped image would answer without seeing it.
 */
export function parseImageDataUrl(
    url: string,
    provider: string,
    allowedFormats: readonly string[] = ANTHROPIC_IMAGE_FORMATS,
    maxBytes: number = ANTHROPIC_MAX_IMAGE_BYTES,
): { mimeType: string; data: string } {
    const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(url);
    if (!match || match[2] !== ';base64') {
        throw new InvalidRequestError(provider, 'Image data URL must be base64-encoded (data:<mime>;base64,...).');
    }
    // Lenient on a missing mime (default JPEG, like the vision layer) but
    // strict on a wrong one — sending it anyway only buys an upstream 400.
    const mimeType = normalizeImageMime(match[1] || 'image/jpeg');
    if (!allowedFormats.includes(mimeType)) {
        throw new InvalidRequestError(
            provider,
            `Image format "${match[1] || 'unknown'}" is not supported by ${provider}. ` +
            `Supported formats: ${allowedFormats.map(m => m.replace('image/', '').toUpperCase()).join(', ')}.`,
        );
    }
    const data = match[3];
    if (!data) {
        throw new InvalidRequestError(provider, 'Image data URL carries no data.');
    }
    if (imageByteLength(data) > maxBytes) {
        throw new InvalidRequestError(
            provider,
            `Image is ${formatBytes(imageByteLength(data))} but ${provider} allows a maximum of ${formatBytes(maxBytes)} per image.`,
        );
    }
    return { mimeType, data };
}

/**
 * OpenAI message format
 *
 * `content` widens to a part list only for a turn that carries images; text-only turns keep the
 * plain string every provider on this wire format has always received.
 */
export type OpenAIContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | OpenAIContentPart[];
    tool_call_id?: string;
    tool_calls?: ToolCall[];
    /**
     * Thinking trace a reasoning provider returned on this turn.
     * Only ever present on assistant messages the gateway captured it on;
     * providers that do not understand it ignore unknown fields.
     */
    reasoning_content?: string;
}

/**
 * Anthropic message format
 *
 * Anthropic carries tool calls and their results as content blocks rather than
 * as separate message fields, so `content` widens to a block list whenever a
 * turn involves tools — and, since images ride as image blocks, whenever a
 * turn carries images. Plain text turns stay plain strings.
 */
export type AnthropicImageSource =
    | { type: 'base64'; media_type: string; data: string }
    | { type: 'url'; url: string };

export type AnthropicContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: AnthropicImageSource }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; tool_use_id: string; content: string };

export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
}

/**
 * Convert one unified image to an Anthropic image block.
 *
 * `data:` URLs become base64 blocks (validated); `https:` URLs become URL
 * blocks, which Anthropic fetches itself. Anything else (http, ftp, garbage)
 * throws rather than being sent to a certain upstream rejection.
 */
export function toAnthropicImageBlock(url: string, provider = 'anthropic'): AnthropicContentBlock {
    if (url.startsWith('data:')) {
        const { mimeType, data } = parseImageDataUrl(url, provider);
        return { type: 'image', source: { type: 'base64', media_type: mimeType, data } };
    }
    if (/^https:\/\//i.test(url)) {
        return { type: 'image', source: { type: 'url', url } };
    }
    throw new InvalidRequestError(provider, 'Image URL must be a data: URL or an https:// URL.');
}

/**
 * Parse the JSON-string arguments we carry on ToolCall into the object
 * Anthropic expects. Malformed arguments become an empty object rather than
 * throwing — the model gets to see the tool failed instead of the request 400ing.
 */
function parseToolArguments(args: string): Record<string, unknown> {
    if (!args || !args.trim()) return {};
    try {
        const parsed = JSON.parse(args);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : {};
    } catch {
        return {};
    }
}

/**
 * Gemini message format
 *
 * `parts` widens beyond text only for turns that carry images; text-only turns
 * keep the single-text-part shape the adapter has always sent.
 */
export type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };

export interface GeminiMessage {
    role: 'user' | 'model';
    parts: GeminiPart[];
}

/**
 * Build the parts list for one turn: prose first, then one inline-data part
 * per image. Only `data:` URLs are accepted here — Gemini cannot fetch remote
 * URLs, so callers must resolve `https:` images to bytes first (see the
 * Gemini adapter); an unresolved URL throws rather than being dropped.
 */
function toGeminiParts(msg: Pick<UnifiedMessage, 'content' | 'images'>): GeminiPart[] {
    const images = msg.images ?? [];
    // Text-only turns keep the exact single-text-part shape the adapter has
    // always sent — including the empty-string edge, which the SDK accepts.
    if (images.length === 0) return [{ text: msg.content }];
    const parts: GeminiPart[] = [];
    if (msg.content) parts.push({ text: msg.content });
    for (const image of images) {
        if (!image.url.startsWith('data:')) {
            throw new InvalidRequestError(
                'google',
                'Gemini chat images must be data: URLs. Resolve https:// image URLs to bytes before conversion.',
            );
        }
        const { mimeType, data } = parseImageDataUrl(image.url, 'google', GOOGLE_IMAGE_FORMATS, GOOGLE_MAX_IMAGE_BYTES);
        parts.push({ inlineData: { mimeType, data } });
    }
    return parts;
}

/**
 * Convert unified messages to OpenAI format
 *
 * `reasoningContent` rides on the assistant turn it was captured on, so a
 * thinking-mode provider gets its own trace back verbatim. Only when asked:
 * `reasoning_content` is a vendor field, required by some (DeepSeek), used by
 * a few, and an unknown property to the rest, which strict APIs reject. A
 * trace captured on one model must also never reach another mid-task. Pairing is
 * order-preserving: this maps one-to-one and never inserts, drops, or
 * reorders turns — contiguity of a tool block is decided upstream by the
 * translator, not here.
 */
export function toOpenAIMessages(
    messages: UnifiedMessage[],
    { echoReasoning = false }: { echoReasoning?: boolean } = {},
): OpenAIMessage[] {
    return messages.map(msg => ({
        role: msg.role,
        content: toOpenAIContent(msg),
        // `tool_call_id` is only meaningful on `tool` turns. Emitting it on
        // assistant turns is at best ignored and at worst a strictness trip
        // on providers that validate turn shapes.
        ...(msg.role === 'tool' && msg.toolCallId ? { tool_call_id: msg.toolCallId } : {}),
        ...(msg.tool_calls && msg.tool_calls.length > 0 ? { tool_calls: msg.tool_calls } : {}),
        ...(echoReasoning && msg.role === 'assistant' && msg.reasoningContent
            ? { reasoning_content: msg.reasoningContent }
            : {}),
    }));
}

/**
 * A `tool` message may not carry images on this wire format, so images attached to one are left
 * behind rather than sent where they would be rejected. The Responses surface never produces that
 * shape — it moves an image tool's output onto the user turn that follows it.
 */
function toOpenAIContent(msg: UnifiedMessage): string | OpenAIContentPart[] {
    if (!msg.images?.length || msg.role === 'tool') return msg.content;

    const parts: OpenAIContentPart[] = [];
    if (msg.content) parts.push({ type: 'text', text: msg.content });
    for (const image of msg.images) {
        parts.push({
            type: 'image_url',
            image_url: { url: image.url, ...(image.detail ? { detail: image.detail } : {}) },
        });
    }
    return parts;
}

/**
 * Convert unified messages to Anthropic format
 *
 * Note: Anthropic handles system messages separately. Tool turns are also
 * shaped differently from OpenAI's: an assistant tool call becomes a `tool_use`
 * block on the assistant turn, and each tool result becomes a `tool_result`
 * block on a *user* turn. Parallel results must share one user turn, so
 * consecutive tool messages are merged rather than emitted one turn each.
 *
 * Images ride as image blocks on the turn that carries them (`data:` URLs as
 * base64, `https:` as URL blocks Anthropic fetches itself). Turns without
 * images keep the exact shapes they always had.
 */
export function toAnthropicMessages(
    messages: UnifiedMessage[],
    { provider = 'anthropic' }: { provider?: string } = {},
): {
    system?: string;
    messages: AnthropicMessage[];
} {
    // Anthropic has one top-level system slot, so every system message has to
    // fold into it. Keeping only the first would silently drop mid-conversation
    // instructions — the tool-approval resume path emits one.
    const systemMessages = messages.filter(m => m.role === 'system' && m.content);
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const converted: AnthropicMessage[] = [];

    for (const msg of nonSystemMessages) {
        if (msg.role === 'tool') {
            const block: AnthropicContentBlock = {
                type: 'tool_result',
                tool_use_id: msg.toolCallId ?? '',
                content: msg.content ?? '',
            };
            const previous = converted[converted.length - 1];
            if (previous && previous.role === 'user' && Array.isArray(previous.content)) {
                previous.content.push(block);
            } else {
                converted.push({ role: 'user', content: [block] });
            }
            continue;
        }

        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
            const blocks: AnthropicContentBlock[] = [];
            // Anthropic rejects empty text blocks, and a tool-calling turn
            // frequently has no prose at all.
            if (msg.content) {
                blocks.push({ type: 'text', text: msg.content });
            }
            for (const image of msg.images ?? []) {
                blocks.push(toAnthropicImageBlock(image.url, provider));
            }
            for (const call of msg.tool_calls) {
                blocks.push({
                    type: 'tool_use',
                    id: call.id,
                    name: call.function.name,
                    input: parseToolArguments(call.function.arguments),
                });
            }
            converted.push({ role: 'assistant', content: blocks });
            continue;
        }

        const imageBlocks = (msg.images ?? []).map(image => toAnthropicImageBlock(image.url, provider));
        if (imageBlocks.length === 0) {
            converted.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content,
            });
            continue;
        }
        // Prose first, then images — and never an empty text block, which
        // Anthropic rejects. An images-only turn is blocks of images alone.
        const blocks: AnthropicContentBlock[] = [];
        if (msg.content) {
            blocks.push({ type: 'text', text: msg.content });
        }
        blocks.push(...imageBlocks);
        converted.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: blocks,
        });
    }

    return {
        system: systemMessages.length > 0
            ? systemMessages.map(m => m.content).join('\n\n')
            : undefined,
        messages: converted,
    };
}

/**
 * Convert unified messages to Gemini format.
 *
 * Gemini uses chat history + current prompt format; all messages except the
 * last one go into history. Text-only turns keep the single-text-part shape
 * the adapter has always sent; turns with images widen to text plus one
 * inline-data part per image.
 */
export function toGeminiMessages(messages: UnifiedMessage[]): {
    history: GeminiMessage[];
    prompt: string | GeminiPart[];
} {
    const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: toGeminiParts(msg),
    }));

    const lastMessage = messages[messages.length - 1];
    const lastParts = toGeminiParts(lastMessage);

    return {
        history,
        // A lone text part collapses back to the plain string every caller
        // has always passed; anything richer goes over as parts.
        prompt: lastParts.length === 1 && 'text' in lastParts[0]
            ? lastParts[0].text
            : lastParts,
    };
}

/**
 * Estimate token count (rough approximation)
 * Used when provider doesn't offer token counting API
 */
export function estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    // This is approximate and varies by language and tokenizer
    return Math.ceil(text.length / 4);
}

/**
 * Combine multiple messages into single text
 */
export function combineMessages(messages: UnifiedMessage[]): string {
    return messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');
}

/**
 * Extract system message from messages array
 */
export function extractSystemMessage(messages: UnifiedMessage[]): string | undefined {
    return messages.find(m => m.role === 'system')?.content;
}

/**
 * Filter out system messages
 */
export function filterSystemMessages(messages: UnifiedMessage[]): UnifiedMessage[] {
    return messages.filter(m => m.role !== 'system');
}

/**
 * Validate messages array
 */
export function validateMessages(messages: UnifiedMessage[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array must not be empty');
    }

    for (const msg of messages) {
        if (!msg.role || !msg.content) {
            throw new Error('Each message must have role and content');
        }

        if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
            throw new Error(`Invalid message role: ${msg.role}`);
        }
    }
}
