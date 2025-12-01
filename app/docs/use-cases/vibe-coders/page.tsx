import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function VibeCodersPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    For Context Engineers
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    You&apos;re building fast with tools like Cursor, v0, Antigravity and Lovable. Cencori ensures your speed doesn&apos;t compromise security.
                </p>
            </div>

            {/* The Problem */}
            <div className="space-y-4">
                <h2 id="the-problem" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    The &quot;Vibe Coding&quot; Security Gap
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    AI coding assistants are incredible at generating functional code, but they often miss security best practices. They might:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Hardcode sensitive API keys or credentials.</li>
                    <li className="list-disc">Forget input validation, leading to SQL injection or XSS.</li>
                    <li className="list-disc">Fail to implement rate limiting on expensive API routes.</li>
                    <li className="list-disc">Hallucinate insecure dependencies.</li>
                </ul>
                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    When you&apos;re &quot;vibe coding&quot; (iterating rapidly and letting the AI handle the implementation) you need a safety net that catches these issues automatically.
                </p>
            </div>

            {/* How Cencori Helps */}
            <div className="space-y-4">
                <h2 id="how-cencori-helps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How Cencori Helps
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori acts as a wrapper around your AI-generated endpoints. It doesn&apos;t get in your way; it just observes and protects.
                </p>

                <div className="space-y-4 mt-6">
                    <h3 className="text-base font-semibold">Example: Securing a Next.js Route</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Let&apos;s say Cursor generated this API route for you:
                    </p>
                    <CodeBlock
                        filename="app/api/generate/route.ts (Before)"
                        language="typescript"
                        code={`import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  
  // No rate limiting
  // No input validation
  // No logging
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return Response.json(response);
}`}
                    />

                    <p className="text-sm text-muted-foreground leading-relaxed">
                        With Cencori, you just wrap it. You can even ask Cursor to &quot;wrap this with Cencori&quot;:
                    </p>
                    <CodeBlock
                        filename="app/api/generate/route.ts (After)"
                        language="typescript"
                        code={`import { cencori } from "@/lib/cencori"; // Your Cencori instance

export async function POST(req: Request) {
  // Cencori middleware handles logging, rate limiting, and threat detection automatically.
  return cencori.guard(async () => {
    const { prompt } = await req.json();
    
    const response = await cencori.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json(response);
  }, req);
}`}
                    />
                </div>
            </div>

            {/* What You Get */}
            <div className="space-y-4">
                <h2 id="benefits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What You Get
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    By wrapping your AI routes with Cencori, you automatically get:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Real-time threat detection:</strong> Prompt injection attempts are blocked before reaching your AI provider
                    </li>
                    <li className="list-disc">
                        <strong>Automatic rate limiting:</strong> Per-user, per-endpoint limits prevent abuse and cost overruns
                    </li>
                    <li className="list-disc">
                        <strong>Complete audit logs:</strong> Every request and response logged for compliance and debugging
                    </li>
                    <li className="list-disc">
                        <strong>Cost tracking:</strong> Token usage and costs attributed to users and features
                    </li>
                    <li className="list-disc">
                        <strong>PII filtering:</strong> Sensitive data detection before it leaves your system
                    </li>
                </ul>
            </div>

            {/* Getting Started */}
            <div className="space-y-4">
                <h2 id="getting-started" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Start Vibe Coding Safely
                </h2>
                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>
                        <strong>Install the SDK:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">npm install cencori</code>
                    </li>
                    <li>
                        <strong>Initialize:</strong> Set up your Cencori client with your API key
                    </li>
                    <li>
                        <strong>Guard:</strong> Wrap your critical AI routes with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cencori.guard()</code>
                    </li>
                </ol>
                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    Now you can let the AI write the code, knowing Cencori has your back on security.
                </p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/quick-start">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Quick Start</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/use-cases/ai-companies">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">For AI Companies</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
