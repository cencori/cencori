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

// src/ai/index.ts
var ai_exports = {};
__export(ai_exports, {
  AINamespace: () => AINamespace
});
module.exports = __toCommonJS(ai_exports);
var AINamespace = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * Create a chat completion
   * 
   * @example
   * const response = await cencori.ai.chat({
   *   model: 'gpt-4o',
   *   messages: [{ role: 'user', content: 'Hello!' }]
   * });
   */
  async chat(request) {
    const response = await fetch(`${this.config.baseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        ...this.config.headers
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: request.stream ?? false
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
    }
    const data = await response.json();
    return {
      id: data.id,
      model: data.model,
      content: data.choices?.[0]?.message?.content ?? "",
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0
      }
    };
  }
  /**
   * Create a text completion
   * 
   * @example
   * const response = await cencori.ai.completions({
   *   model: 'gpt-4o',
   *   prompt: 'Write a haiku about coding'
   * });
   */
  async completions(request) {
    return this.chat({
      model: request.model,
      messages: [{ role: "user", content: request.prompt }],
      temperature: request.temperature,
      maxTokens: request.maxTokens
    });
  }
  /**
   * Create embeddings
   * 
   * @example
   * const response = await cencori.ai.embeddings({
   *   model: 'text-embedding-3-small',
   *   input: 'Hello world'
   * });
   */
  async embeddings(request) {
    const response = await fetch(`${this.config.baseUrl}/api/v1/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        ...this.config.headers
      },
      body: JSON.stringify({
        model: request.model,
        input: request.input
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Cencori API error: ${errorData.error || response.statusText}`);
    }
    const data = await response.json();
    return {
      model: data.model,
      embeddings: data.data?.map((d) => d.embedding) ?? [],
      usage: {
        totalTokens: data.usage?.total_tokens ?? 0
      }
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AINamespace
});
//# sourceMappingURL=index.js.map