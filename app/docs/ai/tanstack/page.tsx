"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function TanStackAIDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    TanStack AI
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Framework-agnostic AI hooks from TanStack. Works with React, Vue, Solid, and Svelte.
                </p>
            </div>

            {/* Installation */}
            <div className="space-y-4">
                <h2 id="install" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Installation
                </h2>

                <CodeBlock code="npm install @tanstack/ai @tanstack/react-form" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Setup */}
            <div className="space-y-4">
                <h2 id="setup" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Setup
                </h2>

                <CodeBlock code={`import { useChat } from '@tanstack/ai';

// Point to Cencori's API
const chat = useChat({
  api: '/api/chat', // Your API route using Cencori
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* React Usage */}
            <div className="space-y-4">
                <h2 id="react" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    React Usage
                </h2>

                <CodeBlock code={`import { useChat } from '@tanstack/ai';

export function ChatComponent() {
  const { messages, input, setInput, sendMessage, isLoading } = useChat({
    api: '/api/chat'
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i} className={msg.role}>
          {msg.content}
        </div>
      ))}
      
      <form onSubmit={(e) => {
        e.preventDefault();
        sendMessage(input);
        setInput('');
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}`} language="tsx">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* API Route */}
            <div className="space-y-4">
                <h2 id="api" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    API Route (with Cencori)
                </h2>

                <CodeBlock code={`// app/api/chat/route.ts
import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = cencori.ai.chatStream({
    model: 'gpt-4o',
    messages
  });

  return new Response(stream.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Framework Support */}
            <div className="space-y-4">
                <h2 id="frameworks" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Framework Support
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Framework</th>
                                <th className="text-left py-2 font-semibold">Package</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">React</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">@tanstack/ai</code></td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Vue</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">@tanstack/ai-vue</code></td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Solid</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">@tanstack/ai-solid</code></td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Svelte</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">@tanstack/ai-svelte</code></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/vercel-sdk">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Vercel AI SDK</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/providers">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Providers</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
