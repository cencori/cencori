'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { COPILOT_CONVERSATION_COOKIE, COPILOT_CONVERSATION_EVENT, COPILOT_NEW_CHAT_EVENT } from '@/lib/console/copilot';
import { cn } from '@/lib/utils';

const COLLAPSED_KEY = 'cencori:copilot-recent-collapsed';

function timeAgo(iso: string): string {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks}w`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function readOpenConversation(): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COPILOT_CONVERSATION_COOKIE}=([^;]*)`));
    return match?.[1] || null;
}

/**
 * The Copilot sub-menu's "Recent chats": your conversations in this
 * organization, newest first. Shares its cache with the panel's history menu,
 * so a chat saved in one shows up in the other.
 */
export function CopilotRecentChats({ organizationId, chatHref }: { organizationId: string; chatHref: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1'); } catch { /* storage unavailable */ }
        setActiveId(readOpenConversation());
        const onChange = (event: Event) => setActiveId((event as CustomEvent<string | null>).detail ?? null);
        window.addEventListener(COPILOT_CONVERSATION_EVENT, onChange);
        return () => window.removeEventListener(COPILOT_CONVERSATION_EVENT, onChange);
    }, []);

    // Same key, select and limit as the panel's history menu.
    const { data: chats = [] } = useQuery({
        queryKey: ['copilotHistory', organizationId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('copilot_conversations')
                .select('id, title, updated_at')
                .eq('organization_id', organizationId)
                .order('updated_at', { ascending: false })
                .limit(30);
            if (error) throw error;
            return data ?? [];
        },
        staleTime: 30 * 1000,
        retry: false,
    });

    const toggle = () => {
        setCollapsed((value) => {
            try { localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1'); } catch { /* storage unavailable */ }
            return !value;
        });
    };

    const open = (id: string) => {
        // Chat restores the conversation this cookie names.
        document.cookie = `${COPILOT_CONVERSATION_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
        setActiveId(id);
        if (pathname === chatHref) router.refresh();
        else router.push(chatHref);
    };

    // Your own conversations only: the table's RLS allows deleting just those.
    const remove = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('copilot_conversations').delete().eq('id', id);
            if (error) throw new Error('We could not delete that chat.');
            return id;
        },
        onSuccess: (id) => {
            if (id === activeId) {
                // Deleting the open chat starts a fresh one instead of reopening it.
                document.cookie = `${COPILOT_CONVERSATION_COOKIE}=; path=/; max-age=0; samesite=lax`;
                setActiveId(null);
                if (pathname === chatHref) window.dispatchEvent(new Event(COPILOT_NEW_CHAT_EVENT));
            }
            void queryClient.invalidateQueries({ queryKey: ['copilotHistory', organizationId] });
            setPendingDelete(null);
        },
    });

    if (chats.length === 0) return null;

    return (
        <>
            <SidebarMenuItem className="mt-4">
                <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={!collapsed}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                >
                    Recent chats
                    <ChevronDown className={cn('h-3 w-3 transition-transform', collapsed && '-rotate-90')} />
                </button>
            </SidebarMenuItem>
            {!collapsed && chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                        size="sm"
                        isActive={pathname === chatHref && chat.id === activeId}
                        onClick={() => open(chat.id)}
                        tooltip={chat.title || 'Untitled'}
                        // The age and the delete button share the right edge, so
                        // don't reserve extra room for the button.
                        className="group-has-data-[sidebar=menu-action]/menu-item:pr-2"
                    >
                        <span className="min-w-0 flex-1 truncate text-sm">{chat.title || 'Untitled'}</span>
                        {/* Swaps with the delete button on hover. */}
                        <span className="min-w-5 shrink-0 whitespace-nowrap text-right text-xs text-muted-foreground group-hover/menu-item:invisible group-focus-within/menu-item:invisible">
                            {timeAgo(chat.updated_at)}
                        </span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                        showOnHover
                        aria-label={`Delete ${chat.title || 'chat'}`}
                        onClick={() => setPendingDelete({ id: chat.id, title: chat.title || 'Untitled' })}
                        // Same right edge as the age (the button's pr-2), so the
                        // icon takes the age's place instead of sitting past it.
                        className="right-2 text-muted-foreground hover:text-red-500"
                    >
                        <Trash2 />
                    </SidebarMenuAction>
                </SidebarMenuItem>
            ))}

            <AlertDialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">Delete this chat?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                            “{pendingDelete?.title}” will be deleted. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {remove.error && (
                        <p className="text-xs text-red-500">
                            {remove.error instanceof Error ? remove.error.message : 'Could not delete that chat.'}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel className="h-8 text-xs">Keep it</AlertDialogCancel>
                        <AlertDialogAction
                            className="h-8 bg-red-600 text-xs hover:bg-red-600/90"
                            disabled={remove.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                if (pendingDelete) remove.mutate(pendingDelete.id);
                            }}
                        >
                            {remove.isPending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
