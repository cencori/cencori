import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGoogleApiKey } from '@/lib/providers/google-env';

let genAI: GoogleGenerativeAI | null = null;

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
        const model = client.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error('[Cache] Embedding generation failed:', error);
        return null;
    }
}
