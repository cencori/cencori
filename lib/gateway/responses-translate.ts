/**
 * Responses → chat translation, in exactly one place.
 *
 * Two call sites used to translate Responses input items into chat turns
 * independently — the `/v1/responses` route (for the security pipeline) and
 * `parseInputToMessages` in the execution layer — and a third replayed
 * `previous_response_id` output with a *fourth*, older shape. Every divergence
 * is a place a balanced client history becomes an unbalanced provider
 * payload: DeepSeek thinking turns 400'd with chat-completions vocabulary
 * ("assistant message with 'tool_calls' must be followed by tool messages",
 * "`reasoning_content` must be passed back") on histories the runtime had
 * verified balanced, because the information was lost here, upstream of
 * anything the client stored.
 *
 * Rules this translator enforces:
 *
 * - `reasoning` items become the assistant turn's `reasoningContent`, which
 *   `toOpenAIMessages` emits as `reasoning_content`. Thinking-mode providers
 *   require their own trace back verbatim.
 * - `function_call` always carries its name and arguments as `tool_calls`
 *   (the bare-`toolCallId` shape that dropped them is gone everywhere), and
 *   a contiguous run of calls shares ONE assistant turn — the canonical
 *   parallel-call shape. One turn per call is what 400'd parallel fan-outs
 *   on strict providers while sequential histories passed.
 * - A contiguous run of `function_call_output` items emits every `tool` turn
 *   before any image-caption `user` turn, so nothing the translator itself
 *   generates can split a tool block and trip strict pairing checks.
 * - Anything untranslatable is counted in `dropped`, never silently lost:
 *   callers log it before dispatch.
 */

import type { UnifiedImagePart, UnifiedMessage } from '@/lib/providers/base';
import { normalizeResponsesContent, toolOutputTurns } from '@/lib/gateway/responses-content';

/** Structural subset of the Responses input items this translator reads. */
export type TranslatableInputItem =
    | { type: 'message'; role: 'user' | 'assistant' | 'system'; content: unknown }
    | { type: 'function_call'; id: string; call_id: string; name: string; arguments: string; status?: string }
    | { type: 'function_call_output'; call_id: string; output: unknown }
    | { type: 'file'; filename: string; content: string; mime_type?: string }
    | { type: 'reasoning'; summary?: unknown; content?: unknown; text?: unknown }
    | { type: string };

/** Stored Responses output items replayed via `previous_response_id`. */
export type TranslatableOutputItem =
    | { type: 'message'; content?: Array<{ text?: string }> }
    | { type: 'function_call'; id: string; call_id?: string; name?: string; arguments?: string }
    | { type: 'reasoning'; summary?: unknown }
    | { type: string };

export type TranslationResult = {
    messages: UnifiedMessage[];
    /** Human-readable descriptions of items that could not be translated. */
    dropped: string[];
};

/**
 * Pull reasoning text out of the several shapes it arrives in: a plain
 * string (`content`/`text`), a bare summary string, or an OpenAI-style
 * `summary` part list (`[{ type: 'summary_text', text }]`).
 */
export function extractReasoningText(item: { summary?: unknown; content?: unknown; text?: unknown }): string | null {
    for (const candidate of [item.content, item.text]) {
        if (typeof candidate === 'string' && candidate) return candidate;
    }
    const summary = item.summary;
    if (typeof summary === 'string' && summary) return summary;
    if (Array.isArray(summary)) {
        const texts = summary
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string') {
                    return (part as Record<string, unknown>).text as string;
                }
                return '';
            })
            .filter(Boolean);
        if (texts.length > 0) return texts.join('\n');
    }
    return null;
}

function translateFileItem(item: { filename: string; content: string; mime_type?: string }): UnifiedMessage {
    return {
        role: 'user',
        content: `[File: ${item.filename}]${item.mime_type ? ` (${item.mime_type})` : ''}\n\n${item.content}`,
    };
}

/**
 * One assistant turn under construction. A parallel fan-out arrives as
 * consecutive `function_call` items (with the turn's `reasoning` beside
 * them); the chat wire format carries those as ONE assistant message with
 * N `tool_calls`, and strict providers 400 when each call rides its own
 * turn instead. Sequential histories (call, output, call, output) flush
 * between turns, so each pair keeps the adjacency it already had.
 */
class PendingAssistantTurn {
    private calls: Array<{ id: string; name: string; args: string }> = [];
    private reasoning: string[] = [];

    get empty(): boolean {
        return this.calls.length === 0 && this.reasoning.length === 0;
    }

    addCall(id: string, name: string, args: string): void {
        this.calls.push({ id, name, args });
    }

    addReasoning(text: string): void {
        this.reasoning.push(text);
    }

    flush(): UnifiedMessage | null {
        if (this.empty) return null;
        const turn: UnifiedMessage = {
            role: 'assistant',
            content: '',
            ...(this.reasoning.length > 0 ? { reasoningContent: this.reasoning.join('\n') } : {}),
        };
        if (this.calls.length > 0) {
            turn.tool_calls = this.calls.map((call) => ({
                id: call.id,
                type: 'function' as const,
                function: { name: call.name, arguments: call.args },
            }));
        }
        this.calls = [];
        this.reasoning = [];
        return turn;
    }
}

/**
 * Translate Responses input items to chat turns. One item in, the same turns
 * out, in order — except image-caption follow-ups, which wait for the end of
 * their tool-output run (see module doc).
 */
export function translateResponsesInputItems(
    input: string | TranslatableInputItem[],
    instructions?: string,
): TranslationResult {
    const messages: UnifiedMessage[] = [];
    const dropped: string[] = [];

    if (instructions) {
        messages.push({ role: 'system', content: instructions });
    }

    if (typeof input === 'string') {
        messages.push({ role: 'user', content: input });
        return { messages, dropped };
    }

    // Image-caption user turns deferred past the tool block they belong to.
    let deferredImages: Array<{ content: string; images?: UnifiedImagePart[] }> = [];
    const flushDeferredImages = () => {
        for (const followUp of deferredImages) {
            messages.push({ role: 'user', ...followUp });
        }
        deferredImages = [];
    };

    // Parallel calls accumulate into one assistant turn; anything else flushes.
    const pending = new PendingAssistantTurn();
    const flushPending = () => {
        const turn = pending.flush();
        if (turn) messages.push(turn);
    };

    for (const item of input) {
        // A non-output item ends the tool-output run: captions flush first so
        // they land after the whole block, never inside it. A pending call
        // run flushes too — its answers, if any, belong to earlier turns.
        if (item.type !== 'function_call_output' && deferredImages.length > 0) {
            flushDeferredImages();
        }
        if (item.type !== 'function_call' && item.type !== 'reasoning' && !pending.empty) {
            flushPending();
        }
        switch (item.type) {
            case 'message': {
                const { text, images } = normalizeResponsesContent(
                    (item as { content: unknown }).content,
                );
                messages.push({
                    role: (item as { role: 'user' | 'assistant' | 'system' }).role,
                    content: text,
                    ...(images.length ? { images } : {}),
                });
                break;
            }
            case 'function_call': {
                const call = item as {
                    id: string;
                    call_id: string;
                    name: string;
                    arguments: string;
                };
                pending.addCall(call.call_id, call.name, call.arguments);
                break;
            }
            case 'function_call_output': {
                const out = item as { call_id: string; output: unknown };
                for (const turn of toolOutputTurns(out.output, out.call_id)) {
                    if (turn.role === 'tool') {
                        messages.push({ role: 'tool', content: turn.content, toolCallId: turn.toolCallId });
                    } else {
                        deferredImages.push({
                            content: turn.content,
                            ...(turn.images?.length ? { images: turn.images } : {}),
                        });
                    }
                }
                break;
            }
            case 'file': {
                const file = item as { filename: string; content: string; mime_type?: string };
                messages.push(translateFileItem(file));
                break;
            }
            case 'reasoning': {
                const text = extractReasoningText(item as { summary?: unknown; content?: unknown; text?: unknown });
                if (text === null) {
                    dropped.push('reasoning item with no readable summary or text');
                    break;
                }
                pending.addReasoning(text);
                break;
            }
            default:
                dropped.push(`unsupported input item type '${(item as { type: string }).type}'`);
                break;
        }
    }
    flushPending();
    flushDeferredImages();

    return { messages, dropped };
}

/**
 * Replay a stored response's output items (the `previous_response_id` path)
 * through the same shapes as live input — full `tool_calls` included. This
 * used to emit a bare `toolCallId` with no calls, so a chained run replayed
 * tool history the provider could not see and 400'd on pairing.
 */
export function translateResponsesOutputItems(output: TranslatableOutputItem[]): TranslationResult {
    const messages: UnifiedMessage[] = [];
    const dropped: string[] = [];
    const pending = new PendingAssistantTurn();

    for (const item of output) {
        if (item.type !== 'function_call' && item.type !== 'reasoning' && !pending.empty) {
            const turn = pending.flush();
            if (turn) messages.push(turn);
        }
        switch (item.type) {
            case 'message': {
                const text = (item as { content?: Array<{ text?: string }> }).content?.[0]?.text;
                if (typeof text === 'string') {
                    messages.push({ role: 'assistant', content: text });
                } else {
                    dropped.push('stored message item with no text');
                }
                break;
            }
            case 'function_call': {
                const call = item as { id: string; call_id?: string; name?: string; arguments?: string };
                const callId = call.call_id || call.id;
                if (typeof call.name !== 'string' || typeof call.arguments !== 'string') {
                    dropped.push(`stored function_call item '${callId}' with no name or arguments`);
                    break;
                }
                pending.addCall(callId, call.name, call.arguments);
                break;
            }
            case 'reasoning': {
                const text = extractReasoningText(item as { summary?: unknown });
                if (text === null) {
                    dropped.push('stored reasoning item with no readable summary');
                    break;
                }
                pending.addReasoning(text);
                break;
            }
            default:
                // Built-in tool outputs (web/file search) were already folded
                // into context when the prior response ran; replaying them as
                // turns would duplicate evidence, so they are skipped by
                // design rather than dropped.
                break;
        }
    }
    const trailing = pending.flush();
    if (trailing) messages.push(trailing);

    return { messages, dropped };
}

export type PairingViolation =
    | { kind: 'dangling_call'; id: string; index: number }
    | { kind: 'orphan_result'; id: string; index: number }
    | { kind: 'split_block'; id: string; index: number };

/**
 * Check chat turns for tool-call pairing before any provider sees them.
 *
 * - `dangling_call`: an assistant turn declares a call no later `tool` turn
 *   answers. Upstream this is the 400 "must be followed by tool messages".
 * - `orphan_result`: a `tool` turn answers a call nothing declared.
 * - `split_block`: a non-`tool` turn lands between an assistant `tool_calls`
 *   turn and its last answer. Tolerated by some providers, rejected by
 *   strict ones (DeepSeek) — always a warning, never a block.
 */
export function validateToolPairing(messages: UnifiedMessage[]): PairingViolation[] {
    const violations: PairingViolation[] = [];
    const declaredById = new Map<string, number>();
    const answeredIds = new Set<string>();

    messages.forEach((msg, index) => {
        if (msg.role === 'assistant' && msg.tool_calls?.length) {
            for (const call of msg.tool_calls) {
                if (!declaredById.has(call.id)) declaredById.set(call.id, index);
            }
        }
        if (msg.role === 'tool' && msg.toolCallId) {
            answeredIds.add(msg.toolCallId);
            if (!declaredById.has(msg.toolCallId)) {
                violations.push({ kind: 'orphan_result', id: msg.toolCallId, index });
            }
        }
    });

    for (const [id, index] of declaredById) {
        if (!answeredIds.has(id)) {
            violations.push({ kind: 'dangling_call', id, index });
        }
    }

    // Split blocks: walk each assistant tool_calls turn forward to its last
    // answer; anything but `tool` turns in between is a split.
    for (const [id, declareIndex] of declaredById) {
        let lastAnswer = -1;
        messages.forEach((msg, index) => {
            if (index > declareIndex && msg.role === 'tool' && msg.toolCallId === id) {
                lastAnswer = index;
            }
        });
        if (lastAnswer < 0) continue;
        for (let i = declareIndex + 1; i < lastAnswer; i++) {
            if (messages[i].role !== 'tool') {
                violations.push({ kind: 'split_block', id, index: i });
                break;
            }
        }
    }

    return violations;
}
