import { NextRequest, NextResponse } from 'next/server';
import { sendChatRequest } from '@/lib/gemini';

const SYSTEM_PROMPT = `You are Cencori AI, an intelligent assistant for the Cencori AI Gateway platform.

Cencori is a unified AI gateway that helps developers:
- Connect to multiple AI providers (OpenAI, Anthropic, Google AI, etc.) through a single API
- Implement security features like PII detection and content moderation
- Monitor usage, costs, and analytics across all AI providers
- Maintain compliance with audit logging and request tracing

You help users with:
- Getting started with Cencori
- Understanding API usage and SDK integration
- Troubleshooting issues
- Best practices for AI integration

Keep responses concise, helpful, and focused on Cencori features. If asked about unrelated topics, politely redirect to Cencori-related help.`;

export async function POST(req: NextRequest) {
    try {
        const { question } = await req.json();

        if (!question || typeof question !== 'string') {
            return NextResponse.json(
                { error: 'Question is required' },
                { status: 400 }
            );
        }

        const response = await sendChatRequest({
            messages: [
                {
                    role: 'user',
                    parts: [{ text: `${SYSTEM_PROMPT}\n\nUser question: ${question}` }],
                },
            ],
            model: 'gemini-2.5-flash',
            temperature: 0.7,
            maxOutputTokens: 1024,
        });

        return NextResponse.json({
            answer: response.text,
            tokens: response.totalTokens,
        });
    } catch (error) {
        console.error('[Ask AI] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get AI response' },
            { status: 500 }
        );
    }
}
