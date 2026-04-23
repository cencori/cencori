import {
  generateHealthSummary,
  buildHealthPrompt,
  _resetCacheForTesting,
} from "@/lib/health-summary";
import { describe, expect, test, beforeEach, vi } from "vitest";

// ✅ Mock the correct function (NO default, NO generateContent)
vi.mock("@/lib/gemini", () => ({
  sendChatRequest: vi.fn(),
}));

// ✅ Import AFTER mocking
import { sendChatRequest } from "@/lib/gemini";

// ✅ Properly typed mock
const mockGemini = vi.mocked(sendChatRequest);

// Sample health data used across tests
const healthyData = {
  status: "healthy" as const,
  services: {
    database: { status: "healthy" as const, latencyMs: 12 },
    aiGateway: { status: "healthy" as const, latencyMs: 45 },
    memory: { status: "healthy" as const, latencyMs: 23 },
  },
};

describe("buildHealthPrompt", () => {
  test("includes all three service names in the prompt", () => {
    const prompt = buildHealthPrompt(healthyData);
    expect(prompt).toContain("Database");
    expect(prompt).toContain("AI Gateway");
    expect(prompt).toContain("Memory");
  });

  test("includes latency values in the prompt", () => {
    const prompt = buildHealthPrompt(healthyData);
    expect(prompt).toContain("12ms");
    expect(prompt).toContain("45ms");
    expect(prompt).toContain("23ms");
  });

  test("includes overall status in the prompt", () => {
    const prompt = buildHealthPrompt(healthyData);
    expect(prompt).toContain("healthy");
  });
});

describe("generateHealthSummary", () => {
  beforeEach(() => {
    _resetCacheForTesting();
    mockGemini.mockReset();
  });

  test("returns AI summary on success", async () => {
    mockGemini.mockResolvedValueOnce({
      text: "All services are running smoothly.",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
      costUsd: 0,
      latencyMs: 100,
    });

    const result = await generateHealthSummary(healthyData);

    expect(result).toBe("All services are running smoothly.");
    expect(mockGemini).toHaveBeenCalledTimes(1);
  });

  test("returns fallback string when Gemini throws", async () => {
    mockGemini.mockRejectedValueOnce(new Error("Network error"));

    const result = await generateHealthSummary(healthyData);

    expect(result).toBe("All systems operational.");
  });

  test("returns fallback when Gemini returns empty text", async () => {
    mockGemini.mockResolvedValueOnce({
      text: "",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMs: 0,
    });

    const result = await generateHealthSummary(healthyData);

    expect(result).toBe("All systems operational.");
  });

  test("uses cached result on second call", async () => {
    mockGemini.mockResolvedValue({
      text: "Cached summary.",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
      costUsd: 0,
      latencyMs: 100,
    });

    await generateHealthSummary(healthyData);
    await generateHealthSummary(healthyData);

    expect(mockGemini).toHaveBeenCalledTimes(1);
  });
});
