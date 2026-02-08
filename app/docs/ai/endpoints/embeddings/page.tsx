"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function EmbeddingsEndpointDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Embeddings Endpoint
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Generate vector embeddings for semantic search, RAG, and similarity comparisons.
                </p>
            </div>

            {/* Endpoint */}
            <div className="space-y-4">
                <h2 id="endpoint" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Endpoint
                </h2>
                <CodeBlock code="POST /api/ai/embeddings" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Request */}
            <div className="space-y-4">
                <h2 id="request" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Request Body
                </h2>

                <CodeBlock code={`{
  "model": "text-embedding-3-small",
  "input": "Hello world"
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>

                <p className="text-sm text-muted-foreground">
                    Input can be a string or array of strings for batch processing.
                </p>
            </div>

            {/* Response */}
            <div className="space-y-4">
                <h2 id="response" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Response
                </h2>

                <CodeBlock code={`{
  "object": "list",
  "data": [{
    "object": "embedding",
    "index": 0,
    "embedding": [0.0023, -0.0094, 0.0231, ...]
  }],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 2,
    "total_tokens": 2
  }
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* SDK */}
            <div className="space-y-4">
                <h2 id="sdk" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    SDK Usage
                </h2>

                <CodeBlock code={`const response = await cencori.ai.embeddings({
  model: 'text-embedding-3-small',
  input: 'Hello world'
});

console.log(response.embeddings[0]); // [0.0023, -0.0094, ...]

// Batch
const batch = await cencori.ai.embeddings({
  model: 'text-embedding-3-small',
  input: ['Hello', 'World', 'Test']
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Models */}
            <div className="space-y-4">
                <h2 id="models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Models
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Model</th>
                                <th className="text-left py-2 font-semibold">Dimensions</th>
                                <th className="text-left py-2 font-semibold">Provider</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">text-embedding-3-large</td>
                                <td className="py-2">3072</td>
                                <td className="py-2">OpenAI</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">text-embedding-3-small</td>
                                <td className="py-2">1536</td>
                                <td className="py-2">OpenAI</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">text-embedding-004</td>
                                <td className="py-2">768</td>
                                <td className="py-2">Google</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">embed-english-v3.0</td>
                                <td className="py-2">1024</td>
                                <td className="py-2">Cohere</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/endpoints/images">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Images</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/endpoints/audio">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Audio</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
