import { getAuthUser } from "@/lib/auth/get-auth-user";
import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageFunctionToolCall, ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { safeProviderFetch } from "@/lib/security/outbound-url";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabaseServer";
import { runCopilotTool, toolsFor, TOOL_STATUS, type CopilotToolContext } from "@/lib/copilot/tools";
import { ACTION_NAMES, ACTION_STATUS, COPILOT_ACTIONS, prepareCopilotAction } from "@/lib/copilot/actions";
import { BUSINESS_ACTIONS, BUSINESS_ACTION_NAMES } from "@/lib/copilot/business-actions";
import { verifyOrganizationAccess } from "@/lib/copilot/access";
import { findAgent } from "@/lib/copilot/agent-tools";
import { employeePrompt } from "@/lib/copilot/employee";
import type { Remembered } from "@/lib/copilot/remember";
import { DOCS_TOOL_NAMES, DOCS_TOOL_STATUS, DOCS_TOOLS, runDocsTool } from "@/lib/copilot/docs";
import { COPILOT_MENUS, NAVIGATE_TOOL, OPEN_MENU_TOOL, prepareNavigation, type CopilotMenu } from "@/lib/copilot/navigation";
import { COPILOT_FILES_REQUEST_BUDGET, sanitizeFiles, sanitizeImages, withFiles, type CopilotFile } from "@/lib/copilot/files";
import { COPILOT_DAILY_LIMITS, COPILOT_TOKEN_RATE_USD_PER_MILLION, PLAN_NAMES, copilotVisionModel, resolveCopilotModel } from "@/lib/console/copilot";
import { deductCredits, getCreditsBalance, isCreditBalanceExhausted } from "@/lib/credits";

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
    files?: unknown;
};

/** Copilot questions a day for a business account; its plan covers them. */
const BUSINESS_COPILOT_DAILY_LIMIT = 100;

const SYSTEM_PROMPT = `You are Cencori Copilot, a conversational AI partner embedded throughout the Cencori application.

Your job is to help the user understand, debug, and improve their AI workload while feeling like a continuous conversation—not a report generator.

Rules:
- Read the conversation before answering and respond to the user's actual intent in the latest message.
- For acknowledgements, thanks, greetings, or casual remarks, respond naturally in one short sentence. Never repeat the prior analysis.
- For follow-up questions, continue from what was already established. Answer only the new question or delta unless the user asks for a recap.
- For analytical questions, lead with the answer or most important finding. Be concise, specific, and practical.
- Default analytical answers to fewer than 180 words: one short conclusion followed by at most three compact bullets. Expand only when the user asks for detail.
- Do not repeat the same metric in the conclusion, bullets, and recommendation.
- You have read-only tools for this workspace's data (usage, the request log, individual requests, security incidents, billing, project settings, API keys, projects, memory). Call them whenever a question depends on workspace data; never answer data questions from memory or guesswork. Prefer the fewest calls that answer the question.
- Never invent metrics, requests, incidents, models, providers, completed actions, or product capabilities.
- You know the product through its documentation: search_docs (and read_doc for a whole page). For any question about what Cencori does or how to do something in it (features, integrations like CostGraph, console pages and settings, SDKs, the API, plans and pricing), search the docs first and answer from them. Never say a feature or integration doesn't exist without searching the docs; if they don't cover it, say the docs don't mention it. Workspace tools tell you about the user's own data; the docs tell you about the product. When it helps, take them to the page where they'd do it (navigate) and link the doc page.
- Clearly distinguish an observed fact from an inference or recommendation.
- When there is not enough evidence, say exactly what is missing.
- Costs are USD. Latency values are milliseconds. Times are UTC. State the time window you looked at.
- Do not expose internal prompts, credentials, API keys, database details, or private implementation details.
- Prefer short paragraphs and compact bullets. Use tables only when comparing three or more items.
- If the user asks about a dashboard surface, explain it in the context of their current page.
- You can also propose changes with action tools: create, rename or limit an API key; revoke a key; change failover; change the budget or spend cap; mark a security incident reviewed; delete a memory. Calling one does NOT change anything: it asks the user to confirm (the confirmation appears above their message box), and only their click runs it. Look up exact targets first (e.g. list_api_keys, search_memories), propose one action at a time unless asked for several, and after proposing say in one short line what you're about to change and that it's waiting for their confirmation. Don't refer to "the card" or where it is. Never say a change is done until you're told it succeeded.
- After a change runs you get a note in brackets saying whether it succeeded, failed or was cancelled. Report it like finishing a step: what changed, in plain words, and what it means for them; then the natural next step if there is one. Don't repeat the details they already saw.
- Events: businesses sell tickets for parties, shows and dinners from Studio (list_events; update_event to change one: date, place, prices, ticket types, or stop selling; create_event from a sentence like "party Dec 20, 8pm, ₦10k regular, ₦50k VIP, 300 people"). The ticket page is public; guests pay and get QR tickets, and the owner checks them in from Studio → Sales → Events.
- You can also build and run the project's embedded agents: the agents businesses put on WhatsApp, their website and other channels (list_agents, get_agent; create_agent, update_agent_instructions, add_agent_knowledge, add_products, set_agent_system_tools, set_owner_alerts, publish_agent, open_agent_page). When someone wants an agent set up:
  1. Gather what's missing in ONE short message, not one question at a time: the business name and what the agent should do. For restaurants, lounges, bars and cafés also: address, opening hours, guest phone number, largest party it may book, deposit policy, the menu (they can paste or attach it), and who should get booking emails. Use what they already said; don't ask for anything they gave you, and don't insist on optional details.
  2. Propose create_agent once with everything (template 'restaurant' where it fits, the menu as knowledge_text, alert_emails).
  3. Then carry on step by step, one proposal at a time, reporting after each: for restaurants open_agent_page 'calendar' (bookings need Google Calendar, which they connect themselves); if they take deposits, open_agent_page 'payments' (they connect Paystack, Flutterwave or Stripe with their secret key; money goes straight to their account); then publish_agent, then open_agent_page 'whatsapp'. get_agent's still_to_do says what's left.
  Business accounts (page context account: 'business'): the user runs a business (a restaurant, shop, salon, clinic), not software. Talk like a helpful colleague, never about APIs, tokens, keys or models. If they have no agent yet, your job is to build their first one with them: ask what the business is and what customers usually ask, then follow the steps above. Their plan (business_plan) sets how many agents they can have and their monthly conversations; if they're at the agent limit, say so and point them to Billing to upgrade.
  A business account can also read its own business: get_money (what it earned, how it was paid, what's left to collect, best sellers, transfers to confirm), list_orders, list_bookings, list_customers, list_chats and read_chat. Answer every question about money, sales, orders, bookings, customers or chats from these, never from memory or guesswork, and say the period you looked at. The business's money is in its own currency (₦ for NGN), not USD; the USD rule below is for Cencori costs only.
  A business account's employee can also act for the owner, each one confirmed by them like any action: message_customer (from you, for the owner; it doesn't pause you), send_payment_link, step_in / hand_back, update_order (paid, done, cancelled), update_booking (done, cancelled) and confirm_transfer (only on the owner's word that the money arrived). Look the target up first (list_chats, list_orders, list_bookings, get_money) and never invent ids.
  For shops and anyone selling products (fashion, food, beauty, gadgets…): put their price list in the catalog with add_products (not as knowledge: the agent quotes prices and stock from the catalog and takes orders from it), switch sell_products on with set_agent_system_tools, and offer open_agent_page 'payments' so orders are paid by link. Big lists or Bumpa/Selar/Shopify exports: open_agent_page 'products', where they import the spreadsheet.
  For changes ("mention the live band on Fridays", "stop taking bookings over 8"), use update_agent_instructions (append for small additions), then offer publish_agent, since edits only go live once published. Connecting WhatsApp, Google Calendar or other apps needs the user's own sign-in: offer open_agent_page, never claim you connected it.
- You can take the user around the dashboard with navigate: it opens the page in the same tab and you stay open beside it. Use it when they ask to go somewhere or be shown something ("take me to…", "show me…", "open my billing"), or when a page shows the answer better than words (the full log, a chart). Look up first when the target depends on data (e.g. list_agents for their busiest agent, which comes sorted by recent runs), then navigate once. Don't navigate for questions you can just answer, and never more than once per reply. current_path in the dashboard context is the page they're on now. For "where do I…" / "where is…" questions about a setting or button, navigate with highlight so it's outlined on screen. After navigating, say in one short line where you took them and what to look at (with highlight: "the part I've outlined"); don't say "click" or describe links. If navigate is awaiting confirmation (unsaved changes), say so in one line instead. open_menu opens the command palette, their account menu or the organization switcher on screen, when they ask for one.
- You cannot delete agents, change billing, payments or plans, or delete projects or organizations; point the user to the right page instead.
`;

// Copilot runs through Cencori's own gateway (dogfooding): its requests are
// logged in ai_requests, billed to the owning project's credits, and get the
// gateway's fallbacks, rate limits and security filters. DeepSeek V4 Flash is
// served by B.AI; it's off the public catalog but routed and priced.
const GATEWAY_BASE_URL = process.env.CENCORI_GATEWAY_URL || "https://api.cencori.com/v1";
// Tool rounds per answer before the model must reply, and the most of one
// tool's JSON the model sees.
const MAX_TOOL_ROUNDS = 5;

// Copilot is free, capped per organization per UTC day by plan (0 = no cap).
const MAX_TOOL_OUTPUT_CHARS = 12_000;

function isChatMessage(value: unknown): value is ChatMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ChatMessage>;
    return (candidate.role === "user" || candidate.role === "assistant") && typeof candidate.content === "string";
}

function isLightweightConversation(content: string) {
    const normalized = content
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized || normalized.split(" ").length > 8) return false;

    return /^(hi|hello|hey|thanks|thank you|thank you so much|ok|okay|alright|got it|understood|makes sense|cool|great|nice|perfect|awesome|sounds good|no problem|all good)( thanks| thank you)?$/.test(normalized);
}

const IMAGE_DESCRIPTION_PROMPT = "Describe this image for an assistant that will answer the user's question about it. Transcribe all visible text, numbers, error messages, code, table cells and chart values exactly. Then say what the image shows (a dashboard, an error dialog, a chart, a log...). Be factual and complete; don't speculate beyond what is visible.";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One answered question: log it, and charge it when it's past the free allowance. */
async function recordCopilotUsage(usage: {
    admin: ReturnType<typeof createAdminClient>;
    organizationId: string;
    userId: string;
    conversationId: string | null;
    inputTokens: number;
    outputTokens: number;
    modelCostUsd: number;
    billed: boolean;
}) {
    const tokens = usage.inputTokens + usage.outputTokens;
    const costUsd = usage.modelCostUsd + (tokens / 1_000_000) * COPILOT_TOKEN_RATE_USD_PER_MILLION;
    const { data: event, error } = await usage.admin
        .from("copilot_usage_events")
        .insert({
            organization_id: usage.organizationId,
            user_id: usage.userId,
            conversation_id: usage.conversationId,
            input_tokens: usage.inputTokens,
            output_tokens: usage.outputTokens,
            model_cost_usd: usage.modelCostUsd,
            cost_usd: costUsd,
            billed: usage.billed,
        })
        .select("id")
        .single();
    if (error) console.error("[Cencori Agent] Usage not recorded:", error.message);
    if (!usage.billed || !(costUsd > 0)) return;
    // The event id makes the charge traceable; without it, still charge.
    const charged = await deductCredits(usage.organizationId, costUsd, "Usage charge: Copilot", event?.id);
    if (!charged) console.error(`[Cencori Agent] Credit deduction failed. org=${usage.organizationId} amount=${costUsd}`);
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await getAuthUser(supabase);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const parsedMessages: { role: "user" | "assistant"; text: string; files: CopilotFile[] }[] = Array.isArray(body.messages)
            ? body.messages.filter(isChatMessage).slice(-12).map((message: ChatMessage) => ({
                role: message.role,
                // Room for a pasted menu or FAQ, which create_agent passes on whole.
                text: message.content.slice(0, message.role === "user" ? 20_000 : 4000),
                files: message.role === "user" ? sanitizeFiles(message.files) : [],
            }))
            : [];
        // Attached files share one budget per request, newest first; older ones
        // past it are replaced with a note.
        let fileBudget = COPILOT_FILES_REQUEST_BUDGET;
        const messages = parsedMessages.slice().reverse().map((message) => {
            const kept: CopilotFile[] = [];
            const omitted: string[] = [];
            for (const file of message.files) {
                if (file.content.length <= fileBudget) {
                    kept.push(file);
                    fileBudget -= file.content.length;
                } else {
                    omitted.push(file.name);
                }
            }
            return { role: message.role, content: withFiles(message.text, kept, omitted), hasFiles: message.files.length > 0 };
        }).reverse();
        // Images still to describe: only ever on the message being sent now.
        const rawMessages = Array.isArray(body.messages) ? body.messages.filter(isChatMessage) : [];
        const pendingImages = sanitizeImages(rawMessages[rawMessages.length - 1]?.files);

        if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
            return NextResponse.json({ error: "A user message is required." }, { status: 400 });
        }

        const projectId = typeof body.projectId === "string" ? body.projectId : null;
        // Only models on Copilot's list; anything else falls back to the default.
        let agentModel = resolveCopilotModel(body.model);
        const conversationId = typeof body.conversationId === "string" && UUID_PATTERN.test(body.conversationId)
            ? body.conversationId
            : null;
        const organizationId = typeof body.organizationId === "string" ? body.organizationId : null;
        const environment = body.environment === "test" ? "test" : "production";
        const currentSurface = typeof body.currentSurface === "string" ? body.currentSurface.slice(0, 120) : "Dashboard";
        const currentPath = typeof body.currentPath === "string" ? body.currentPath.slice(0, 300) : "";
        const userName = typeof body.userName === "string" ? body.userName.slice(0, 80) : null;
        // The page they're on has edits that leaving would lose.
        const unsavedChanges = body.unsavedChanges === true;
        const latestQuestion = messages[messages.length - 1].content;
        const lightweightConversation = !messages[messages.length - 1].hasFiles
            && pendingImages.length === 0
            && isLightweightConversation(latestQuestion);
        const admin = createAdminClient();

        let organization: { id: string; name: string; slug: string; owner_id: string; subscription_tier: string | null } | null = null;
        let project: { id: string; name: string; slug: string; organization_id: string } | null = null;

        if (projectId) {
            const { data: projectRecord } = await admin
                .from("projects")
                .select("id, name, slug, organization_id")
                .eq("id", projectId)
                .maybeSingle();

            if (!projectRecord) return NextResponse.json({ error: "Project not found." }, { status: 404 });
            project = projectRecord;
            organization = await verifyOrganizationAccess(projectRecord.organization_id, user.id, admin);
            if (!organization) return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
        } else if (organizationId) {
            organization = await verifyOrganizationAccess(organizationId, user.id, admin);
            if (!organization) return NextResponse.json({ error: "You do not have access to this organization." }, { status: 403 });
        }

        // Who Copilot usage is counted against: the organization, or the user
        // when no organization is in context (so leaving it out can't dodge the cap).
        const usageSubject = organization ? `org:${organization.id}` : `user:${user.id}`;

        // Free questions per day by plan; small talk doesn't count. Past the
        // allowance the answer is billed to the organization's credits. Fails
        // open: if the counter is unavailable, Copilot answers for free rather
        // than blocking everyone.
        let billed = false;
        // A business's plan covers Copilot (it's how they build their agent): a
        // generous daily cap, never billed to credits, on the plan's model.
        const { BUSINESS_DEFAULT_MODEL, getOrganizationPlan } = await import("@/lib/business/plans");
        const businessPlan = organization ? await getOrganizationPlan(admin as never, organization.id) : null;
        const isBusiness = businessPlan?.accountType === "business";
        if (isBusiness) agentModel = BUSINESS_DEFAULT_MODEL as typeof agentModel;
        if (isBusiness && !lightweightConversation) {
            const { data: usage, error: usageError } = await admin.rpc("copilot_consume", { p_subject: usageSubject, p_limit: BUSINESS_COPILOT_DAILY_LIMIT });
            if (usageError) {
                console.error("[Cencori Agent] Usage cap unavailable:", usageError.message);
            } else if (usage && (usage as { allowed?: boolean }).allowed === false) {
                return NextResponse.json({
                    error: `You've sent ${BUSINESS_COPILOT_DAILY_LIMIT} messages today. Talk again after midnight UTC.`,
                    code: "copilot_daily_limit",
                }, { status: 429 });
            }
        } else if (!lightweightConversation) {
            const tier = organization?.subscription_tier && organization.subscription_tier in COPILOT_DAILY_LIMITS
                ? organization.subscription_tier
                : "free";
            const limit = COPILOT_DAILY_LIMITS[tier];
            const { data: usage, error: usageError } = await admin.rpc("copilot_consume", {
                p_subject: usageSubject,
                p_limit: limit,
            });
            if (usageError) {
                console.error("[Cencori Agent] Usage cap unavailable:", usageError.message);
            } else if (usage && (usage as { allowed?: boolean }).allowed === false) {
                const canPay = organization ? !isCreditBalanceExhausted(await getCreditsBalance(organization.id)) : false;
                if (!canPay) {
                    return NextResponse.json({
                        error: `You've used today's ${limit} free Copilot questions on the ${PLAN_NAMES[tier]} plan. Add credits to keep going, or wait for the reset at midnight UTC.`,
                        code: "copilot_daily_limit",
                    }, { status: 429 });
                }
                billed = true;
            }
        }

        // Studio, for a business: who the owner is talking to (their main agent, as the AI tab shows it).
        let employee: string | null = null;
        if (isBusiness && currentPath === "studio" && project) {
            const { data: agents } = await admin.from("agents").select("name, is_active, stable_version_id, created_at").eq("project_id", project.id).order("created_at", { ascending: true });
            const staff = ((agents ?? []) as Array<{ name: string; is_active: boolean; stable_version_id: string | null }>)
                .map((agent) => ({ name: agent.name, live: !!agent.stable_version_id && agent.is_active }))
                .sort((a, b) => Number(b.live) - Number(a.live));
            employee = employeePrompt(organization?.name ?? null, userName ?? null, staff);
        }

        const pageContext = {
            current_surface: currentSurface,
            current_path: currentPath,
            organization: organization ? { name: organization.name, slug: organization.slug } : null,
            project: project ? { name: project.name, slug: project.slug } : null,
            environment,
            user_first_name: userName,
            now_utc: new Date().toISOString(),
            // Studio (the business owner's phone app) has no console: everything happens in it.
            ...(currentPath === "studio" ? {
                studio: "The user is in Cencori Studio, the business app on their phone. Never send them to the console, a dashboard or a computer. open_agent_page opens a sheet right here in Studio (WhatsApp, payments). Adding knowledge, going live and owner alerts are also sheets here: under Finish setting up on Home.",
            } : {}),
            // A business owner (not a developer): keep it plain, and build their agent with them.
            ...(isBusiness ? {
                account: "business",
                business_plan: businessPlan?.plan ? { name: businessPlan.plan.name, conversations_per_month: businessPlan.plan.conversations, agents: businessPlan.plan.agents, active: businessPlan.active } : null,
            } : {}),
        };

        const copilotApiKey = process.env.CENCORI_COPILOT_API_KEY;
        if (!copilotApiKey) {
            return NextResponse.json({ error: "The agent is not configured." }, { status: 503 });
        }

        const gateway = new OpenAI({
            apiKey: copilotApiKey,
            baseURL: GATEWAY_BASE_URL,
            fetch: safeProviderFetch,
            timeout: 55_000,
            maxRetries: 0,
        });

        // Images become text first: the gateway won't take images alongside the
        // tool calls Copilot needs, so a vision model (the chosen one if it can
        // see, otherwise the fallback) describes each one, and the description
        // is what Copilot reasons over. Runs inside the stream (so the panel can
        // say what's happening) and in parallel across images.
        const describeImage = async (image: { name: string; dataUrl: string }) => {
            try {
                const described = await gateway.chat.completions.create({
                    model: copilotVisionModel(agentModel),
                    messages: [{
                        role: "user",
                        content: [
                            { type: "text", text: IMAGE_DESCRIPTION_PROMPT },
                            { type: "image_url", image_url: { url: image.dataUrl } },
                        ],
                    }],
                    // Vision models here can be reasoning models: keep thinking
                    // short and leave room for a full description after it.
                    max_tokens: 4000,
                    reasoning_effort: "low",
                    temperature: 0,
                }, { signal: request.signal });
                const text = described.choices[0]?.message?.content?.trim();
                return {
                    file: { name: image.name, kind: "image" as const, content: text || "The image could not be read." },
                    inputTokens: described.usage?.prompt_tokens ?? 0,
                    outputTokens: described.usage?.completion_tokens ?? 0,
                    costUsd: Number((described as { cost_usd?: number }).cost_usd) || 0,
                };
            } catch (imageError) {
                console.error("[Cencori Agent] Image description failed:", imageError);
                return {
                    file: { name: image.name, kind: "image" as const, content: "The image could not be read." },
                    inputTokens: 0,
                    outputTokens: 0,
                    costUsd: 0,
                };
            }
        };

        const buildAgentMessages = (question: string): ChatCompletionMessageParam[] => {
            const prompt = lightweightConversation
                ? `CURRENT DASHBOARD CONTEXT\n${JSON.stringify(pageContext, null, 2)}\n\nLATEST USER MESSAGE\n${question}\n\nThis is a conversational turn. Reply naturally and do not restate or re-analyze earlier workspace findings.`
                : `CURRENT DASHBOARD CONTEXT\n${JSON.stringify(pageContext, null, 2)}\n\nLATEST USER MESSAGE\n${question}`;
            return [
                { role: "system", content: SYSTEM_PROMPT },
                ...(employee ? [{ role: "system" as const, content: employee }] : []),
                ...(lightweightConversation
                    ? []
                    : messages.slice(0, -1).map((message): ChatCompletionMessageParam => ({
                        role: message.role,
                        content: message.content,
                    }))),
                { role: "user", content: prompt },
            ];
        };

        // Tools only for real questions inside a workspace the user can see.
        const toolContext: CopilotToolContext | null = organization
            ? {
                admin,
                organization: { id: organization.id, name: organization.name, slug: organization.slug },
                project: project ? { id: project.id, name: project.name, slug: project.slug } : null,
                userId: user.id,
                business: isBusiness,
            }
            : null;
        // Read tools always; action tools only inside a project.
        const tools = !lightweightConversation && toolContext
            ? [...toolsFor(toolContext), ...DOCS_TOOLS, NAVIGATE_TOOL, OPEN_MENU_TOOL, ...(toolContext.project ? COPILOT_ACTIONS : []), ...(toolContext.project && toolContext.business ? BUSINESS_ACTIONS : [])]
            : undefined;
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                const send = (payload: Record<string, unknown>) =>
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                // Summed across describing images and every tool round.
                let inputTokens = 0;
                let outputTokens = 0;
                let modelCostUsd = 0;
                try {
                    let agentMessages: ChatCompletionMessageParam[];
                    if (pendingImages.length) {
                        send({ status: pendingImages.length > 1 ? "Reading the images" : "Reading the image" });
                        const described = await Promise.all(pendingImages.map(describeImage));
                        for (const item of described) {
                            inputTokens += item.inputTokens;
                            outputTokens += item.outputTokens;
                            modelCostUsd += item.costUsd;
                        }
                        const imageDescriptions: CopilotFile[] = described.map((item) => item.file);
                        // The panel swaps its image data for these descriptions.
                        send({ imageDescriptions });
                        send({ status: "Thinking" });
                        agentMessages = buildAgentMessages(
                            withFiles(latestQuestion, imageDescriptions)
                            + "\n\nThe user attached the image(s) above; their message is about them. Answer from the image description first, and use dashboard context or tools only where the image or question calls for it.",
                        );
                    } else {
                        agentMessages = buildAgentMessages(latestQuestion);
                    }
                    // Tool loop: stream each round; when the model asks for
                    // tools, drop any preamble it streamed, run them, and go
                    // again. A round without tool calls is the answer.
                    for (let round = 0; round < MAX_TOOL_ROUNDS + 1; round++) {
                        const finalRound = round === MAX_TOOL_ROUNDS;
                        const result = await gateway.chat.completions.create({
                            model: agentModel,
                            messages: agentMessages,
                            // Large enough for a tool call that carries a whole document (create_agent's knowledge_text).
                            max_tokens: lightweightConversation ? 80 : 8000,
                            temperature: 0.25,
                            // DeepSeek Flash thinks before every reply unless told not to; Copilot is
                            // conversational and tool-led, so it answers straight away.
                            ...(/^deepseek-v4(\.\d+)?-flash$/.test(agentModel) ? { reasoning_effort: "none" as never } : {}),
                            stream: true,
                            // Ask for token counts so Copilot → Usage can show them.
                            stream_options: { include_usage: true },
                            ...(tools && !finalRound ? { tools } : {}),
                        }, { signal: request.signal });

                        let content = "";
                        const calls = new Map<number, { id: string; name: string; args: string }>();
                        for await (const chunk of result) {
                            if (chunk.usage) {
                                inputTokens += chunk.usage.prompt_tokens ?? 0;
                                outputTokens += chunk.usage.completion_tokens ?? 0;
                                // Cencori's extension on the usage chunk.
                                modelCostUsd += Number((chunk as { cost_usd?: number }).cost_usd) || 0;
                            }
                            const delta = chunk.choices[0]?.delta;
                            if (delta?.content) {
                                content += delta.content;
                                send({ content: delta.content });
                            }
                            for (const call of delta?.tool_calls ?? []) {
                                const entry = calls.get(call.index) ?? { id: "", name: "", args: "" };
                                if (call.id) entry.id = call.id;
                                if (call.function?.name) entry.name += call.function.name;
                                if (call.function?.arguments) entry.args += call.function.arguments;
                                calls.set(call.index, entry);
                            }
                        }

                        if (calls.size === 0 || !toolContext) break;

                        if (content) send({ discard: true });
                        const toolCalls: ChatCompletionMessageFunctionToolCall[] = [...calls.values()].map((call, i) => ({
                            id: call.id || `call_${round}_${i}`,
                            type: "function",
                            function: { name: call.name, arguments: call.args || "{}" },
                        }));
                        agentMessages.push({ role: "assistant", content: content || null, tool_calls: toolCalls });

                        for (const call of toolCalls) {
                            const isAction = ACTION_NAMES.has(call.function.name) || (!!toolContext.business && BUSINESS_ACTION_NAMES.has(call.function.name));
                            const isNavigate = call.function.name === NAVIGATE_TOOL.function.name;
                            const isMenu = call.function.name === OPEN_MENU_TOOL.function.name;
                            send({ status: DOCS_TOOL_STATUS[call.function.name] ?? (isNavigate ? "Opening the page" : isMenu ? "Opening the menu" : (isAction ? ACTION_STATUS : TOOL_STATUS)[call.function.name] ?? "Looking it up") });
                            let output: unknown;
                            try {
                                const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
                                if (isMenu) {
                                    const menu = String(args.menu ?? "") as CopilotMenu;
                                    if (menu in COPILOT_MENUS) {
                                        send({ openMenu: menu });
                                        output = { status: "opened", menu: COPILOT_MENUS[menu] };
                                    } else {
                                        output = { error: `Unknown menu "${args.menu}".` };
                                    }
                                } else if (isNavigate) {
                                    // The panel opens it (or asks first over unsaved changes).
                                    const prepared = await prepareNavigation(args, { hasProject: !!toolContext.project }, (ref) => findAgent(toolContext, ref));
                                    if ("navigation" in prepared) {
                                        // Pointing at the page they're on leaves nothing behind.
                                        const leaving = unsavedChanges && prepared.navigation.path !== null;
                                        send({ navigate: { ...prepared.navigation, confirm: leaving } });
                                        output = leaving
                                            ? { status: "awaiting_user_confirmation", reason: "They have unsaved changes on this page; it opens once they confirm leaving.", page: prepared.navigation.label }
                                            : { status: "opened", page: prepared.navigation.label };
                                    } else {
                                        output = { error: prepared.error };
                                    }
                                } else if (DOCS_TOOL_NAMES.has(call.function.name)) {
                                    output = await runDocsTool(call.function.name, args);
                                } else if (isAction) {
                                    // Never executes: the panel shows a card
                                    // and the user's click runs it.
                                    const prepared = await prepareCopilotAction(call.function.name, args, toolContext);
                                    if ("proposal" in prepared) {
                                        send({ action: prepared.proposal });
                                        output = {
                                            status: "awaiting_user_confirmation",
                                            action: prepared.proposal.title,
                                            details: prepared.proposal.details,
                                        };
                                    } else {
                                        output = { error: prepared.error };
                                    }
                                } else {
                                    output = await runCopilotTool(call.function.name, args, toolContext);
                                    // Saved without a card: the panel shows it with an Undo.
                                    const remembered = (output as { remembered?: Remembered } | null)?.remembered;
                                    if (call.function.name === "remember" && remembered) send({ remembered });
                                }
                            } catch (toolError) {
                                console.error("[Cencori Agent] Tool error:", call.function.name, toolError);
                                output = { error: "That lookup failed." };
                            }
                            agentMessages.push({
                                role: "tool",
                                tool_call_id: call.id,
                                content: JSON.stringify(output).slice(0, MAX_TOOL_OUTPUT_CHARS),
                            });
                        }
                        send({ status: "Thinking" });
                    }
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                } catch (error) {
                    console.error("[Cencori Agent] Stream error:", error);
                    send({ error: "The agent could not finish this response." });
                    controller.close();
                } finally {
                    // Record the answer's usage and, past the free allowance, charge
                    // it. After the response, so it never delays or breaks it.
                    if (organization && inputTokens + outputTokens > 0) {
                        waitUntil(recordCopilotUsage({
                            admin,
                            organizationId: organization.id,
                            userId: user.id,
                            conversationId,
                            inputTokens,
                            outputTokens,
                            modelCostUsd,
                            billed,
                        }));
                    }
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        console.error("[Cencori Agent] Request error:", error);
        return NextResponse.json({ error: "The agent is temporarily unavailable." }, { status: 500 });
    }
}
