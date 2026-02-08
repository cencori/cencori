import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import OpenAI from "openai";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

function getMdxFiles(dir: string, basePath = ""): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);
        if (entry.isDirectory()) {
            files.push(...getMdxFiles(fullPath, relativePath));
        } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
            files.push(relativePath);
        }
    }
    return files;
}

function filePathToSlug(filePath: string): string {
    return filePath
        .replace(/\.(mdx|md)$/, "")
        .replace(/\/_index$/, "")
        .replace(/\/index$/, "")
        .replace(/^\//, "");
}

// Simple keyword search for relevant docs
function searchDocs(query: string, limit = 5): { title: string; content: string; slug: string }[] {
    const files = getMdxFiles(DOCS_DIR);
    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);

    // If query is very generic, return more results
    const isGeneric = queryWords.length < 2 || ["overview", "introduction", "help", "cencori"].some(w => lowerQuery.includes(w));
    const effectiveLimit = isGeneric ? 8 : limit;

    const scored = files.map((file) => {
        const filePath = path.join(DOCS_DIR, file);
        const fileContents = fs.readFileSync(filePath, "utf-8");
        const { data, content } = matter(fileContents);
        const slug = filePathToSlug(file);

        // Clean content for scoring
        const cleanContent = content
            .replace(/<[^>]+>/g, " ")
            .replace(/```[\s\S]*?```/g, " ")
            .replace(/`[^`]+`/g, " ")
            .toLowerCase();

        const title = (data.title || slug).toLowerCase();

        // Score based on matches
        let score = 0;

        // Boost for title matches
        if (title.includes(lowerQuery)) score += 50;

        for (const word of queryWords) {
            if (title.includes(word)) score += 20;
            const matches = (cleanContent.match(new RegExp(word, "g")) || []).length;
            score += Math.min(matches, 10);
        }

        // Boost "Introduction" or "Getting Started" for generic queries
        if (isGeneric && (slug.includes("introduction") || slug.includes("quick-start"))) {
            score += 30;
        }

        return {
            title: data.title || slug,
            content: content.slice(0, 3000), // Increase limit to 3000 chars per doc
            slug,
            score,
        };
    });

    return scored
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, effectiveLimit)
        .map(({ title, content, slug }) => ({ title, content, slug }));
}

const SYSTEM_PROMPT = `You are Cencori AI, an expert on the Cencori platform. You help users understand its features, API, and SDK.

When answering:
- Be concise but thorough.
- Use markdown for code blocks and lists.
- Answer based ONLY on the provided documentation context.
- If the context doesn't contain the answer, say so politely.

Relevant documentation will be provided below.`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, currentPage } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: "Messages are required" }, { status: 400 });
        }

        const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").pop();
        if (!lastUserMessage) {
            return NextResponse.json({ error: "No user message found" }, { status: 400 });
        }

        // Search for relevant docs
        const relevantDocs = searchDocs(lastUserMessage.content, 6); // Fetch top 6 docs

        let context = "";
        if (relevantDocs.length > 0) {
            context = "\n\n=== RELEVANT DOCUMENTATION ===\n";
            for (const doc of relevantDocs) {
                context += `\n--- PAGE: ${doc.title} (/docs/${doc.slug}) ---\n${doc.content}\n`;
            }
            context += "\n=== END DOCUMENTATION ===\n";
        }

        // Add current page context if provided
        if (currentPage) {
            context += `\n\nThe user is currently viewing: ${currentPage}`;
        }

        // Initialize OpenAI client with Groq base URL
        const openai = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });

        // Create streaming response
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const chatMessages = [
                        { role: "system" as const, content: SYSTEM_PROMPT + context },
                        ...messages.map((m: { role: string; content: string }) => ({
                            role: m.role as "user" | "assistant",
                            content: m.content,
                        })),
                    ];

                    const response = await openai.chat.completions.create({
                        model: "llama-3.3-70b-versatile",
                        messages: chatMessages,
                        stream: true,
                        max_tokens: 1000,
                        temperature: 0.7,
                    });

                    for await (const chunk of response) {
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                        }
                    }

                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                } catch (error) {
                    console.error("[Docs AI] Error:", error);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (error) {
        console.error("[Docs AI] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
