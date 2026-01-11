"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/tanstack/index.ts
var tanstack_exports = {};
__export(tanstack_exports, {
  CENCORI_CHAT_MODELS: () => CENCORI_CHAT_MODELS,
  CencoriTextAdapter: () => CencoriTextAdapter,
  cencori: () => cencori,
  createCencori: () => createCencori
});
module.exports = __toCommonJS(tanstack_exports);
var CENCORI_CHAT_MODELS = [
  // OpenAI
  "gpt-4o",
  "gpt-4o-mini",
  "o1",
  "o1-mini",
  // Anthropic
  "claude-3-5-sonnet",
  "claude-3-opus",
  "claude-3-haiku",
  // Google
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-3-pro",
  // xAI
  "grok-4",
  "grok-3",
  // Mistral
  "mistral-large",
  "codestral",
  // DeepSeek
  "deepseek-v3.2",
  "deepseek-reasoner",
  // Groq
  "llama-3-70b",
  "mixtral-8x7b"
];
var CencoriTextAdapter = class {
  constructor(model, options = {}) {
    this.kind = "text";
    this.name = "cencori";
    this["~types"] = {};
    this.model = model;
    this.providerOptions = options;
    const apiKey = options.apiKey ?? process.env.CENCORI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Cencori API key is required. Pass it via options.apiKey or set CENCORI_API_KEY environment variable."
      );
    }
    this.config = {
      apiKey,
      baseUrl: options.baseUrl ?? "https://cencori.com",
      headers: options.headers
    };
  }
  /**
   * Stream chat completions from the model
   */
  async *chatStream(options) {
    const response = await fetch(`${this.config.baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CENCORI_API_KEY": this.config.apiKey,
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: true,
        userId: options.modelOptions?.userId
      }),
      signal: options.abortController?.signal
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      const errorChunk = {
        type: "error",
        id: this.generateId(),
        model: this.model,
        timestamp: Date.now(),
        error: {
          message: errorData.error || response.statusText,
          code: String(response.status)
        }
      };
      yield errorChunk;
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is null");
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let promptTokens = 0;
    let completionTokens = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const doneChunk = {
            type: "done",
            id: this.generateId(),
            model: this.model,
            timestamp: Date.now(),
            finishReason: "stop",
            usage: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens
            }
          };
          yield doneChunk;
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            const doneChunk = {
              type: "done",
              id: this.generateId(),
              model: this.model,
              timestamp: Date.now(),
              finishReason: "stop",
              usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens
              }
            };
            yield doneChunk;
            return;
          }
          try {
            const chunk = JSON.parse(data);
            if (chunk.delta) {
              content += chunk.delta;
              completionTokens += Math.ceil(chunk.delta.length / 4);
              const contentChunk = {
                type: "content",
                id: this.generateId(),
                model: this.model,
                timestamp: Date.now(),
                delta: chunk.delta,
                content,
                role: "assistant"
              };
              yield contentChunk;
            }
            if (chunk.finish_reason) {
              const doneChunk = {
                type: "done",
                id: this.generateId(),
                model: this.model,
                timestamp: Date.now(),
                finishReason: chunk.finish_reason === "stop" ? "stop" : null,
                usage: {
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens
                }
              };
              yield doneChunk;
              return;
            }
          } catch {
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  /**
   * Generate structured output
   */
  async structuredOutput(options) {
    const response = await fetch(`${this.config.baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CENCORI_API_KEY": this.config.apiKey,
        ...this.config.headers
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.chatOptions.messages,
        temperature: options.chatOptions.temperature,
        maxTokens: options.chatOptions.maxTokens,
        stream: false,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "structured_output",
            schema: options.outputSchema,
            strict: true
          }
        }
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
    }
    const result = await response.json();
    const rawText = result.content;
    try {
      const data = JSON.parse(rawText);
      return { data, rawText };
    } catch {
      throw new Error(`Failed to parse structured output: ${rawText}`);
    }
  }
  generateId() {
    return `cencori-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};
function createCencori(options = {}) {
  return function cencoriProvider(model) {
    return new CencoriTextAdapter(model, options);
  };
}
function cencori(model) {
  return new CencoriTextAdapter(model, {});
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CENCORI_CHAT_MODELS,
  CencoriTextAdapter,
  cencori,
  createCencori
});
//# sourceMappingURL=index.js.map