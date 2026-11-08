import { RENDER_UI_TOOL_NAME } from '@/lib/gateway/render-ui-tool';

/**
 * Stored agents (/v1/agents) keep widgets as 'render_ui' in their tools list,
 * so turning it on needs no schema change. These convert between that and the
 * API's `widgets` flag.
 */
export function withWidgets(tools: string[], on: boolean): string[] {
    const rest = tools.filter((t) => t !== RENDER_UI_TOOL_NAME);
    return on ? [...rest, RENDER_UI_TOOL_NAME] : rest;
}

export function presentAgentTools(tools: string[] | null | undefined): { tools: string[]; widgets: boolean } {
    const list = tools ?? [];
    return { tools: list.filter((t) => t !== RENDER_UI_TOOL_NAME), widgets: list.includes(RENDER_UI_TOOL_NAME) };
}
