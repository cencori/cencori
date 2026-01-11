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
var src_exports = {};
__export(src_exports, {
  CencoriChatLanguageModel: () => CencoriChatLanguageModel,
  cencori: () => cencori,
  createCencori: () => createCencori
});
module.exports = __toCommonJS(src_exports);

// src/vercel/cencori-chat-model.ts
var CencoriChatLanguageModel = class {
  constructor(modelId, settings) {
    this.specificationVersion = "v3";
    this.provider = "cencori";
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
    const promptMessages = options.prompt;
    if (!promptMessages || !Array.isArray(promptMessages)) {
      return messages;
    }
    for (const msg of promptMessages) {
      let content = "";
      if (msg.role === "system") {
        content = msg.content;
      } else if (msg.role === "user" || msg.role === "assistant") {
        const msgContent = msg.content;
        if (Array.isArray(msgContent)) {
          content = msgContent.filter((part) => part.type === "text").map((part) => part.text || "").join("");
        } else if (typeof msgContent === "string") {
          content = msgContent;
        }
      }
      if (content && (msg.role === "system" || msg.role === "user" || msg.role === "assistant")) {
        messages.push({
          role: msg.role,
          content
        });
      }
    }
    return messages;
  }
  mapFinishReason(reason) {
    let unified;
    switch (reason) {
      case "stop":
      case "end_turn":
        unified = "stop";
        break;
      case "length":
      case "max_tokens":
        unified = "length";
        break;
      case "content_filter":
        unified = "content-filter";
        break;
      case "tool_calls":
      case "tool-calls":
        unified = "tool-calls";
        break;
      case "error":
        unified = "error";
        break;
      default:
        unified = "stop";
    }
    return { unified, raw: reason };
  }
  buildUsage(inputTokens, outputTokens) {
    return {
      inputTokens: {
        total: inputTokens,
        noCache: inputTokens,
        cacheRead: void 0,
        cacheWrite: void 0
      },
      outputTokens: {
        total: outputTokens,
        text: outputTokens,
        reasoning: void 0
      }
    };
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
      text: data.content,
      providerMetadata: void 0
    }];
    const warnings = [];
    return {
      content,
      finishReason: this.mapFinishReason(data.finish_reason),
      usage: this.buildUsage(data.usage.prompt_tokens, data.usage.completion_tokens),
      warnings
    };
  }
  async doStream(options) {
    const messages = this.convertMessages(options);
    const self = this;
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
    const textPartId = "text-0";
    let started = false;
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            if (started) {
              controller.enqueue({
                type: "text-end",
                id: textPartId
              });
            }
            controller.enqueue({
              type: "finish",
              finishReason: self.mapFinishReason("stop"),
              usage: self.buildUsage(inputTokens, outputTokens)
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
              if (started) {
                controller.enqueue({
                  type: "text-end",
                  id: textPartId
                });
              }
              controller.enqueue({
                type: "finish",
                finishReason: self.mapFinishReason("stop"),
                usage: self.buildUsage(inputTokens, outputTokens)
              });
              controller.close();
              return;
            }
            try {
              const chunk = JSON.parse(data);
              if (chunk.delta) {
                if (!started) {
                  started = true;
                  controller.enqueue({
                    type: "text-start",
                    id: textPartId
                  });
                }
                outputTokens += Math.ceil(chunk.delta.length / 4);
                controller.enqueue({
                  type: "text-delta",
                  id: textPartId,
                  delta: chunk.delta
                });
              }
              if (chunk.finish_reason) {
                if (started) {
                  controller.enqueue({
                    type: "text-end",
                    id: textPartId
                  });
                }
                controller.enqueue({
                  type: "finish",
                  finishReason: self.mapFinishReason(chunk.finish_reason),
                  usage: self.buildUsage(inputTokens, outputTokens)
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
      stream
    };
  }
};

// src/vercel/cencori-provider.ts
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