import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentWorkspaceProvider, useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { AgentTestPanel } from "@/components/agents/AgentTestPanel";

const harness = vi.hoisted(() => ({
    workspace: null as unknown,
    invalidate: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: harness.workspace, isLoading: false, isError: false }),
    useQueryClient: () => ({ invalidateQueries: harness.invalidate }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/acme/app/agents/agent-1" }));
vi.mock("@/components/ui/toast", () => ({ toast: { success: harness.toastSuccess } }));
vi.mock("@/components/chat/MarkdownRenderer", () => ({
    MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

function workspace(lastTestPassed = false) {
    return {
        can_manage: true,
        studio_ready: true,
        agents: [{
            id: "agent-1", name: "Assistant", description: null, is_active: true,
            stable_version_id: null, created_at: "2026-09-25T00:00:00.000Z",
        }],
        versions: [{
            id: "version-1", agent_id: "agent-1", version: "1.0.0",
            status: lastTestPassed ? "ready_for_review" : "draft",
            config_json: { model: "maximo-atlas-1.3", instructions: "Be helpful." },
            last_tested_at: lastTestPassed ? "2026-09-25T00:00:00.000Z" : null,
            last_test_passed: lastTestPassed, published_at: null,
            created_at: "2026-09-25T00:00:00.000Z",
        }],
        tenants: [], installations: [], runs: [],
        models: [{ id: "maximo-atlas-1.3", name: "Maximo Atlas 1.3", provider: "maximo" }],
    };
}

function PublishState() {
    const { version } = useAgentWorkspace();
    return <span data-testid="passed">{String(version?.last_test_passed)}</span>;
}

describe("agent test panel", () => {
    beforeEach(() => {
        Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
        harness.workspace = workspace();
        harness.toastSuccess.mockReset();
        harness.invalidate.mockReset();
        harness.invalidate.mockImplementation(async () => {
            harness.workspace = workspace(true);
        });
        Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps the reply visible when the test status refetches, without a success toast", async () => {
        // The route streams the reply: delta events, then done.
        const frames = ["Your trial ends ", "on October 8."]
            .map((delta) => `event: delta\ndata: ${JSON.stringify({ delta })}\n\n`)
            .concat("event: done\ndata: {}\n\n");
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            body: new ReadableStream<Uint8Array>({
                start(controller) {
                    for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
                    controller.close();
                },
            }),
        })));

        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        try {
            await act(async () => {
                root.render(
                    <AgentWorkspaceProvider projectId="project-1" agentId="agent-1" fallback={() => null}>
                        <AgentTestPanel onClose={() => {}} />
                        <PublishState />
                    </AgentWorkspaceProvider>,
                );
            });
            const composer = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="Ask this agent to do something its customers would ask..."]');
            expect(composer).not.toBeNull();
            await act(async () => {
                const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
                setValue?.call(composer, "When does my trial end?");
                composer?.dispatchEvent(new Event("input", { bubbles: true }));
            });
            const send = container.querySelector<HTMLButtonElement>('button[aria-label="Send message"]');
            expect(send?.disabled).toBe(false);
            await act(async () => {
                send?.click();
            });

            expect(harness.invalidate).toHaveBeenCalled();
            expect(container.textContent).toContain("When does my trial end?");
            expect(container.textContent).toContain("Your trial ends on October 8.");
            expect(harness.toastSuccess).not.toHaveBeenCalledWith("Test passed", expect.anything());
        } finally {
            await act(async () => root.unmount());
            container.remove();
        }
    });
});
