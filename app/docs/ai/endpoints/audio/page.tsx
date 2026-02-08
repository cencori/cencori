"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function AudioEndpointDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Audio Endpoint
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Speech-to-text transcription and text-to-speech generation using OpenAI Whisper and TTS.
                </p>
            </div>

            {/* Transcriptions */}
            <div className="space-y-4">
                <h2 id="transcriptions" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Transcriptions (Speech-to-Text)
                </h2>
                <CodeBlock code="POST /api/ai/audio/transcriptions" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>

                <CodeBlock code={`// Request (multipart/form-data)
{
  "file": <audio file>,
  "model": "whisper-1",
  "language": "en",     // optional
  "prompt": ""          // optional context hint
}

// Response
{
  "text": "Hello, how are you today?"
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>

                <p className="text-sm text-muted-foreground">
                    Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
                </p>
            </div>

            {/* Text-to-Speech */}
            <div className="space-y-4">
                <h2 id="speech" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Speech (Text-to-Speech)
                </h2>
                <CodeBlock code="POST /api/ai/audio/speech" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>

                <CodeBlock code={`{
  "input": "Hello, welcome to Cencori!",
  "model": "tts-1",
  "voice": "alloy",
  "speed": 1.0
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Voices */}
            <div className="space-y-4">
                <h2 id="voices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Available Voices
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Voice</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b"><td className="py-2">alloy</td><td className="py-2">Neutral, balanced</td></tr>
                            <tr className="border-b"><td className="py-2">echo</td><td className="py-2">Warm, conversational</td></tr>
                            <tr className="border-b"><td className="py-2">fable</td><td className="py-2">Expressive, storytelling</td></tr>
                            <tr className="border-b"><td className="py-2">onyx</td><td className="py-2">Deep, authoritative</td></tr>
                            <tr className="border-b"><td className="py-2">nova</td><td className="py-2">Friendly, upbeat</td></tr>
                            <tr className="border-b"><td className="py-2">shimmer</td><td className="py-2">Clear, professional</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Models */}
            <div className="space-y-4">
                <h2 id="models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Models
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Model</th>
                                <th className="text-left py-2 font-semibold">Type</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">whisper-1</td>
                                <td className="py-2">Speech-to-Text</td>
                                <td className="py-2">Multi-language transcription</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">tts-1</td>
                                <td className="py-2">Text-to-Speech</td>
                                <td className="py-2">Standard quality, low latency</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">tts-1-hd</td>
                                <td className="py-2">Text-to-Speech</td>
                                <td className="py-2">HD quality</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/endpoints/embeddings">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Embeddings</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/endpoints/moderation">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Moderation</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
