import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGatewayFeatureFlags } from '@/lib/gateway-reliability';
import { getGoogleApiKey } from '@/lib/providers/google-env';

let genAI: GoogleGenerativeAI | null = null;
const SEMANTIC_EMBEDDING_MODEL = 'text-embedding-004';

function getClient(): GoogleGenerativeAI | null {
    if (genAI) return genAI;
    const key = getGoogleApiKey();
    if (!key) return null;
    genAI = new GoogleGenerativeAI(key);
    return genAI;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
    const client = getClient();
    if (!client) {
        console.warn('[Cache] No Google API key available for embeddings');
        return null;
    }

    try {
        const model = client.getGenerativeModel({ model: SEMANTIC_EMBEDDING_MODEL });
        const result = await model.embedContent(text);
        const values = result.embedding.values;
        const expectedDimensions = getGatewayFeatureFlags().semanticCacheExpectedDimensions;

        if (!Array.isArray(values) || values.length !== expectedDimensions) {
            console.warn('[Cache] Embedding generation returned unexpected dimensions:', {
                actual: Array.isArray(values) ? values.length : 0,
                expected: expectedDimensions,
                model: SEMANTIC_EMBEDDING_MODEL,
            });
            return null;
        }

        return values;
    } catch (error) {
        console.error('[Cache] Embedding generation failed:', error);
        return null;
    }
}
