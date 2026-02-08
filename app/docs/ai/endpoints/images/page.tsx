"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function ImagesEndpointDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Images Endpoint
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Generate images from text prompts using DALL-E, GPT Image, and Google Imagen.
                </p>
            </div>

            {/* Endpoint */}
            <div className="space-y-4">
                <h2 id="endpoint" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Endpoint
                </h2>
                <CodeBlock code="POST /api/ai/images/generate" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Request */}
            <div className="space-y-4">
                <h2 id="request" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Request Body
                </h2>

                <CodeBlock code={`{
  "prompt": "A futuristic city at sunset",
  "model": "gpt-image-1.5",
  "size": "1024x1024",
  "quality": "hd",
  "n": 1
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Parameters */}
            <div className="space-y-4">
                <h2 id="params" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Parameters
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Parameter</th>
                                <th className="text-left py-2 font-semibold">Type</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">prompt</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">Image description (required)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">model</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">gpt-image-1.5, dall-e-3, imagen-3</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">size</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">1024x1024, 1024x1792, 1792x1024</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">quality</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">standard or hd</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">n</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">Number of images (1-4)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SDK Usage */}
            <div className="space-y-4">
                <h2 id="sdk" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    SDK Usage
                </h2>

                <CodeBlock code={`const response = await cencori.ai.generateImage({
  prompt: 'A futuristic city at sunset',
  model: 'gpt-image-1.5',
  size: '1024x1024',
  quality: 'hd'
});

console.log(response.images[0].url);`} language="typescript">
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
                                <th className="text-left py-2 font-semibold">Provider</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">gpt-image-1.5</td>
                                <td className="py-2">OpenAI</td>
                                <td className="py-2">Best text rendering, top ELO</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">dall-e-3</td>
                                <td className="py-2">OpenAI</td>
                                <td className="py-2">High quality, creative</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">imagen-3</td>
                                <td className="py-2">Google</td>
                                <td className="py-2">Photorealistic</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/endpoints/chat">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Chat</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/endpoints/embeddings">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Embeddings</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
