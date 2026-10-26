"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { postStudioAction, studioQueryKey, useAgentsBasePath } from "@/components/agents/studio";
import { AgentWidget } from "@/components/agents/AgentWidget";
import { AgentWhatsApp } from "@/components/agents/AgentWhatsApp";
import { AgentOwnerAlerts } from "@/components/agents/AgentOwnerAlerts";

/** Agent settings: the website widget, WhatsApp, owner alerts, and deleting the agent. */
export default function AgentSettingsPage() {
    const { projectId, agent, versions, data, canManage } = useAgentWorkspace();
    const router = useRouter();
    const basePath = useAgentsBasePath();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [confirmName, setConfirmName] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const installs = data.installations.filter((item) => item.agent_id === agent.id).length;
    const matches = confirmName.trim() === agent.name.trim();

    const close = (next: boolean) => {
        if (deleting) return;
        setOpen(next);
        if (!next) { setConfirmName(""); setError(null); }
    };

    const remove = async () => {
        setDeleting(true);
        setError(null);
        try {
            await postStudioAction(projectId, "delete_agent", { agent_id: agent.id });
            // Leave the page before the list refreshes, so it never flashes "agent not found".
            router.replace(basePath);
            toast.success(`${agent.name} deleted`);
            void queryClient.invalidateQueries({ queryKey: studioQueryKey(projectId) });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-base font-medium">Settings</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Manage this agent.</p>
            </header>

            <AgentWidget />

            <AgentWhatsApp />

            <AgentOwnerAlerts />

            <section className="rounded-lg border border-destructive/30">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-medium">Delete agent</h2>
                        <p className="mt-0.5 max-w-lg text-xs leading-5 text-muted-foreground">
                            Permanently deletes {agent.name}, its {versions.length} {versions.length === 1 ? "version" : "versions"}
                            {installs > 0 ? `, ${installs} customer ${installs === 1 ? "install" : "installs"}` : ""}, its documents and its run history. It comes off the marketplace. This can&apos;t be undone.
                        </p>
                    </div>
                    <Button size="sm" className="h-7 shrink-0 text-xs bg-red-600 text-white hover:bg-red-600/90 disabled:opacity-50" onClick={() => setOpen(true)} disabled={!canManage}>
                        Delete agent
                    </Button>
                </div>
                {!canManage && <p className="border-t border-destructive/20 px-4 py-2.5 text-[11px] text-muted-foreground">Only project admins can delete agents.</p>}
            </section>

            <Dialog open={open} onOpenChange={close}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-medium">Delete {agent.name}?</DialogTitle>
                        <DialogDescription className="text-xs leading-5">
                            Customers using it lose access right away. Usage already billed stays in your logs.
                        </DialogDescription>
                    </DialogHeader>
                    <label className="block">
                        <span className="mb-1.5 block text-xs">Type <span className="font-medium text-foreground">{agent.name}</span> to confirm</span>
                        <input
                            value={confirmName}
                            onChange={(event) => setConfirmName(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter" && matches && !deleting) void remove(); }}
                            autoFocus
                            className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground/25 focus-visible:ring-0"
                        />
                    </label>
                    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                    <div className="flex justify-end gap-3 pt-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => close(false)} disabled={deleting}>Cancel</Button>
                        <Button size="sm" className="h-7 gap-1.5 text-xs bg-red-600 text-white hover:bg-red-600/90 disabled:opacity-50" onClick={() => void remove()} disabled={!matches || deleting}>
                            {deleting && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                            Delete agent
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
