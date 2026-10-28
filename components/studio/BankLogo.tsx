import { cn } from "@/lib/utils";

/**
 * A bank's logo in a circle, or, for the small banks without one, its
 * initials on a colour picked from its name (so it looks meant, not missing).
 */
const COLOURS = ["bg-violet-500", "bg-orange-500", "bg-emerald-600", "bg-sky-600", "bg-pink-600", "bg-amber-600", "bg-teal-600", "bg-indigo-600"];

function initials(name: string): string {
    const words = name.replace(/\(.*?\)/g, "").replace(/\b(limited|ltd|plc|bank|mfb|microfinance|of|nigeria|the)\b/gi, "").trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? name).slice(0, 2)).toUpperCase();
}

export function BankLogo({ name, logo, className }: { name: string; logo: string | null | undefined; className?: string }) {
    if (logo) {
        // eslint-disable-next-line @next/next/no-img-element -- our own small static file
        return <img src={logo} alt="" className={cn("h-10 w-10 shrink-0 rounded-full bg-white object-contain", className)} />;
    }
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white", COLOURS[hash % COLOURS.length], className)}>{initials(name)}</span>;
}
