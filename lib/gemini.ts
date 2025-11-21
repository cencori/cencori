import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface ChatRequest {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
}

export interface ChatResponse {
    text: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    latencyMs: number;
}

// Gemini pricing (as of Nov 2024) - adjust as needed
const PRICING = {
    'gemini-1.5-pro': {
        inputPer1KTokens: 0.00025,
        outputPer1KTokens: 0.00075,
    },
    'gemini-1.5-flash': {
        inputPer1KTokens: 0.000075,
        outputPer1KTokens: 0.0003,
    },
    // Default fallback
    default: {
        inputPer1KTokens: 0.00025,
        outputPer1KTokens: 0.00075,
    },
};

/**
 * Calculate the cost of a Gemini API request
 */
function calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
): number {
    const pricing = PRICING[model as keyof typeof PRICING] || PRICING.default;

    const inputCost = (promptTokens / 1000) * pricing.inputPer1KTokens;
    const outputCost = (completionTokens / 1000) * pricing.outputPer1KTokens;

    return inputCost + outputCost;
}

/**
 * Send a chat request to Gemini API
 */
export async function sendChatRequest(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const modelName = request.model || 'gemini-2.5-pro';

    try {
        const model = genAI.getGenerativeModel({ model: modelName });

        // Convert messages to Gemini format
        const chat = model.startChat({
            history: request.messages.slice(0, -1), // All messages except the last one
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxOutputTokens ?? 2048,
            },
        });

        // Get the last message (user's prompt)
        const lastMessage = request.messages[request.messages.length - 1];
        const prompt = lastMessage.parts.map(p => p.text).join('\n');

        // Send the message
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        const text = response.text();

        // Calculate tokens and cost
        const promptTokens = (await model.countTokens(prompt)).totalTokens;
        const completionTokens = (await model.countTokens(text)).totalTokens;
        const totalTokens = promptTokens + completionTokens;
        const costUsd = calculateCost(modelName, promptTokens, completionTokens);
        const latencyMs = Date.now() - startTime;

        return {
            text,
            promptTokens,
            completionTokens,
            totalTokens,
            costUsd,
            latencyMs,
        };
    } catch (error) {
        const latencyMs = Date.now() - startTime;
        console.error('[Gemini] Error sending chat request:', error);
        throw {
            error,
            latencyMs,
        };
    }
}

/**
 * Test if Gemini API is configured correctly
 */
export async function testGeminiConnection(): Promise<boolean> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Hello');
        return !!result.response.text();
    } catch (error) {
        console.error('[Gemini] Connection test failed:', error);
        return false;
    }
}
