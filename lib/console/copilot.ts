// Cookies that keep Copilot where you left it across refreshes. Read on the
// server by app/(app)/layout.tsx, written by the client when they change.
export const COPILOT_OPEN_COOKIE = "copilot_open";
export const COPILOT_CONVERSATION_COOKIE = "copilot_conversation";

// Slot in the dashboard's top bar that the full-screen Copilot page fills with
// its buttons, so the page has one navbar, not two.
export const COPILOT_HEADER_ACTIONS_SLOT_ID = "copilot-header-actions";

// Copilot questions per organization per UTC day, by plan. 0 = unlimited.
// Small talk ("thanks", "ok") isn't counted. Enforced by copilot_consume().
export const COPILOT_DAILY_LIMITS: Record<string, number> = {
    free: 10,
    pro: 50,
    team: 100,
    enterprise: 0,
};
export const PLAN_NAMES: Record<string, string> = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" };

// Fired on window whenever the open Copilot conversation changes (detail: id
// or null), so the sidebar's recent-chats list can highlight it.
export const COPILOT_CONVERSATION_EVENT = "copilot:conversation";

// Fired on window to start a fresh conversation in the full-screen Copilot page
// (the sidebar's "New chat" while that page is already open).
export const COPILOT_NEW_CHAT_EVENT = "copilot:new-chat";

// Past the free daily questions, a Copilot answer is billed to the
// organization's credits at the model's inference cost plus this flat rate per
// million tokens (input + output), the same rate Vercel Agent uses.
export const COPILOT_TOKEN_RATE_USD_PER_MILLION = 0.25;

// Models Copilot can answer with. The server only accepts these ids; each needs
// tool calling, since Copilot looks things up with tools. Past the free daily
// questions, an answer is billed at its model's cost plus the flat token rate.
export const COPILOT_MODELS = [
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "deepseek", vision: false },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic", vision: true },
    { id: "gpt-6-sol", label: "GPT-6", provider: "openai", vision: true },
    { id: "moonshotai/kimi-k2.6", label: "Kimi K2.6", provider: "moonshot", vision: false },
] as const;
export type CopilotModelId = (typeof COPILOT_MODELS)[number]["id"];
export const COPILOT_DEFAULT_MODEL: CopilotModelId = "deepseek-v4-flash";

/**
 * Reads attached images when the chosen model can't. The gateway's vision path
 * only knows OpenAI, Anthropic, Google and a few partner models, so DeepSeek
 * and Kimi hand images to this one for the description step. Atlas 1.5 takes
 * image input and is among the cheapest priced vision models.
 */
export const COPILOT_VISION_FALLBACK_MODEL = "maximo-atlas-1.5";

export function copilotVisionModel(model: CopilotModelId): string {
    return COPILOT_MODELS.find((item) => item.id === model)?.vision ? model : COPILOT_VISION_FALLBACK_MODEL;
}

export function resolveCopilotModel(value: unknown): CopilotModelId {
    return COPILOT_MODELS.some((model) => model.id === value) ? (value as CopilotModelId) : COPILOT_DEFAULT_MODEL;
}

// Top-bar slot an agent's pages fill with their Test / Publish buttons, so
// agent pages keep the one shared navbar.
export const AGENT_HEADER_ACTIONS_SLOT_ID = "agent-header-actions";

// Fired on window when the full-screen Copilot shrinks back to the panel
// (detail: the conversation id and its messages), so the panel carries on
// with the same chat instead of the one it had before.
export const COPILOT_HANDOFF_EVENT = "copilot:handoff";

// Fired on window when Copilot opens a piece of the dashboard's UI for the
// user (detail: a CopilotMenu, see lib/copilot/navigation.ts).
export const COPILOT_OPEN_MENU_EVENT = "copilot:open-menu";

// Fired on window to outline a part of the page Copilot is pointing at
// (detail: { selector, label }). See components/dashboard/CopilotSpotlight.tsx.
export const COPILOT_HIGHLIGHT_EVENT = "copilot:highlight";
