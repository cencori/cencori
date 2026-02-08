"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImageGenerationDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Image Generation
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Generate images from text prompts using multiple AI providers with a unified API.
                </p>
            </div>

            {/* Supported Models */}
            <div className="space-y-4">
                <h2 id="models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Models
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Provider</th>
                                <th className="text-left py-2 font-semibold">Model</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">gpt-image-1.5</code></td>
                                <td className="py-2">Best text rendering, top ELO rating</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">gpt-image-1</code></td>
                                <td className="py-2">ChatGPT image generation</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">dall-e-3</code></td>
                                <td className="py-2">High quality, creative</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">dall-e-2</code></td>
                                <td className="py-2">Fast, cost-effective</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Google</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">gemini-3-pro-image</code></td>
                                <td className="py-2">High photorealism, fast</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Google</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">imagen-3</code></td>
                                <td className="py-2">Google Imagen 3</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Usage */}
            <div className="space-y-4">
                <h2 id="usage" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Usage
                </h2>

                <div className="space-y-4">
                    <h3 className="text-base font-semibold">SDK</h3>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`const response = await cencori.ai.generateImage({
  prompt: "A futuristic city at sunset with flying cars",
  model: "gpt-image-1.5",
  size: "1024x1024",
  quality: "hd"
});

console.log(response.images[0].url);`}</code>
                    </pre>
                </div>

                <div className="space-y-4">
                    <h3 className="text-base font-semibold">API Request</h3>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`POST /api/ai/images/generate
Headers: { "CENCORI_API_KEY": "csk_..." }
Body: {
  "prompt": "A futuristic city at sunset",
  "model": "gpt-image-1.5",
  "size": "1024x1024",
  "quality": "hd",
  "n": 1
}`}</code>
                    </pre>
                </div>
            </div>

            {/* Parameters */}
            <div className="space-y-4">
                <h2 id="parameters" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Parameters
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Parameter</th>
                                <th className="text-left py-2 font-semibold">Type</th>
                                <th className="text-left py-2 font-semibold">Required</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">prompt</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">Yes</td>
                                <td className="py-2">Text description of the image</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">model</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">No</td>
                                <td className="py-2">Image model (default: dall-e-3)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">size</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">No</td>
                                <td className="py-2">1024x1024, 1792x1024, 1024x1792, etc.</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">n</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">No</td>
                                <td className="py-2">Number of images (1-4, varies by model)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">quality</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">No</td>
                                <td className="py-2">&apos;standard&apos; or &apos;hd&apos; (DALL-E 3/GPT Image)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">style</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">No</td>
                                <td className="py-2">&apos;vivid&apos; or &apos;natural&apos; (DALL-E 3 only)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">responseFormat</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">No</td>
                                <td className="py-2">&apos;url&apos; or &apos;b64_json&apos;</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Response */}
            <div className="space-y-4">
                <h2 id="response" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Response
                </h2>

                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{`{
  "images": [
    {
      "url": "https://...",
      "b64_json": null,
      "revisedPrompt": "A futuristic cityscape..."
    }
  ],
  "model": "gpt-image-1.5",
  "provider": "openai"
}`}</code>
                </pre>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/api/chat">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Chat</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/api/embeddings">
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
