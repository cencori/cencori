import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function ChatAPIPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-20">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Chat API
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Complete reference for the Cencori Chat Completions API. Create AI chat interactions with built-in security, logging, and multi-provider support.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Overview
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Chat API provides a unified interface to interact with multiple AI providers (OpenAI, Anthropic, Google) through a single endpoint. Every request is automatically secured, logged, and monitored.
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Unified Interface:</strong> Same API for all providers (OpenAI, Anthropic, Google)
                    </li>
                    <li className="list-disc">
                        <strong>Automatic Security:</strong> Built-in threat detection and PII filtering
                    </li>
                    <li className="list-disc">
                        <strong>Complete Logging:</strong> Every request and response is logged
                    </li>
                    <li className="list-disc">
                        <strong>Cost Tracking:</strong> Token usage and costs calculated automatically
                    </li>
                </ul>
            </div>

            {/* Basic Usage */}
            <div className="space-y-4">
                <h2 id="basic-usage" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Basic Usage
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Create a chat completion with the Cencori SDK:
                </p>

                <CodeBlock
                    filename="app/api/chat/route.ts"
                    language="typescript"
                    code={`import { cencori } from "@/lib/cencori";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await cencori.chat.completions.create({
    model: "gpt-4",
    messages: messages,
  });

  return Response.json(response);
}`}
                />
            </div>

            {/* Request Parameters */}
            <div className="space-y-4">
                <h2 id="request-parameters" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Request Parameters
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The <code className="text-xs bg-muted px-1.5 py-0.5 rounded">chat.completions.create()</code> method accepts the following parameters:
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">model <span className="text-xs text-muted-foreground font-normal">(required)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            The AI model to use. Supported models include:
                        </p>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc"><strong>OpenAI:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gpt-4</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gpt-4-turbo</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gpt-3.5-turbo</code></li>
                            <li className="list-disc"><strong>Anthropic:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude-3-opus-20240229</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude-3-sonnet-20240229</code></li>
                            <li className="list-disc"><strong>Google:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gemini-pro</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gemini-pro-vision</code></li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">messages <span className="text-xs text-muted-foreground font-normal">(required)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            An array of message objects representing the conversation history. Each message has a <code className="text-xs bg-muted px-1.5 py-0.5 rounded">role</code> and <code className="text-xs bg-muted px-1.5 py-0.5 rounded">content</code>.
                        </p>
                        <CodeBlock
                            filename="messages-example.ts"
                            language="typescript"
                            code={`messages: [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "What is the capital of France?" },
  { role: "assistant", content: "The capital of France is Paris." },
  { role: "user", content: "What is its population?" }
]`}
                        />
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Valid roles: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">system</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">user</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">assistant</code>
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">temperature <span className="text-xs text-muted-foreground font-normal">(optional)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Controls randomness in responses. Range: 0 to 2. Default: 1.
                        </p>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Lower values (0.0-0.3): More focused and deterministic</li>
                            <li className="list-disc">Higher values (1.5-2.0): More creative and random</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">max_tokens <span className="text-xs text-muted-foreground font-normal">(optional)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Maximum number of tokens to generate in the response. Default varies by model.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">top_p <span className="text-xs text-muted-foreground font-normal">(optional)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Nucleus sampling parameter. Range: 0 to 1. Default: 1. Alternative to temperature for controlling randomness.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">stream <span className="text-xs text-muted-foreground font-normal">(optional)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If true, responses will be streamed back as they&apos;re generated. Default: false.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">user <span className="text-xs text-muted-foreground font-normal">(optional)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            A unique identifier for the end-user. Useful for monitoring, rate limiting, and abuse detection.
                        </p>
                    </div>
                </div>
            </div>

            {/* Complete Example */}
            <div className="space-y-4">
                <h2 id="complete-example" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Complete Example
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    A full example with all common parameters:
                </p>

                <CodeBlock
                    filename="app/api/chat/route.ts"
                    language="typescript"
                    code={`import { cencori } from "@/lib/cencori";

export async function POST(req: Request) {
  const { messages, userId } = await req.json();

  try {
    const response = await cencori.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      user: userId, // For per-user rate limiting
    });

    return Response.json({
      content: response.choices[0].message.content,
      usage: response.usage,
      model: response.model,
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    
    return Response.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}`}
                />
            </div>

            {/* Response Format */}
            <div className="space-y-4">
                <h2 id="response-format" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Response Format
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The API returns a structured response object:
                </p>

                <CodeBlock
                    filename="response-example.ts"
                    language="typescript"
                    code={`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 7,
    "total_tokens": 20
  }
}`}
                />

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Response Fields</h3>
                    <ul className="space-y-2 text-sm ml-6">
                        <li className="list-disc">
                            <strong>id:</strong> Unique identifier for this completion
                        </li>
                        <li className="list-disc">
                            <strong>choices:</strong> Array of completion choices (usually contains one item)
                        </li>
                        <li className="list-disc">
                            <strong>choices[].message:</strong> The generated message with role and content
                        </li>
                        <li className="list-disc">
                            <strong>choices[].finish_reason:</strong> Why generation stopped (<code className="text-xs bg-muted px-1.5 py-0.5 rounded">stop</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">length</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">content_filter</code>)
                        </li>
                        <li className="list-disc">
                            <strong>usage:</strong> Token counts for the request and response
                        </li>
                    </ul>
                </div>
            </div>

            {/* Streaming Responses */}
            <div className="space-y-4">
                <h2 id="streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Streaming Responses
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Stream responses in real-time for better user experience:
                </p>

                <CodeBlock
                    filename="streaming-example.ts"
                    language="typescript"
                    code={`import { cencori } from "@/lib/cencori";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await cencori.chat.completions.create({
    model: "gpt-4",
    messages: messages,
    stream: true, // Enable streaming
  });

  // Create a ReadableStream from the response
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        controller.enqueue(encoder.encode(content));
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}`}
                />
            </div>

            {/* Multi-Provider Support */}
            <div className="space-y-4">
                <h2 id="multi-provider" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Multi-Provider Support
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Switch between AI providers by simply changing the model name:
                </p>

                <CodeBlock
                    filename="provider-switching.ts"
                    language="typescript"
                    code={`// OpenAI GPT-4
const openaiResponse = await cencori.chat.completions.create({
  model: "gpt-4",
  messages: messages,
});

// Anthropic Claude
const claudeResponse = await cencori.chat.completions.create({
  model: "claude-3-opus-20240229",
  messages: messages,
});

// Google Gemini
const geminiResponse = await cencori.chat.completions.create({
  model: "gemini-pro",
  messages: messages,
});

// All responses have the same format regardless of provider!`}
                />

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> Make sure you&apos;ve added the respective provider API keys in your Cencori project settings.
                    </p>
                </div>
            </div>

            {/* Error Handling */}
            <div className="space-y-4">
                <h2 id="error-handling" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Error Handling
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Handle various error scenarios gracefully:
                </p>

                <CodeBlock
                    filename="error-handling.ts"
                    language="typescript"
                    code={`import { cencori } from "@/lib/cencori";

async function handleChatRequest(messages: any[]) {
  try {
    const response = await cencori.chat.completions.create({
      model: "gpt-4",
      messages: messages,
    });
    
    return response;
  } catch (error: any) {
    // Security violation (blocked by Cencori - 403)
    if (error.status === 403 && error.code === "SECURITY_VIOLATION") {
      console.error("Request blocked by security");
      return {
        error: "Request blocked",
        message: error.message, // Generic message from Cencori
      };
    }
    
    // Content filtering (response blocked - 403)
    if (error.status === 403 && error.code === "CONTENT_FILTERED") {
      console.error("Response filtered");
      return {
        error: "Response filtered",
        message: error.message,
      };
    }
    
    // Rate limit exceeded (429)
    if (error.status === 429) {
      console.error("Rate limit hit");
      return {
        error: "Too many requests. Please try again later.",
        retryAfter: error.retryAfter,
      };
    }
    
    // Invalid model or provider error (400)
    if (error.status === 400) {
      console.error("Bad request:", error.message);
      return {
        error: "Invalid request parameters.",
      };
    }
    
    // Provider API error (e.g., OpenAI is down - 503)
    if (error.status === 503) {
      console.error("Provider error:", error.message);
      return {
        error: "The AI service is temporarily unavailable.",
      };
    }
    
    // Generic error
    console.error("Unexpected error:", error);
    return {
      error: "An unexpected error occurred.",
    };
  }
}`}
                />

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Security Note:</strong> For security reasons, detailed detection patterns are not included in error responses. See the <Link href="/docs/concepts/security#security-incidents" className="text-primary hover:underline">Security documentation</Link> for comprehensive error handling guide with UI examples.
                    </p>
                </div>
            </div>

            {/* Advanced Features */}
            <div className="space-y-4">
                <h2 id="advanced-features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Advanced Features
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori supports advanced AI features through the same unified interface:
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Function Calling</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Enable the model to call external functions:
                        </p>
                        <CodeBlock
                            filename="function-calling.ts"
                            language="typescript"
                            code={`const response = await cencori.chat.completions.create({
  model: "gpt-4",
  messages: messages,
  functions: [
    {
      name: "get_weather",
      description: "Get the current weather in a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City and state, e.g. San Francisco, CA",
          },
        },
        required: ["location"],
      },
    },
  ],
  function_call: "auto",
});`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">System Prompts</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Set the AI&apos;s behavior with system messages:
                        </p>
                        <CodeBlock
                            filename="system-prompt.ts"
                            language="typescript"
                            code={`const response = await cencori.chat.completions.create({
  model: "gpt-4",
  messages: [
    {
      role: "system",
      content: "You are a helpful assistant specialized in TypeScript. Always provide code examples and best practices."
    },
    {
      role: "user",
      content: "How do I define an interface?"
    }
  ],
});`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">JSON Mode</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Force the model to return valid JSON:
                        </p>
                        <CodeBlock
                            filename="json-mode.ts"
                            language="typescript"
                            code={`const response = await cencori.chat.completions.create({
  model: "gpt-4",
  messages: messages,
  response_format: { type: "json_object" },
});`}
                        />
                    </div>
                </div>
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Follow these recommendations for optimal performance and reliability:
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Set max_tokens:</strong> Prevent unexpectedly long responses and control costs
                    </li>
                    <li className="list-disc">
                        <strong>Include user IDs:</strong> Enable per-user rate limiting and better analytics
                    </li>
                    <li className="list-disc">
                        <strong>Handle errors gracefully:</strong> Implement retry logic for transient failures
                    </li>
                    <li className="list-disc">
                        <strong>Use streaming for chat UIs:</strong> Provide better user experience with progressive responses
                    </li>
                    <li className="list-disc">
                        <strong>Monitor token usage:</strong> Check the dashboard regularly to track costs
                    </li>
                    <li className="list-disc">
                        <strong>Test with different models:</strong> Compare quality and cost across providers
                    </li>
                    <li className="list-disc">
                        <strong>Implement timeouts:</strong> Don&apos;t let requests hang indefinitely
                    </li>
                    <li className="list-disc">
                        <strong>Cache responses when appropriate:</strong> Reduce costs for repeated queries
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/api/auth">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Authentication</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Back to</span>
                            <span className="text-sm font-medium">Introduction</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
