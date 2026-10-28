import { TicketIcon } from "@solar-icons/react/bold-duotone/ticket";
import { TicketStarIcon } from "@solar-icons/react/bold-duotone/ticket-star";
import { TicketSaleIcon } from "@solar-icons/react/bold-duotone/ticket-sale";
import { cn } from "@/lib/utils";

/**
 * A ticket type's icon: a star for the premium ones (VIP, tables), a sale tag
 * for the cheap ones (early bird, promo), a plain ticket otherwise. The first
 * type is Studio's usual grey; each one after gets its own colour, by position
 * so it stays put while the owner edits.
 */
const COLOURS = [
    "text-violet-400 bg-violet-400/15",
    "text-orange-400 bg-orange-400/15",
    "text-emerald-400 bg-emerald-400/15",
    "text-sky-400 bg-sky-400/15",
    "text-pink-400 bg-pink-400/15",
    "text-amber-400 bg-amber-400/15",
];

/** In a circle tinted with its own colour. */
export function TicketTierIcon({ name, index, size = 18, className }: { name: string; index: number; size?: number; className?: string }) {
    const Icon = /\b(v+ip|table|premium|gold|platinum|exec|backstage)\b/i.test(name) ? TicketStarIcon
        : /\b(early|bird|promo|discount|sale|student|group)\b/i.test(name) ? TicketSaleIcon
            : TicketIcon;
    return (
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", index === 0 ? "bg-foreground/10 text-muted-foreground" : COLOURS[(index - 1) % COLOURS.length], className)}>
            <Icon size={size} />
        </span>
    );
}
