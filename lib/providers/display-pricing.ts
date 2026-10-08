/**
 * Display pricing for the public model catalog.
 *
 * Client-safe (no DB, no Node built-ins): imported by both
 * `components/models/ModelCatalog.tsx` and the public `GET /api/models`
 * endpoint so the marketing page and the API can never drift apart.
 *
 * Source of truth for *display* rates. The gateway bills from the
 * `model_pricing` table — keep the two in sync when adding a model.
 */

export interface ModelDisplayPrice {
    /** "$0.20" / "$0.020" — display string, no denominator. */
    input: string;
    /** "$0.50" or "per img" for image models. */
    output: string;
    /** Numeric USD per 1M tokens. Null for per-image pricing. */
    inputPerMillion: number | null;
    /** Numeric USD per 1M tokens. Null for per-image pricing. */
    outputPerMillion: number | null;
    /** True for image models billed per image. */
    perImage: boolean;
    /** Per-image USD price when perImage is true. */
    perImageUsd: number | null;
}

function price(inputPerMillion: number, outputPerMillion: number): ModelDisplayPrice {
    // Two decimals normally ("$4.00"), three where the rate needs it ("$0.075").
    const fmt = (n: number) => {
        const three = n.toFixed(3);
        return `$${three.endsWith('0') ? three.slice(0, -1) : three}`;
    };
    return {
        input: fmt(inputPerMillion),
        output: fmt(outputPerMillion),
        inputPerMillion,
        outputPerMillion,
        perImage: false,
        perImageUsd: null,
    };
}

function perImage(us: number): ModelDisplayPrice {
    const s = `$${us.toFixed(3)}`;
    return {
        input: s,
        output: 'per img',
        inputPerMillion: null,
        outputPerMillion: null,
        perImage: true,
        perImageUsd: us,
    };
}

export function getModelDisplayPrice(
    modelId: string,
    type: string | string[],
): ModelDisplayPrice {
    const id = modelId.toLowerCase();
    const primaryType = Array.isArray(type) ? type[0] : type;

    // Image models
    if (
        primaryType === 'image' ||
        id.includes('image') ||
        id.includes('dall-e') ||
        id.includes('imagen')
    ) {
        if (id.includes('dall-e-3') || id.includes('image-2')) {
            return perImage(0.04);
        }
        return perImage(0.02);
    }

    // GPT-5.6 family (repriced Aug 21 2026)
    if (id.startsWith('gpt-5.6-sol')) return price(4, 20);
    if (id.startsWith('gpt-5.6-terra')) return price(2, 12);
    if (id.startsWith('gpt-5.6-luna')) return price(0.2, 1.2);
    // GPT-6 family (September 2026)
    if (id.startsWith('gpt-6-astra')) return price(10, 50);
    if (id.startsWith('gpt-6-sol')) return price(2, 10);
    // GPT-6.1 Sol keeps the $2/$10 base (cheaper cache reads, same display).
    // Dotted id never matches the gpt-6-sol prefix above ('gpt-6.' vs 'gpt-6-')
    // and would otherwise fall through to the $0.50/$1.50 generic catch-all.
    if (id.startsWith('gpt-6.1-sol')) return price(2, 10);
    if (id.startsWith('gpt-6-luna')) return price(0.2, 0.5);
    if (id.startsWith('gpt-5.5-pro')) return price(30, 180);
    // GPT-5 flagship
    if (
        id.startsWith('gpt-5.5') ||
        id.startsWith('gpt-5.4') ||
        id.startsWith('gpt-5.3') ||
        id.startsWith('gpt-5.2') ||
        id.startsWith('gpt-5-pro') ||
        id.startsWith('gpt-5')
    ) {
        if (id.includes('mini')) return price(0.15, 0.6);
        if (id.includes('nano')) return price(0.05, 0.2);
        return price(5, 15);
    }

    // GPT-4 & Reasoning
    if (id.includes('o3-pro')) return price(15, 60);
    if (id.includes('o3-mini') || id.includes('o4-mini')) return price(1.1, 4.4);
    if (id.startsWith('o3') || id.startsWith('o1')) return price(3, 12);
    if (id.includes('gpt-4o-mini')) return price(0.15, 0.6);
    if (id.includes('gpt-4o') || id.includes('gpt-4-turbo')) return price(2.5, 10);
    if (id.includes('gpt-4.1')) {
        if (id.includes('mini')) return price(0.15, 0.6);
        if (id.includes('nano')) return price(0.05, 0.2);
        return price(2.5, 10);
    }

    // Claude
    if (id === 'claude-sonnet-5') return price(2, 10);
    // Sonnet 5.5 keeps Sonnet 5's $2/$10 base rate (cache reads halved to
    // $0.10/MTok Oct 2026). Must precede the generic sonnet catch-all ($3/$15).
    if (id === 'claude-sonnet-5-5') return price(2, 10);
    // Haiku 5.5 short-prompt rate ($0.10/$0.50 at or under 100k tokens; 5x
    // above). Must precede the generic haiku catch-all ($0.25/$1.25).
    if (id === 'claude-haiku-5-5') return price(0.1, 0.5);
    if (id === 'claude-opus-4.8') return price(5, 25);
    if (id === 'claude-opus-5') return price(5, 25);
    if (id === 'claude-opus-5-5') return price(4, 20);
    // Priced above the Opus tier — without this Fable/Mythos fall through to
    // the generic catch-all at $0.50/$1.50 (20x under the real rate).
    if (id.startsWith('claude-fable') || id.startsWith('claude-mythos')) {
        return price(10, 50);
    }
    if (id.includes('opus')) return price(15, 75);
    if (id.includes('sonnet')) return price(3, 15);
    if (id.includes('haiku')) return price(0.25, 1.25);

    // Gemini
    if (id.includes('gemini')) {
        if (id.includes('gemini-3.5-flash')) return price(1.5, 9);
        if (id.includes('pro')) return price(1.25, 5);
        if (id.includes('flash') || id.includes('lite')) return price(0.075, 0.3);
    }

    // DeepSeek
    if (id.includes('deepseek')) {
        if (id.includes('reasoner') || id.includes('speciale') || id.includes('r1')) {
            return price(0.55, 2.19);
        }
        if (id.includes('flash')) return price(0.07, 0.14);
        return price(0.14, 0.28);
    }

    // Llama 4 / 3
    if (id.includes('llama')) {
        if (id.includes('405b') || id.includes('maverick')) return price(2.66, 2.66);
        if (id.includes('70b') || id.includes('versatile') || id.includes('scout'))
            return price(0.7, 0.9);
        if (id.includes('8b') || id.includes('instant') || id.includes('3b'))
            return price(0.05, 0.08);
    }

    // Qwen / Alibaba
    if (id.includes('qwen') || id.includes('qwq')) {
        if (id.includes('72b') || id.includes('max')) return price(0.4, 0.4);
        if (id.includes('32b') || id.includes('plus')) return price(0.2, 0.2);
        return price(0.1, 0.1);
    }

    // Mistral
    if (
        id.includes('mistral') ||
        id.includes('ministral') ||
        id.includes('codestral') ||
        id.includes('devstral') ||
        id.includes('magistral')
    ) {
        // Large 4 preview sale rate ($0.68/$2.09 per 1M; original $1.36/$4.18).
        // Must precede the generic large catch-all ($2/$6, Large 3 era).
        if (id.includes('large-4')) return price(0.68, 2.09);
        if (id.includes('large')) return price(2, 6);
        if (id.includes('medium')) return price(1, 3);
        if (id.includes('small') || id.includes('8b')) return price(0.2, 0.6);
        if (id.includes('3b')) return price(0.06, 0.18);
        return price(0.5, 1.5);
    }

    // xAI Grok ($2/$6 flagship tier, $1.25/$2.50 for 4.3)
    if (id.startsWith('grok-')) {
        if (id.startsWith('grok-4.3')) return price(1.25, 2.5);
        return price(2, 6);
    }

    // Maximo Atlas
    if (id === 'maximo-atlas-1.3') return price(0.2, 0.5);
    if (id === 'maximo-atlas-1.2') return price(0.55, 1.5);

    // Helix Advisor
    if (id === 'helix-advisor') return price(0.5, 1.5);

    // GLM (Z.AI)
    if (id.includes('glm')) return price(0.5, 1.5);

    // Cerebras / Groq OSS
    if (id.includes('gpt-oss') || id.includes('gemma-')) return price(0.5, 1.5);

    // Perplexity Sonar / Cohere
    if (id.includes('sonar')) {
        if (id.includes('reasoning-pro') || id === 'sonar-pro') return price(1.5, 4.5);
        return price(0.5, 1.5);
    }
    if (id.includes('command')) return price(0.5, 1.5);

    // Fallbacks based on context window size / capabilities
    if (id.includes('pro') || id.includes('large')) return price(1.5, 4.5);
    if (id.includes('mini') || id.includes('lite') || id.includes('small'))
        return price(0.15, 0.6);
    if (id.includes('micro') || id.includes('nano')) return price(0.05, 0.15);

    return price(0.5, 1.5);
}

export function formatContextWindow(tokens: number): string {
    if (tokens === 0) return '—';
    if (tokens >= 1_000_000)
        return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
    return `${(tokens / 1_000).toFixed(0)}K`;
}
