/**
 * How many output tokens to allow when the caller does not say.
 *
 * Agent runtimes (Tensor's desktop agent among them) send no output limit, so this default is the
 * real ceiling on every call they make. It used to be 4,096 for Claude and 2,048 for Gemini, which
 * cut off any tool call that writes a file of more than a page or two: the arguments arrived as
 * truncated JSON, the agent saw "missing field `cmd`", tried the same thing again, and spent the
 * task's budget on output that could never parse.
 *
 * The defaults below sit at or under what each model family accepts, so a request never fails for
 * asking too much. A caller that passes its own limit is always honoured.
 */

/** Non-streaming calls hold a connection open for the whole reply, so they get a smaller ceiling. */
const CLAUDE_NON_STREAMING_DEFAULT = 16_000;
const CLAUDE_STREAMING_DEFAULT = 32_000;

/** Claude 3 / 3.5 models reject anything above their published output limit. */
function legacyClaudeLimit(model: string): number | null {
    if (/^claude-3-5-/.test(model) || /^claude-3\.5-/.test(model)) return 8_192;
    if (/^claude-3-(haiku|sonnet|opus)/.test(model)) return 4_096;
    return null;
}

export function defaultClaudeMaxTokens(model: string, streaming: boolean): number {
    const legacy = legacyClaudeLimit(model);
    if (legacy !== null) return legacy;
    return streaming ? CLAUDE_STREAMING_DEFAULT : CLAUDE_NON_STREAMING_DEFAULT;
}

/** Gemini 1.x / 2.0 and Gemma top out at 8,192 output tokens; 2.5 and later take 65,536. */
export function defaultGeminiMaxTokens(model: string): number {
    if (/^gemini-(1\.|2\.0)/.test(model) || /^gemma-/.test(model)) return 8_192;
    return 32_000;
}
