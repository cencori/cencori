import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddedAgentsDashboard } from "./EmbeddedAgentsDashboard";

const harness = vi.hoisted(() => ({
    workspace: null as unknown,
    invalidate: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: harness.workspace, isLoading: false, isError: false }),
    useQueryClient: () => ({ invalidateQueries: harness.invalidate }),
}));
vi.mock("@/lib/hooks/useQueries", () => ({
    useProjectIdBySlug: () => ({ data: "project-1", isLoading: false }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { success: harness.toastSuccess } }));
vi.mock("./ModelSelect", () => ({
    ModelSelect: ({ value }: { value: string }) => <span>{value}</span>,
}));
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
            config_json: { model: "maximo-atlas-1.2", instructions: "Be helpful." },
            last_tested_at: lastTestPassed ? "2026-09-25T00:00:00.000Z" : null,
            last_test_passed: lastTestPassed, published_at: null,
            created_at: "2026-09-25T00:00:00.000Z",
        }],
        tenants: [], installations: [], runs: [],
        models: [{ id: "maximo-atlas-1.2", name: "Maximo Atlas 1.2", provider: "maximo" }],
    };
}

describe("EmbeddedAgentsDashboard test conversation", () => {
    beforeEach(() => {
        Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
        harness.workspace = workspace();
        harness.toastSuccess.mockReset();
        harness.invalidate.mockReset();
        harness.invalidate.mockImplementation(async () => {
            harness.workspace = workspace(true);
        });
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
            configurable: true, value: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps the AI reply visible when the test status refetches, without a success toast", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({ output: "Your trial ends on October 8." }),
        })));

        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        try {
            await act(async () => {
                root.render(<EmbeddedAgentsDashboard orgSlug="arcie" projectSlug="test" />);
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
            expect([...container.querySelectorAll("button")].some((button) => button.textContent?.includes("Publish"))).toBe(true);
            expect(container.textContent).toContain("When does my trial end?");
            expect(container.textContent).toContain("Your trial ends on October 8.");
            expect(harness.toastSuccess).not.toHaveBeenCalledWith("Test passed", expect.anything());
        } finally {
            await act(async () => root.unmount());
            container.remove();
        }
    });
});
