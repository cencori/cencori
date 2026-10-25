'use client';

import { useRouter } from 'next/navigation';
import { CencoriAgentSidebar } from '@/components/dashboard/CencoriAgentSidebar';
import { useCopilot } from '@/lib/contexts/CopilotContext';

/** Full-screen Copilot: the same assistant as the docked panel, given the whole page. */
export function CopilotPageClient({ initialConversationId }: { initialConversationId: string | null }) {
    const router = useRouter();
    const copilot = useCopilot();

    if (!copilot) return null;

    return (
        <CencoriAgentSidebar
            // A conversation picked from Recent chats re-renders this page with a
            // new id; remount so the chat switches to it.
            key={initialConversationId ?? 'new'}
            variant="page"
            open
            onOpenChange={() => {}}
            initialConversationId={initialConversationId}
            onExitFullScreen={() => {
                // Back to the overview, with Copilot docked as a panel.
                copilot.setOpen(true);
                const base = copilot.fullPageHref?.replace(/\/copilot$/, '');
                router.push(base || '/home');
            }}
            {...copilot.agent}
        />
    );
}
