"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function StreamingDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Streaming
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Stream AI responses in real-time for better UX. Works with all chat models.
                </p>
            </div>

            {/* SDK Streaming */}
            <div className="space-y-4">
                <h2 id="sdk" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Cencori SDK
                </h2>

                <CodeBlock code={`import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: 'csk_...' });

const stream = cencori.ai.chatStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Vercel AI SDK */}
            <div className="space-y-4">
                <h2 id="vercel" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Vercel AI SDK
                </h2>

                <CodeBlock code={`import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const cencori = createOpenAI({
  apiKey: process.env.CENCORI_API_KEY,
  baseURL: 'https://gateway.cencori.com/api/ai'
});

const result = await streamText({
  model: cencori('gpt-4o'),
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const text of result.textStream) {
  process.stdout.write(text);
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* React Streaming */}
            <div className="space-y-4">
                <h2 id="react" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    React Streaming
                </h2>

                <CodeBlock code={`'use client';
import { useState } from 'react';

export default function StreamingChat() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (prompt: string) => {
    setIsLoading(true);
    setContent('');

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: prompt })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      setContent(prev => prev + decoder.decode(value));
    }

    setIsLoading(false);
  };

  return <div>{content}</div>;
}`} language="tsx">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* API Route */}
            <div className="space-y-4">
                <h2 id="api" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    API Route
                </h2>

                <CodeBlock code={`// app/api/chat/route.ts
import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

export async function POST(req: Request) {
  const { message } = await req.json();

  const stream = cencori.ai.chatStream({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: message }]
  });

  return new Response(stream.toReadableStream(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  });
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Supported Models */}
            <div className="space-y-4">
                <h2 id="models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Models
                </h2>
                <p className="text-sm text-muted-foreground">
                    All chat models support streaming:
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    <li className="list-disc">OpenAI: gpt-5, gpt-4o, gpt-4o-mini, o3, o1</li>
                    <li className="list-disc">Anthropic: claude-opus-4, claude-sonnet-4, claude-3-5-sonnet</li>
                    <li className="list-disc">Google: gemini-3-pro, gemini-2.5-flash</li>
                    <li className="list-disc">xAI: grok-4, grok-4.1</li>
                    <li className="list-disc">Mistral: mistral-large-3, codestral</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/failover">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Failover</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/tool-calling">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Tool Calling</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
