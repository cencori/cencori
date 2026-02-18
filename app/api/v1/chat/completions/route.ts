import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { detectProviderFromModel } from "@/lib/providers/config";
import { createAdminClient } from "@/lib/supabaseAdmin"; // Ensure this is imported
import crypto from 'crypto'; // Ensure this is imported



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const createLogAction = async (supabase: any, agentId: string, toolCall: any) => {
    try {
        await supabase.from("agent_actions").insert({
            agent_id: agentId,
            type: "tool_call",
            payload: toolCall,
            status: "executed",
        });
    } catch (e) {
        console.error("Failed to log action", e);
    }
};

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("Authorization");
        const apiKey = req.headers.get('CENCORI_API_KEY')
            || (authHeader?.startsWith('Bearer cencori_') ? authHeader.replace('Bearer ', '').trim() : null);

        let user: any = null;
        let authMethod = 'anon';

        // 1. Authenticate (Dual Mode)
        if (apiKey) {
            // Validate API Key
            const adminClient = createAdminClient();
            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            const { data: keyData, error: keyError } = await adminClient
                .from('api_keys')
                .select('project_id') // Removed user_id as it might be missing in schema
                .eq('key_hash', keyHash)
                .is('revoked_at', null)
                .single();

            if (keyError || !keyData) {
                return new NextResponse("Invalid API Key", { status: 401 });
            }
            // User is not available in API Key auth for now, rely on System Env keys for providers
            authMethod = 'apikey';
        } else if (authHeader) {
            // Validate User Token
            const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } },
            });
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
            if (authError || !authUser) return new NextResponse("Unauthorized", { status: 401 });
            user = authUser;
            authMethod = 'token';
        } else {
            return new NextResponse("Missing Authorization", { status: 401 });
        }

        // Re-initialize supabase client for subsequent DB calls using Admin if API Key, or User Client if Token
        const supabase = authMethod === 'apikey'
            ? createAdminClient()
            : createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader! } } });

        const agentId = req.headers.get("X-Agent-ID");
        if (!agentId) return new NextResponse("Missing X-Agent-ID header", { status: 400 });

        // 3. Get Agent Config
        const { data: config, error: configError } = await supabase
            .from("agent_configs")
            .select("*")
            .eq("agent_id", agentId)
            .single();

        if (configError || !config) {
            return new NextResponse("Agent configuration not found. Create the agent in Cencori first.", { status: 404 });
        }

        // 4. Parse Request Body
        const body = await req.json();
        let { model, messages, stream = false, tools, tool_choice } = body;

        // Force provider detection
        const provider = detectProviderFromModel(model) || 'openai';

        // 3. Routing
        if (provider === 'google') {
            // Gemini Adapter
            const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!; // Fallback

            const genAI = new GoogleGenerativeAI(geminiKey);
            const geminiModel = genAI.getGenerativeModel({ model: model });

            // Convert Messages (simplified)
            const history = messages.slice(0, -1).map((m: any) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
            const lastMessage = messages[messages.length - 1].content;

            const chat = geminiModel.startChat({
                history: history,
            });

            const result = await chat.sendMessageStream(lastMessage);

            const streamResponse = new ReadableStream({
                async start(controller) {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        // Mock OpenAI Chunk format
                        const openaiChunk = {
                            id: "chatcmpl-" + Math.random().toString(36).substr(2, 9),
                            object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model: model,
                            choices: [{
                                index: 0,
                                delta: { content: text },
                                finish_reason: null
                            }]
                        };
                        const sse = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                        controller.enqueue(new TextEncoder().encode(sse));
                    }
                    controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                    controller.close();

                    // Passive Logging (Simulated)
                    if (Array.isArray(tools) && tools.length > 0 && agentId) {
                        createLogAction(supabase, agentId, { tool: "simulated_gemini_action", input: lastMessage }).catch(console.error);
                    }
                }
            });

            return new NextResponse(streamResponse, {
                headers: { "Content-Type": "text/event-stream" }
            });

        } else {
            // OpenAI Default
            let apiKey = process.env.OPENAI_API_KEY;

            const openai = new OpenAI({ apiKey });
            const response = await openai.chat.completions.create({
                model, messages, stream: true, tools, tool_choice
            });

            const streamResponse = new ReadableStream({
                async start(controller) {
                    for await (const chunk of response) {
                        if (chunk.choices[0]?.delta?.tool_calls && agentId) {
                            const toolCall = chunk.choices[0].delta.tool_calls[0];
                            createLogAction(supabase, agentId, toolCall).catch(console.error);
                        }
                        const text = `data: ${JSON.stringify(chunk)}\n\n`;
                        controller.enqueue(new TextEncoder().encode(text));
                    }
                    controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                    controller.close();
                }
            });

            return new NextResponse(streamResponse, {
                headers: { "Content-Type": "text/event-stream" }
            });
        }

    } catch (error: any) {
        console.error("Gateway Error:", error);
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
