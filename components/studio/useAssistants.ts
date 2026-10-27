"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStudio } from "@/components/studio/StudioShell";
import { studioFetch } from "@/components/studio/studio-data";

export interface StudioAssistantRow {
    id: string;
    name: string;
    published: boolean;
    active: boolean;
    whatsapp: { number: string | null } | null;
    link: boolean;
    website: boolean;
    chats_this_week: number;
}

/** Every assistant in the business, for the AI tab's list. */
export function useAssistants() {
    const { project } = useStudio();
    return useQuery({
        queryKey: ["studio-assistants", project.id],
        queryFn: async (): Promise<{ assistants: StudioAssistantRow[] }> => {
            const response = await studioFetch(`/api/studio/assistants?project_id=${project.id}`, { cache: "no-store" });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "Couldn't load your assistants.");
            return body as { assistants: StudioAssistantRow[] };
        },
        refetchOnWindowFocus: true,
    });
}

/** Pause an assistant, or switch it back on. */
export function useSetAssistantActive() {
    const { project } = useStudio();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ agentId, active }: { agentId: string; active: boolean }) => {
            const response = await studioFetch("/api/studio/assistants", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: project.id, agent_id: agentId, active }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? "That didn't work.");
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["studio-assistants", project.id] });
            void queryClient.invalidateQueries({ queryKey: ["studio-overview", project.id] });
        },
    });
}
