import { CodeBlock } from "@/components/docs/CodeBlock";

export default function Step7Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Enable Streaming
                </h1>
                <p className="text-muted-foreground">
                    Streaming gives your users a better experience by showing AI responses as they&apos;re generated, token by token.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Why Streaming?</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                        <span className="text-primary">⚡</span>
                        Users see output immediately instead of waiting
                    </li>
                    <li className="flex gap-2">
                        <span className="text-primary">⚡</span>
                        Feels more interactive and responsive
                    </li>
                    <li className="flex gap-2">
                        <span className="text-primary">⚡</span>
                        Works with all providers (OpenAI, Anthropic, Gemini)
                    </li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Streaming with the SDK</h2>
                <CodeBlock
                    language="typescript"
                    filename="streaming.ts"
                    code={`import { Cencori } from 'cencori';

const cencori = new Cencori();

const stream = cencori.ai.chatStream({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Write a short poem about coding' }
  ],
});

// Iterate over the stream
for await (const chunk of stream) {
  // Print each token as it arrives
  process.stdout.write(chunk.delta);
  
  // Check if generation is complete
  if (chunk.finish_reason) {
    console.log('\\nDone!', chunk.finish_reason);
  }
}`}
                />
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Streaming in Next.js API Routes</h2>
                <CodeBlock
                    language="typescript"
                    filename="app/api/chat/route.ts"
                    code={`import { Cencori } from 'cencori';
import { NextRequest } from 'next/server';

const cencori = new Cencori();

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const stream = cencori.ai.chatStream({
    model: 'gpt-4o',
    messages,
  });

  // Create a readable stream
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(
          encoder.encode(\`data: \${JSON.stringify(chunk)}\\n\\n\`)
        );
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}`}
                />
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">With Vercel AI SDK</h2>
                <p className="text-sm text-muted-foreground">
                    Even simpler with our Vercel AI SDK provider:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="app/api/chat/route.ts"
                    code={`import { cencori } from '@cencori/ai-sdk';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: cencori('gpt-4o'),
    messages,
  });

  return result.toDataStreamResponse();
}`}
                />
            </div>

            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm">
                    <strong>💡 Tip:</strong> The Vercel AI SDK integration handles all the complexity — works with <code className="px-1 py-0.5 rounded bg-muted text-xs">useChat()</code> hook out of the box!
                </p>
            </div>
        </div>
    );
}
