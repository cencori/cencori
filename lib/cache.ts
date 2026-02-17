import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Redis 
// (sharing the same instance as rate-limit, or new one - here we create new for modularity 
// but in a real app might want a singleton. For now, following pattern in rate-limit.ts)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Initialize Supabase for Vector Store
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Gemini for Embeddings (Lazy init per request or global if env only)
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
// const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

const DEFAULT_TTL = 3600; // 1 hour

interface CacheKeyParams {
    projectId: string;
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
}

// --- Exact Match Caching (Legacy) ---

/**
 * Generate a deterministic cache key based on request parameters
 */
export function computeCacheKey(params: CacheKeyParams): string {
    const data = JSON.stringify({
        p: params.projectId,
        m: params.model,
        t: params.temperature || 0, // default temp
        mx: params.maxTokens || 0, // default max tokens
        pr: params.prompt.trim(),
    });

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return `cache:completion:${hash}`;
}

/**
 * Retrieve cached response
 */
export async function getCache(key: string): Promise<any | null> {
    try {
        const data = await redis.get(key);
        return data as any;
    } catch (error) {
        console.warn('[Cache] Get failed:', error);
        return null;
    }
}

/**
 * Save response to cache
 */
export async function saveCache(key: string, data: any, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
        await redis.set(key, JSON.stringify(data), { ex: ttl });
    } catch (error) {
        console.warn('[Cache] Save failed:', error);
    }
}

// --- Vector Semantic Caching (Supabase pgvector) ---

function getEmbeddingModel(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No Gemini API Key provided for semantic cache");
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "gemini-embedding-001" });
}

function getMockEmbedding(prompt: string): number[] {
    // Deterministic mock vector (768 dimensions)
    // We use a simple hash of the prompt to seed the vector
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
        hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
        hash |= 0;
    }

    // Create a vector where values oscillate based on hash, ensuring same prompt = same vector
    // and different prompt = different vector (roughly)
    return Array.from({ length: 768 }, (_, i) => (Math.sin(hash + i) + 1) / 2);
}

export async function getSemanticCache(prompt: string, apiKey?: string, threshold = 0.95): Promise<{ response: any | null, embedding: number[] | null }> {
    try {
        let vector: number[];

        if (process.env.MOCK_EMBEDDINGS === 'true') {
            console.log('[Semantic Cache] Using MOCK embedding');
            vector = getMockEmbedding(prompt);
        } else {
            // 1. Generate Embedding
            const embeddingModel = getEmbeddingModel(apiKey);
            const result = await embeddingModel.embedContent(prompt);
            vector = result.embedding.values;
        }

        // 2. Query Postgres via RPC
        const { data: matches, error } = await supabase.rpc('match_semantic_cache', {
            query_embedding: vector,
            match_threshold: threshold,
            match_count: 1
        });

        if (error) {
            console.warn('[Semantic Cache] RPC Error:', error);
            // Even if RPC fails, we return the vector so we can potentially use it (though unlikely to save if RPC is broken)
            return { response: null, embedding: vector };
        }

        // 3. Check Threshold (Handled by RPC, but safe to check result)
        if (matches && matches.length > 0) {
            console.log(`[Semantic Cache] HIT (Score: ${matches[0].similarity})`);
            return { response: matches[0].response, embedding: vector };
        }

        console.log(`[Semantic Cache] MISS`);
        return { response: null, embedding: vector };
    } catch (error) {
        console.warn('[Semantic Cache] Get failed:', error);
        return { response: null, embedding: null };
    }
}

export async function saveSemanticCache(prompt: string, response: any, apiKey?: string, embedding?: number[]): Promise<void> {
    try {
        let vector = embedding;

        // 1. Generate Embedding if not provided
        if (!vector) {
            if (process.env.MOCK_EMBEDDINGS === 'true') {
                vector = getMockEmbedding(prompt);
            } else {
                const embeddingModel = getEmbeddingModel(apiKey);
                const result = await embeddingModel.embedContent(prompt);
                vector = result.embedding.values;
            }
        }

        // 2. Insert into Table
        // We use upsert on prompt to avoid duplicates if migration has unique constraint
        const { error } = await supabase
            .from('semantic_cache')
            .upsert({
                prompt,
                response,
                embedding: vector
            }, { onConflict: 'prompt' });

        if (error) {
            console.warn('[Semantic Cache] Insert Error:', error);
        }
    } catch (error) {
        console.warn('[Semantic Cache] Save failed:', error);
    }
}
