"use client";

import Image from "next/image";
import { AudioLines } from "lucide-react";
import { OpenAI, Anthropic, Google, Mistral, Cohere, Cerebras, Perplexity, Groq, XAI, Together, Meta, HuggingFace, Qwen, DeepSeek, ZAI, Cloudflare, ElevenLabs, AssemblyAI, Kimi } from "@lobehub/icons";

/**
 * Brand mark for a provider id (as stored on ai_requests.provider and in
 * SUPPORTED_PROVIDERS), or null when there is no mark. Shared by the BYOK list
 * and the overview's cost-by-provider chart.
 */
export function getProviderLogoMark(providerId: string, size = 20): React.ReactNode | null {
    const small = Math.max(size - 2, 10);
    switch (providerId) {
        case "openai": return <OpenAI size={size} />;
        case "anthropic": return <Anthropic size={size} />;
        case "google":
        case "gemini": return <Google.Color size={size} />;
        case "mistral": return <Mistral.Color size={size} />;
        case "cohere": return <Cohere.Color size={size} />;
        case "perplexity": return <Perplexity.Color size={size} />;
        case "groq": return <Groq size={size} />;
        case "together": return <Together.Color size={size} />;
        case "xai": return <XAI size={size} />;
        case "meta": return <Meta.Color size={size} />;
        case "huggingface": return <HuggingFace.Color size={size} />;
        case "qwen": return <Qwen.Color size={size} />;
        case "deepseek": return <DeepSeek.Color size={size} />;
        case "moonshot":
        case "kimi": return <Kimi size={size} />;
        case "zai": return <ZAI size={size} />;
        case "cerebras": return <Cerebras.Color size={size} />;
        case "cloudflare": return <Cloudflare.Color size={size} />;
        case "maximo": return <Image src="/partners/max.jpeg" alt="Maximo AI" width={size} height={size} className="rounded-sm object-cover" />;
        case "helix": return <Image src="/providers/helix.svg" alt="Helix" width={size} height={size} className="rounded-sm" />;
        // eslint-disable-next-line @next/next/no-img-element
        case "bai": return <img src="/providers/bai.png" alt="B.AI" width={size} height={size} className="rounded-[5px] object-cover" style={{ width: size, height: size }} />;
        // Judgment provider (TypeSafe Jev) — decision models, no brand icon in the set
        case "typesafe": return <Image src="/providers/typesafe.png" alt="TypeSafe" width={small} height={small} className="rounded-[5px]" />;
        // Voice providers (no brand icons in the icon set) — neutral voice glyph
        case "deepgram":
        case "cartesia": return <AudioLines size={small} />;
        case "spitch": return <Image src="/providers/spitch.png" alt="Spitch" width={size} height={size} className="rounded-[5px] object-cover" />;
        case "assemblyai": return <AssemblyAI.Color size={size} />;
        case "elevenlabs": return <ElevenLabs size={size} />;
        default: return null;
    }
}
