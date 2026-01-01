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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CencoriChatLanguageModel: () => CencoriChatLanguageModel,
  cencori: () => cencori,
  createCencori: () => createCencori
});
module.exports = __toCommonJS(index_exports);

// src/cencori-chat-model.ts
var CencoriChatLanguageModel = class {
  constructor(modelId, settings) {
    this.specificationVersion = "v2";
    this.provider = "cencori";
    this.defaultObjectGenerationMode = "json";
    this.supportsImageUrls = false;
    this.supportedUrls = {};
    this.modelId = modelId;
    this.settings = settings;
  }
  getHeaders() {
    return {
      "Content-Type": "application/json",
      "CENCORI_API_KEY": this.settings.apiKey,
      ...this.settings.headers
    };
  }
  convertMessages(options) {
    const messages = [];
    if (options.prompt && typeof options.prompt === "object" && "system" in options.prompt && options.prompt.system) {
      messages.push({ role: "system", content: options.prompt.system });
    }
    if (options.prompt && typeof options.prompt === "object" && "messages" in options.prompt) {
      const promptMessages = options.prompt.messages;
      for (const msg of promptMessages) {
        let content = "";
        if (typeof msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content.filter((part) => part.type === "text").map((part) => part.text || "").join("");
        }
        if (content) {
          messages.push({
            role: msg.role,
            content
          });
        }
      }
    }
    return messages;
  }
  mapFinishReason(reason) {
    switch (reason) {
      case "stop":
      case "end_turn":
        return "stop";
      case "length":
      case "max_tokens":
        return "length";
      case "content_filter":
        return "content-filter";
      case "tool_calls":
      case "tool-calls":
        return "tool-calls";
      default:
        return "stop";
    }
  }
  async doGenerate(options) {
    const messages = this.convertMessages(options);
    const response = await fetch(`${this.settings.baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        model: this.modelId,
        temperature: options.temperature,
        maxTokens: options.maxOutputTokens,
        stream: false,
        userId: this.settings.userId
      }),
      signal: options.abortSignal
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Cencori API error: ${error.error || response.statusText}`);
    }
    const data = await response.json();
    const content = [{
      type: "text",
      text: data.content
    }];
    return {
      content,
      finishReason: this.mapFinishReason(data.finish_reason),
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      },
      rawCall: {
        rawPrompt: messages,
        rawSettings: {
          model: this.modelId,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens
        }
      },
      warnings: []
    };
  }
  async doStream(options) {
    const messages = this.convertMessages(options);
    const response = await fetch(`${this.settings.baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        model: this.modelId,
        temperature: options.temperature,
        maxTokens: options.maxOutputTokens,
        stream: true,
        userId: this.settings.userId
      }),
      signal: options.abortSignal
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Cencori API error: ${error.error || response.statusText}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is null");
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let textPartId = "text-0";
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
            });
            controller.close();
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
              controller.enqueue({
                type: "finish",
                finishReason: "stop",
                usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
              });
              controller.close();
              return;
            }
            try {
              const chunk = JSON.parse(data);
              if (chunk.delta) {
                outputTokens += Math.ceil(chunk.delta.length / 4);
                controller.enqueue({
                  type: "text-delta",
                  id: textPartId,
                  delta: chunk.delta
                });
              }
              if (chunk.finish_reason) {
                controller.enqueue({
                  type: "finish",
                  finishReason: "stop",
                  usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
                });
                controller.close();
                return;
              }
            } catch {
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        reader.cancel();
      }
    });
    return {
      stream,
      rawCall: {
        rawPrompt: messages,
        rawSettings: {
          model: this.modelId,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens
        }
      },
      warnings: []
    };
  }
};

// src/cencori-provider.ts
function createCencori(options = {}) {
  const baseUrl = options.baseUrl ?? "https://cencori.com";
  const apiKey = options.apiKey ?? process.env.CENCORI_API_KEY;
  if (!apiKey) {
    throw new Error("Cencori API key is required. Pass it via options.apiKey or set CENCORI_API_KEY environment variable.");
  }
  const createModel = (modelId, settings = {}) => {
    return new CencoriChatLanguageModel(modelId, {
      apiKey,
      baseUrl,
      headers: options.headers,
      ...settings
    });
  };
  const provider = function(modelId, settings) {
    return createModel(modelId, settings);
  };
  provider.chat = createModel;
  return provider;
}
var cencori = function(modelId, settings) {
  const apiKey = process.env.CENCORI_API_KEY;
  if (!apiKey) {
    throw new Error('CENCORI_API_KEY environment variable is required. Set it or use createCencori({ apiKey: "..." }) instead.');
  }
  return new CencoriChatLanguageModel(modelId, {
    apiKey,
    baseUrl: "https://cencori.com",
    ...settings
  });
};
cencori.chat = cencori;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CencoriChatLanguageModel,
  cencori,
  createCencori
});
//# sourceMappingURL=index.js.map