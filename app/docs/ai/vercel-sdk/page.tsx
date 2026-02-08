"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function VercelAISDKDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Vercel AI SDK
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Use Cencori with the Vercel AI SDK for streaming, React hooks, and structured output.
                </p>
            </div>

            {/* Installation */}
            <div className="space-y-4">
                <h2 id="install" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Installation
                </h2>

                <CodeBlock code="npm install ai @ai-sdk/openai" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Provider Setup */}
            <div className="space-y-4">
                <h2 id="provider" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Provider Setup
                </h2>
                <p className="text-sm text-muted-foreground">
                    Point the OpenAI provider to Cencori&apos;s gateway:
                </p>

                <CodeBlock code={`import { createOpenAI } from '@ai-sdk/openai';

const cencori = createOpenAI({
  apiKey: process.env.CENCORI_API_KEY,
  baseURL: 'https://gateway.cencori.com/api/ai'
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* streamText */}
            <div className="space-y-4">
                <h2 id="stream-text" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    streamText
                </h2>

                <CodeBlock code={`import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const cencori = createOpenAI({
  apiKey: process.env.CENCORI_API_KEY,
  baseURL: 'https://gateway.cencori.com/api/ai'
});

const result = await streamText({
  model: cencori('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }]
});

for await (const text of result.textStream) {
  process.stdout.write(text);
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* useChat */}
            <div className="space-y-4">
                <h2 id="use-chat" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    useChat (React)
                </h2>

                <CodeBlock code={`'use client';
import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat'
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}`} language="tsx">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Structured Output */}
            <div className="space-y-4">
                <h2 id="structured" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Structured Output
                </h2>

                <CodeBlock code={`import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: cencori('gpt-4o'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.string()),
      steps: z.array(z.string())
    })
  }),
  prompt: 'Generate a pasta recipe'
});

console.log(object.recipe.name);`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Tool Calling */}
            <div className="space-y-4">
                <h2 id="tools" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Tool Calling
                </h2>

                <CodeBlock code={`import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: cencori('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get weather for a city',
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => {
        return { temp: 72, conditions: 'sunny' };
      }
    })
  },
  prompt: 'What is the weather in Tokyo?'
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/sdk">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Cencori SDK</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/tanstack">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">TanStack AI</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
