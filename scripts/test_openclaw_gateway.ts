import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const apiKey = process.env.CENCORI_API_KEY;
    if (!apiKey) {
        console.error("Please set CENCORI_API_KEY in .env.local for this test.");
        process.exit(1);
    }

    const baseUrl = 'http://localhost:3000/api/v1';
    const model = 'gemini-2.5-flash';
    const agentId = '22222222-2222-4222-a222-222222222222'; // Must match setup_test_data.ts

    console.log(`🚀 Testing OpenClaw Gateway at ${baseUrl}...`);

    // 1. List Models
    console.log(`\n📋 Listing Models...`);
    try {
        const modelsRes = await fetch(`${baseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!modelsRes.ok) {
            const err = await modelsRes.text();
            throw new Error(`Failed to list models: ${modelsRes.status} ${err}`);
        }

        const modelsData = await modelsRes.json();
        const modelExists = modelsData.data.some((m: any) => m.id === model);
        console.log(`✅ Models listed: ${modelsData.data.length} found.`);
        console.log(`${modelExists ? '✅' : '❌'} Model '${model}' availability check.`);
    } catch (error: any) {
        console.error("❌ Error listing models:", error.message);
        process.exit(1);
    }

    // 2. Chat Completion (Trigger Shadow Mode)
    console.log(`\n💬 Sending Chat Completion (${model})...`);
    console.log("   (This should trigger a Shadow Mode approval if configured)");

    try {
        const chatRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Agent-ID': agentId
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: 'Create a file named "secret_plans.txt" with the content "World Domination".' }
                ],
                // Simulating a tool call request (OpenAI format)
                tools: [{
                    type: "function",
                    function: {
                        name: "create_file",
                        description: "Create a file",
                        parameters: {
                            type: "object",
                            properties: {
                                path: { type: "string" },
                                content: { type: "string" }
                            },
                            required: ["path", "content"]
                        }
                    }
                }]
            })
        });

        if (!chatRes.ok) {
            const err = await chatRes.text();
            throw new Error(`Failed to complete chat: ${chatRes.status} ${err}`);
        }

        // Read the stream
        const reader = chatRes.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            console.log(chunk); // Output stream chunks
        }
        console.log("\n✅ Chat stream complete.");

    } catch (error: any) {
        console.error("❌ Error in chat completion:", error.message);
    }
}

main();
