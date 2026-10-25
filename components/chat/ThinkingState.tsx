/** The shimmering "Thinking" line shown while a reply hasn't started (Copilot, agent Preview). */
export function ThinkingState({ label = "Thinking", className = "py-3 text-[15px]" }: { label?: string; className?: string }) {
    return (
        <div className={className} role="status" aria-live="polite">
            <span key={label} className="agent-thinking-shimmer" data-text={label}>{label}</span>
        </div>
    );
}
