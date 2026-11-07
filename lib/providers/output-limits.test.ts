import { describe, expect, it } from "vitest";
import { defaultClaudeMaxTokens, defaultGeminiMaxTokens } from "./output-limits";

describe("defaultClaudeMaxTokens", () => {
    it("gives current Claude models room to write a whole file", () => {
        expect(defaultClaudeMaxTokens("claude-opus-5-5", true)).toBe(32_000);
        expect(defaultClaudeMaxTokens("claude-sonnet-5-5", false)).toBe(16_000);
        expect(defaultClaudeMaxTokens("claude-haiku-4-5", true)).toBe(32_000);
    });

    it("stays within the published limit of older Claude models", () => {
        expect(defaultClaudeMaxTokens("claude-3-5-sonnet-20241022", true)).toBe(8_192);
        expect(defaultClaudeMaxTokens("claude-3-haiku-20240307", true)).toBe(4_096);
        expect(defaultClaudeMaxTokens("claude-3-opus-20240229", false)).toBe(4_096);
    });
});

describe("defaultGeminiMaxTokens", () => {
    it("allows long replies on Gemini 2.5 and later", () => {
        expect(defaultGeminiMaxTokens("gemini-2.5-pro")).toBe(32_000);
        expect(defaultGeminiMaxTokens("gemini-3-flash")).toBe(32_000);
    });

    it("stays within 8,192 on older Gemini and on Gemma", () => {
        expect(defaultGeminiMaxTokens("gemini-2.0-flash")).toBe(8_192);
        expect(defaultGeminiMaxTokens("gemini-1.5-pro")).toBe(8_192);
        expect(defaultGeminiMaxTokens("gemma-4-31b-it")).toBe(8_192);
    });
});
