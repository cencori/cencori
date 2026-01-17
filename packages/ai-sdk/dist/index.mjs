// src/ai/index.ts
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

// src/compute/index.ts
var ComputeNamespace = class {
  /**
   * Run a serverless function
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async run(functionId, options) {
    throw new Error(
      `cencori.compute.run() is coming soon! Function "${functionId}" cannot be executed yet. Join our waitlist at https://cencori.com/compute`
    );
  }
  /**
   * Deploy a function
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async deploy(config) {
    throw new Error(
      `cencori.compute.deploy() is coming soon! Join our waitlist at https://cencori.com/compute`
    );
  }
  /**
   * List deployed functions
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async list() {
    throw new Error(
      `cencori.compute.list() is coming soon! Join our waitlist at https://cencori.com/compute`
    );
  }
};

// src/workflow/index.ts
var WorkflowNamespace = class {
  /**
   * Trigger a workflow
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async trigger(workflowId, options) {
    throw new Error(
      `cencori.workflow.trigger() is coming soon! Workflow "${workflowId}" cannot be triggered yet. Join our waitlist at https://cencori.com/workflow`
    );
  }
  /**
   * Create a new workflow
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async create(config) {
    throw new Error(
      `cencori.workflow.create() is coming soon! Join our waitlist at https://cencori.com/workflow`
    );
  }
  /**
   * Get workflow run status
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async status(runId) {
    throw new Error(
      `cencori.workflow.status() is coming soon! Join our waitlist at https://cencori.com/workflow`
    );
  }
  /**
   * List workflows
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async list() {
    throw new Error(
      `cencori.workflow.list() is coming soon! Join our waitlist at https://cencori.com/workflow`
    );
  }
};

// src/storage/index.ts
var VectorsNamespace = class {
  /**
   * Search vectors by query
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async search(query, options) {
    throw new Error(
      `cencori.storage.vectors.search() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Upsert vectors
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async upsert(vectors) {
    throw new Error(
      `cencori.storage.vectors.upsert() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Delete vectors by ID
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async delete(ids) {
    throw new Error(
      `cencori.storage.vectors.delete() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
};
var KnowledgeNamespace = class {
  /**
   * Query the knowledge base
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async query(question) {
    throw new Error(
      `cencori.storage.knowledge.query() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Add documents to knowledge base
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async add(documents) {
    throw new Error(
      `cencori.storage.knowledge.add() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
};
var FilesNamespace = class {
  /**
   * Upload a file
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async upload(file, name) {
    throw new Error(
      `cencori.storage.files.upload() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
  /**
   * Process a file (extract text, OCR, etc.)
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async process(fileId) {
    throw new Error(
      `cencori.storage.files.process() is coming soon! Join our waitlist at https://cencori.com/storage`
    );
  }
};
var StorageNamespace = class {
  constructor() {
    /**
     * Vector database operations
     */
    this.vectors = new VectorsNamespace();
    /**
     * Knowledge base operations (RAG)
     */
    this.knowledge = new KnowledgeNamespace();
    /**
     * File storage and processing
     */
    this.files = new FilesNamespace();
  }
};

// src/cencori.ts
var DEFAULT_BASE_URL = "https://cencori.com";
var Cencori = class {
  /**
   * Create a new Cencori client
   * 
   * @param config - Configuration options
   * @param config.apiKey - Your Cencori API key (starts with 'csk_')
   * @param config.baseUrl - Custom API base URL (default: https://cencori.com)
   * @param config.headers - Custom headers to include in requests
   * 
   * @example
   * const cencori = new Cencori({ 
   *   apiKey: process.env.CENCORI_API_KEY 
   * });
   */
  constructor(config = {}) {
    const apiKey = config.apiKey ?? process.env.CENCORI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Cencori API key is required. Pass it via new Cencori({ apiKey: "csk_..." }) or set CENCORI_API_KEY environment variable.'
      );
    }
    this.config = {
      apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      headers: config.headers ?? {}
    };
    this.ai = new AINamespace(this.config);
    this.compute = new ComputeNamespace();
    this.workflow = new WorkflowNamespace();
    this.storage = new StorageNamespace();
  }
  /**
   * Get the current configuration (API key is masked)
   */
  getConfig() {
    return {
      baseUrl: this.config.baseUrl,
      apiKeyHint: `${this.config.apiKey.slice(0, 6)}...${this.config.apiKey.slice(-4)}`
    };
  }
};

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
  /**
   * Convert Vercel AI SDK tools to Cencori format
   */
  convertTools(options) {
    if (!options.tools || options.tools.length === 0) {
      return void 0;
    }
    return options.tools.filter((t) => t.type === "function").map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description || "",
        parameters: t.inputSchema
      }
    }));
  }
  /**
   * Convert Vercel AI SDK tool choice to Cencori format
   */
  convertToolChoice(options) {
    const tc = options.toolChoice;
    if (!tc) return void 0;
    switch (tc.type) {
      case "auto":
        return "auto";
      case "none":
        return "none";
      case "required":
        return "required";
      case "tool":
        return { type: "function", function: { name: tc.toolName } };
      default:
        return void 0;
    }
  }
  async doGenerate(options) {
    const messages = this.convertMessages(options);
    const tools = this.convertTools(options);
    const toolChoice = this.convertToolChoice(options);
    const response = await fetch(`${this.settings.baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        model: this.modelId,
        temperature: options.temperature,
        maxTokens: options.maxOutputTokens,
        stream: false,
        userId: this.settings.userId,
        tools,
        toolChoice
      }),
      signal: options.abortSignal
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Cencori API error: ${error.error || response.statusText}`);
    }
    const data = await response.json();
    const content = [];
    if (data.content) {
      content.push({
        type: "text",
        text: data.content,
        providerMetadata: void 0
      });
    }
    if (data.tool_calls && data.tool_calls.length > 0) {
      for (const tc of data.tool_calls) {
        content.push({
          type: "tool-call",
          toolCallId: tc.id,
          toolName: tc.function.name,
          input: tc.function.arguments,
          providerMetadata: void 0
        });
      }
    }
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
    const tools = this.convertTools(options);
    const toolChoice = this.convertToolChoice(options);
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
        userId: this.settings.userId,
        tools,
        toolChoice
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
              if (chunk.tool_calls && chunk.tool_calls.length > 0) {
                for (const tc of chunk.tool_calls) {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: tc.id,
                    toolName: tc.function.name,
                    input: tc.function.arguments,
                    providerMetadata: void 0
                  });
                }
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
export {
  AINamespace,
  Cencori,
  ComputeNamespace,
  StorageNamespace,
  WorkflowNamespace,
  cencori,
  createCencori,
  Cencori as default
};
//# sourceMappingURL=index.mjs.map