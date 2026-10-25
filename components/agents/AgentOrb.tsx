import { cn } from "@/lib/utils";
import { ORB_HIGHLIGHT, orbBackground } from "@/lib/agents/orb";

/**
 * A soft gradient orb used as an agent's avatar. Colors and swirl come from
 * the seed (an agent or template id), so every agent keeps its own orb
 * without storing an image.
 */
export function AgentOrb({ seed, className }: { seed: string; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn("relative inline-block h-5 w-5 shrink-0 overflow-hidden rounded-full", className)}
            style={{ background: orbBackground(seed) }}
        >
            {/* Blur the hard conic seams into a swirl, then add a glossy highlight. */}
            <span className="absolute inset-0 rounded-full backdrop-blur-[1.5px]" />
            <span className="absolute inset-0 rounded-full" style={{ background: ORB_HIGHLIGHT }} />
            <span className="absolute inset-0 rounded-full shadow-[inset_0_-2px_4px_rgba(0,0,0,0.25)]" />
        </span>
    );
}
