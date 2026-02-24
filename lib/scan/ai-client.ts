/**
 * Shared AI client with Cerebras → Groq → Gemini fallback chain.
 *
 * Both Cerebras and Groq expose an OpenAI-compatible REST API, so
 * we call them directly with fetch — no extra SDK needed.
 */

const TIMEOUT_MS = 35_000;

export type AiProvider = "cerebras" | "groq" | "gemini";

interface ProviderConfig {
    name: AiProvider;
    baseURL: string;
    model: string;
    apiKey: string | undefined;
}

function getProviders(): ProviderConfig[] {
    return [
        {
            name: "cerebras",
            baseURL: "https://api.cerebras.ai/v1",
            model: "qwen-3-235b-a22b",
            apiKey: process.env.CEREBRAS_API_KEY,
        },
        {
            name: "groq",
            baseURL: "https://api.groq.com/openai/v1",
            model: "deepseek-r1-distill-llama-70b",
            apiKey: process.env.GROQ_API_KEY,
        },
    ];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms)
        ),
    ]);
}

/**
 * Call a single OpenAI-compatible provider (non-streaming).
 */
async function callOpenAICompatible(
    config: ProviderConfig,
    prompt: string,
): Promise<string | null> {
    if (!config.apiKey) return null;

    const res = await withTimeout(
        fetch(`${config.baseURL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0,
            }),
        }),
        TIMEOUT_MS
    );

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${config.name} HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
}

/**
 * Try each provider in order. Falls back to Gemini if all OpenAI-compatible
 * providers fail.
 */
export async function generateWithFallback(prompt: string): Promise<{
    model: string;
    provider: AiProvider | "gemini";
    text: string;
} | null> {
    for (const provider of getProviders()) {
        if (!provider.apiKey) {
            console.log(`[AI Client] Skipping ${provider.name} — no API key`);
            continue;
        }
        try {
            console.log(`[AI Client] Trying ${provider.name} (${provider.model})...`);
            const text = await callOpenAICompatible(provider, prompt);
            if (text) {
                console.log(`[AI Client] ✓ ${provider.name} responded`);
                return { model: provider.model, provider: provider.name, text };
            }
        } catch (err) {
            console.warn(`[AI Client] ${provider.name} failed:`, err instanceof Error ? err.message : err);
        }
    }

    // Gemini fallback
    const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
        try {
            console.log("[AI Client] Falling back to Gemini...");
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await withTimeout(model.generateContent(prompt), TIMEOUT_MS);
            const text = result.response.text().trim();
            if (text) {
                console.log("[AI Client] ✓ Gemini responded");
                return { model: "gemini-2.5-flash", provider: "gemini", text };
            }
        } catch (err) {
            console.warn("[AI Client] Gemini fallback failed:", err instanceof Error ? err.message : err);
        }
    }

    console.error("[AI Client] All providers exhausted — no AI response");
    return null;
}

/**
 * Stream from Cerebras → Groq → Gemini, writing SSE chunks to the
 * provided ReadableStream controller.
 *
 * Chunks are emitted as: data: {"content":"..."}\n\n
 * Completion is signaled with: data: [DONE]\n\n
 */
export async function streamWithFallback(
    prompt: string,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
): Promise<void> {
    const enqueue = (payload: string) =>
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

    for (const p of getProviders()) {
        if (!p.apiKey) continue;
        try {
            console.log(`[AI Client] Streaming from ${p.name}...`);
            const res = await withTimeout(
                fetch(`${p.baseURL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${p.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: p.model,
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.3,
                        stream: true,
                    }),
                }),
                TIMEOUT_MS
            );

            if (!res.ok || !res.body) {
                const body = await res.text().catch(() => "");
                throw new Error(`${p.name} HTTP ${res.status}: ${body.slice(0, 200)}`);
            }

            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buffer = "";
            let gotContent = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += dec.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.replace(/^data:\s*/, "").trim();
                    if (!trimmed || trimmed === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(trimmed) as {
                            choices?: Array<{ delta?: { content?: string } }>;
                        };
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            enqueue(JSON.stringify({ content }));
                            gotContent = true;
                        }
                    } catch {
                        // skip malformed chunk
                    }
                }
            }

            if (gotContent) {
                console.log(`[AI Client] ✓ ${p.name} stream complete`);
                enqueue("[DONE]");
                controller.close();
                return;
            }
        } catch (err) {
            console.warn(`[AI Client] ${p.name} stream failed:`, err instanceof Error ? err.message : err);
        }
    }

    // Gemini streaming fallback
    const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
        try {
            console.log("[AI Client] Streaming from Gemini fallback...");
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) enqueue(JSON.stringify({ content: text }));
            }

            enqueue("[DONE]");
            controller.close();
            return;
        } catch (err) {
            console.warn("[AI Client] Gemini stream failed:", err instanceof Error ? err.message : err);
        }
    }

    // Total failure — close cleanly without content
    enqueue("[DONE]");
    controller.close();
}
