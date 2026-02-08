"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function ModerationEndpointDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Moderation Endpoint
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Detect harmful content in text. Returns category flags and confidence scores.
                </p>
            </div>

            {/* Endpoint */}
            <div className="space-y-4">
                <h2 id="endpoint" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Endpoint
                </h2>
                <CodeBlock code="POST /api/ai/moderation" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Request */}
            <div className="space-y-4">
                <h2 id="request" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Request Body
                </h2>

                <CodeBlock code={`{
  "input": "Text to check for harmful content",
  "model": "text-moderation-latest"
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Response */}
            <div className="space-y-4">
                <h2 id="response" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Response
                </h2>

                <CodeBlock code={`{
  "id": "modr-abc123",
  "model": "text-moderation-latest",
  "results": [{
    "flagged": false,
    "categories": {
      "hate": false,
      "hate/threatening": false,
      "harassment": false,
      "harassment/threatening": false,
      "self-harm": false,
      "sexual": false,
      "violence": false
    },
    "category_scores": {
      "hate": 0.0001,
      "harassment": 0.0002,
      "violence": 0.0001
    }
  }]
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Categories */}
            <div className="space-y-4">
                <h2 id="categories" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Categories
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Category</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b"><td className="py-2">hate</td><td className="py-2">Hateful content</td></tr>
                            <tr className="border-b"><td className="py-2">hate/threatening</td><td className="py-2">Hateful content with threats</td></tr>
                            <tr className="border-b"><td className="py-2">harassment</td><td className="py-2">Harassing content</td></tr>
                            <tr className="border-b"><td className="py-2">self-harm</td><td className="py-2">Self-harm related</td></tr>
                            <tr className="border-b"><td className="py-2">sexual</td><td className="py-2">Sexual content</td></tr>
                            <tr className="border-b"><td className="py-2">violence</td><td className="py-2">Violent content</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Use Cases */}
            <div className="space-y-4">
                <h2 id="use-cases" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Use Cases
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Pre-screen user input before AI processing</li>
                    <li className="list-disc">Filter user-generated content</li>
                    <li className="list-disc">Validate AI outputs before displaying</li>
                    <li className="list-disc">Compliance and safety monitoring</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/endpoints/audio">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Audio</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/memory">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">AI Memory</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
