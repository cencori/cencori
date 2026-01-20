import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function QuickStartPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Quick Start
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Get started with Cencori in under 5 minutes. This guide will walk you through installation, initialization, and making your first secured AI request.
                </p>
            </div>

            {/* Prerequisites */}
            <div className="space-y-4">
                <h2 id="prerequisites" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Prerequisites
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Before you begin, make sure you have:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Node.js 18+</strong> installed on your system
                    </li>
                    <li className="list-disc">
                        <strong>A Cencori account:</strong> Sign up at <a href="/dashboard" className="text-primary hover:underline">cencori.com/dashboard</a>
                    </li>
                    <li className="list-disc">
                        <strong>An AI provider API key:</strong> From OpenAI, Anthropic, or Google
                    </li>
                </ul>
            </div>

            {/* Step 1: Installation */}
            <div className="space-y-4">
                <h2 id="installation" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 1: Installation
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Install the Cencori SDK using your preferred package manager:
                </p>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">JavaScript/TypeScript</h3>
                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`npm install cencori
# or
yarn add cencori
# or
pnpm add cencori`}
                    />
                </div>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">Python</h3>
                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`pip install cencori`}
                    />
                </div>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">Go</h3>
                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`go get github.com/cencori/cencori-go`}
                    />
                </div>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">Vercel AI SDK (optional)</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Using Vercel AI SDK? Install the Cencori provider for seamless integration:
                    </p>
                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`npm install @cencori/ai-sdk ai`}
                    />
                </div>
            </div>

            {/* Step 2: Get Your API Keys */}
            <div className="space-y-4">
                <h2 id="get-api-keys" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 2: Get Your API Keys
                </h2>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">Create a Project</h3>
                    <ol className="space-y-2 text-sm ml-6 list-decimal">
                        <li>Log in to your <a href="/dashboard" className="text-primary hover:underline">Cencori dashboard</a></li>
                        <li>Click <strong>&quot;Create Project&quot;</strong> and give it a name</li>
                        <li>Navigate to <strong>&quot;API Keys&quot;</strong> in the project settings</li>
                        <li>Click <strong>&quot;Generate New Key&quot;</strong> and copy it immediately (it won&apos;t be shown again)</li>
                    </ol>
                </div>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Add Your AI Provider Key</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        In your project settings, add your AI provider&apos;s API key under <strong>&quot;Provider Keys&quot;</strong>. Cencori will use this to make requests on your behalf.
                    </p>
                </div>
            </div>

            {/* Step 3: Initialize the SDK */}
            <div className="space-y-4">
                <h2 id="initialize" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 3: Initialize the SDK
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Create a Cencori client instance with your API key:
                </p>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">JavaScript/TypeScript</h3>
                    <CodeBlock
                        filename="lib/cencori.ts"
                        language="typescript"
                        code={`import { Cencori } from "cencori";

export const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});`}
                    />
                </div>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">Python</h3>
                    <CodeBlock
                        filename="main.py"
                        language="python"
                        code={`from cencori import Cencori

cencori = Cencori(api_key="your-api-key")

# Or use environment variable
import os
cencori = Cencori(api_key=os.environ["CENCORI_API_KEY"])`}
                    />
                </div>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">Go</h3>
                    <CodeBlock
                        filename="main.go"
                        language="go"
                        code={`package main

import (
    "os"
    "github.com/cencori/cencori-go"
)

func main() {
    client, err := cencori.NewClient(
        cencori.WithAPIKey(os.Getenv("CENCORI_API_KEY")),
    )
}`}
                    />
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Store your API keys in environment variables (.env file) and never commit them to version control.
                    </p>
                </div>
            </div>

            {/* Step 4: Make Your First Request */}
            <div className="space-y-4">
                <h2 id="first-request" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 4: Make Your First Request
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Replace your existing AI provider calls with Cencori&apos;s unified API:
                </p>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">JavaScript/TypeScript</h3>
                    <CodeBlock
                        filename="app/api/chat/route.ts"
                        language="typescript"
                        code={`import { cencori } from "@/lib/cencori";

export async function POST(req: Request) {
  const { messages, model } = await req.json();

  try {
    const response = await cencori.ai.chat({
      model: model || "gpt-4o", // or "claude-3-opus", "gemini-2.5-flash"
      messages: messages,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return Response.json(response);
  } catch (error) {
    // Cencori will throw errors for blocked requests
    console.error("Cencori error:", error);
    return Response.json(
      { error: "Request blocked by security policy" },
      { status: 403 }
    );
  }
}`}
                    />
                </div>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">Go</h3>
                    <CodeBlock
                        filename="main.go"
                        language="go"
                        code={`package main

import (
    "context"
    "fmt"
    "os"
    "github.com/cencori/cencori-go"
)

func main() {
    client, _ := cencori.NewClient(
        cencori.WithAPIKey(os.Getenv("CENCORI_API_KEY")),
    )

    resp, _ := client.Chat.Create(context.Background(), &cencori.ChatParams{
        Model: "gpt-4o",
        Messages: []cencori.Message{
            {Role: "user", Content: "Hello!"},
        },
    })

    fmt.Println(resp.Choices[0].Message.Content)
}`}
                    />
                </div>


            </div>

            {/* Step 5: View Your Logs */}
            <div className="space-y-4">
                <h2 id="view-logs" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 5: View Your Logs
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    After making your first request, visit your Cencori dashboard to see:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Request Logs:</strong> Every prompt and response with full metadata
                    </li>
                    <li className="list-disc">
                        <strong>Security Incidents:</strong> Any threats detected and blocked
                    </li>
                    <li className="list-disc">
                        <strong>Usage Analytics:</strong> Token consumption, costs, and latency metrics
                    </li>
                    <li className="list-disc">
                        <strong>Rate Limit Status:</strong> Current usage against your limits
                    </li>
                </ul>
            </div>

            {/* Switching Providers */}
            <div className="space-y-4">
                <h2 id="switching-providers" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Switching Between AI Providers
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    One of Cencori&apos;s key features is multi-provider support. Change the model parameter to switch providers without changing your code:
                </p>

                <CodeBlock
                    filename="example.ts"
                    language="typescript"
                    code={`// OpenAI GPT-4
const gpt4Response = await cencori.ai.chat({
  model: "gpt-4o",
  messages: messages,
});

// Anthropic Claude
const claudeResponse = await cencori.ai.chat({
  model: "claude-3-opus",
  messages: messages,
});

// Google Gemini
const geminiResponse = await cencori.ai.chat({
  model: "gemini-2.5-flash",
  messages: messages,
});`}
                />

                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    All requests are logged and monitored the same way, regardless of the underlying provider.
                </p>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 id="next-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What&apos;s Next?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Now that you have Cencori set up, explore these topics to unlock its full potential:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Configure Rate Limits:</strong> Set per-user or per-organization limits
                    </li>
                    <li className="list-disc">
                        <strong>Set Up Security Policies:</strong> Define custom rules for threat detection
                    </li>
                    <li className="list-disc">
                        <strong>Export Logs:</strong> Integrate with your data warehouse or compliance tools
                    </li>
                    <li className="list-disc">
                        <strong>Monitor Costs:</strong> Set budget alerts and spending caps
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Introduction</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/installation">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Installation</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
