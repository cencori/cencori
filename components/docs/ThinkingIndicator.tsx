"use client";

export function ThinkingIndicator({ finished = false }: { finished?: boolean }) {
    if (finished) return null;

    return (
        <div className="w-full max-w-sm py-2">
            <span className="agent-thinking-shimmer text-xs font-mono" data-text="Thinking">Thinking</span>
        </div>
    );
}
