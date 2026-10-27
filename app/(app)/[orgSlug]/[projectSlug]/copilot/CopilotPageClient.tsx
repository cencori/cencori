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
            onExitFullScreen={(to) => {
                // Docked as a panel again: on the page Copilot is taking the
                // user to, else back to the overview.
                copilot.setOpen(to ? to.openPanel : true);
                const base = copilot.fullPageHref?.replace(/\/copilot$/, '');
                router.push(to?.href ?? (base || '/home'));
            }}
            {...copilot.agent}
        />
    );
}
