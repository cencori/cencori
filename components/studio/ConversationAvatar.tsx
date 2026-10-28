import { LinkIcon } from "@solar-icons/react/bold-duotone/link";
import { GlobalIcon } from "@solar-icons/react/bold-duotone/global";
import type { InboxConversation } from "@/components/studio/useInbox";
import { cn } from "@/lib/utils";

/** WhatsApp's glyph: the official 2026 file from WhatsApp's Brand Resource Center (Digital_Glyph_Green_RGB_2026.svg). */
export function WhatsAppMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 720 720" aria-hidden="true" className={className} fill="currentColor">
            <path d="M360,0C161.18,0,0,161.18,0,360c0,65.41,17.45,126.75,47.94,179.61L0,720l187.02-44.21c51.34,28.18,110.28,44.21,172.98,44.21,198.82,0,360-161.18,360-360S558.82,0,360,0ZM360,655.52c-60.17,0-116.13-17.98-162.82-48.87l-110.49,28.14,30.99-105.61c-33.53-47.93-53.2-106.26-53.2-169.19,0-163.21,132.31-295.52,295.52-295.52s295.52,132.31,295.52,295.52-132.31,295.52-295.52,295.52Z" />
            <path d="M444.35,407.52l87.1,41.06c4,1.88,6.56,5.94,6.2,10.34-.94,11.46-5.54,34.43-26.13,55.02-58.12,58.12-162.49-7.64-166.74-10.18-25.67-13.79-50.06-32.24-73.19-55.36-23.12-23.12-41.58-47.52-55.37-73.19-2.55-4.24-68.31-108.61-10.18-166.74,20.59-20.59,43.56-25.19,55.02-26.13,4.41-.36,8.46,2.2,10.34,6.2l41.07,87.1c1.94,4.12,1.09,9.02-2.13,12.24l-30.61,30.61c-6.62,6.62-8.56,16.93-4,25.11,11.17,20.03,26.19,39.32,43.59,57.07,17.75,17.4,37.04,32.43,57.07,43.59,8.18,4.56,18.48,2.62,25.11-4l30.61-30.61c3.22-3.22,8.12-4.08,12.24-2.13Z" />
        </svg>
    );
}

const COLOURS = ["bg-violet-500", "bg-orange-500", "bg-emerald-600", "bg-sky-600", "bg-pink-600", "bg-amber-600", "bg-teal-600", "bg-indigo-600"];

function initials(name: string): string {
    const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
    return words.length ? (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase() : "?";
}

/**
 * Who a chat is with, at a glance: a named WhatsApp customer's initials on a
 * colour of their own, with a small WhatsApp badge; otherwise where they came
 * from (WhatsApp, the share link, the website) in a tinted circle.
 */
export function ConversationAvatar({ conversation, className }: { conversation: Pick<InboxConversation, "channel" | "named" | "name">; className?: string }) {
    const base = cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full", className);
    if (conversation.named) {
        let hash = 0;
        for (const char of conversation.name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
        return (
            <span className={cn(base, "text-[14px] font-semibold text-white", COLOURS[hash % COLOURS.length])}>
                {initials(conversation.name)}
                {conversation.channel === "whatsapp" && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#25D366] text-white ring-2 ring-background">
                        <WhatsAppMark className="h-2.5 w-2.5" />
                    </span>
                )}
            </span>
        );
    }
    if (conversation.channel === "whatsapp") return <span className={cn(base, "bg-[#25D366]/15 text-[#25D366]")}><WhatsAppMark className="h-5 w-5" /></span>;
    if (conversation.channel === "link") return <span className={cn(base, "bg-sky-400/15 text-sky-500 dark:text-sky-400")}><LinkIcon size={22} /></span>;
    return <span className={cn(base, "bg-violet-400/15 text-violet-500 dark:text-violet-400")}><GlobalIcon size={22} /></span>;
}
