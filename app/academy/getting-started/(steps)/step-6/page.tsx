import { CodeBlock } from "@/components/docs/CodeBlock";

export default function Step6Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Make Your First Request
                </h1>
                <p className="text-muted-foreground">
                    Let&apos;s send your first AI chat request through Cencori. This is the exciting part! 🚀
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Basic Chat Request</h2>
                <p className="text-sm text-muted-foreground">
                    Here&apos;s the simplest way to make an AI request:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="app/api/chat/route.ts"
                    code={`import { Cencori } from 'cencori';

const cencori = new Cencori();

// Make a chat request
const response = await cencori.ai.chat({
  model: 'gpt-4o',  // or 'claude-3-opus', 'gemini-2.5-flash'
  messages: [
    { role: 'user', content: 'Hello! What can you do?' }
  ],
  temperature: 0.7,
  maxTokens: 500,
});

console.log(response.content);
// "Hello! I'm an AI assistant that can help you with..."

console.log(response.usage);
// { prompt_tokens: 12, completion_tokens: 45, total_tokens: 57 }`}
                />
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">In a Next.js API Route</h2>
                <p className="text-sm text-muted-foreground">
                    Here&apos;s a complete example for a Next.js app:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="app/api/chat/route.ts"
                    code={`import { Cencori } from 'cencori';
import { NextRequest, NextResponse } from 'next/server';

const cencori = new Cencori();

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  try {
    const response = await cencori.ai.chat({
      model: 'gpt-4o',
      messages: messages,
    });

    return NextResponse.json({
      content: response.content,
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Cencori error:', error);
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    );
  }
}`}
                />
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Switch Models Instantly</h2>
                <p className="text-sm text-muted-foreground">
                    The magic of Cencori — switch providers with one parameter:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="switching-models.ts"
                    code={`// OpenAI GPT-4
await cencori.ai.chat({ model: 'gpt-4o', messages });

// Anthropic Claude 
await cencori.ai.chat({ model: 'claude-3-5-sonnet', messages });

// Google Gemini
await cencori.ai.chat({ model: 'gemini-2.5-flash', messages });

// Same code, different providers!`}
                />
            </div>

            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm">
                    <strong>✓ What Cencori does automatically:</strong>
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Routes to the correct provider based on model name</li>
                    <li>• Logs the request for your dashboard</li>
                    <li>• Scans for security threats</li>
                    <li>• Tracks token usage and cost</li>
                </ul>
            </div>
        </div>
    );
}
