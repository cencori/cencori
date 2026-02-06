'use client';

/**
 * SecurityArchitectureDiagram
 * 
 * A minimalist architecture diagram showing Cencori's multi-phase
 * security pipeline. Inspired by Vercel's aesthetic but with our own structure.
 * Uses currentColor for automatic light/dark mode support.
 */

export function SecurityArchitectureDiagram() {
    return (
        <div className="my-12 font-sans select-none">
            {/* Main vertical pipeline */}
            <div className="max-w-lg mx-auto">

                {/* User Input */}
                <div className="text-center mb-2">
                    <span className="text-xs tracking-widest uppercase text-current/50">User Input</span>
                </div>
                <div className="border border-current/20 rounded-lg p-4 mb-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded border border-current/20 flex items-center justify-center">
                            <span className="text-current/40 text-xs">→</span>
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <div className="h-1.5 bg-current/15 rounded w-full" />
                            <div className="h-1.5 bg-current/15 rounded w-3/4" />
                        </div>
                    </div>
                </div>

                {/* Arrow down */}
                <div className="flex justify-center py-1">
                    <div className="w-px h-4 bg-current/30" />
                </div>
                <div className="flex justify-center pb-2">
                    <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/30">
                        <path d="M4 5L0 0h8L4 5z" />
                    </svg>
                </div>

                {/* Phase 1: Input Scan */}
                <div className="border border-current/20 rounded-lg p-5 mb-1 relative">
                    <div className="absolute -top-2.5 left-4 bg-background px-2">
                        <span className="text-[10px] tracking-widest uppercase text-current/40">Phase 1</span>
                    </div>
                    <div className="text-sm font-medium mb-3">Input Scan</div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-current/60">
                        <div className="border border-current/15 rounded px-2 py-1.5 text-center">Content Filter</div>
                        <div className="border border-current/15 rounded px-2 py-1.5 text-center">Jailbreak Detect</div>
                        <div className="border border-current/15 rounded px-2 py-1.5 text-center">Intent Analysis</div>
                    </div>

                    {/* Context output indicator */}
                    <div className="absolute -right-16 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1">
                        <div className="w-8 border-t border-dashed border-current/30" />
                        <span className="text-[9px] text-current/40 whitespace-nowrap">jailbreakRisk</span>
                    </div>
                </div>

                {/* Arrow with "if safe" label */}
                <div className="flex justify-center py-1">
                    <div className="w-px h-3 bg-current/30" />
                </div>
                <div className="flex justify-center items-center gap-2 pb-1">
                    <span className="text-[9px] text-current/40">if safe</span>
                </div>
                <div className="flex justify-center pb-2">
                    <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/30">
                        <path d="M4 5L0 0h8L4 5z" />
                    </svg>
                </div>

                {/* AI Model */}
                <div className="border border-current/20 rounded-lg p-4 mb-1 bg-current/[0.02]">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">AI Model Response</span>
                        <div className="flex gap-1.5">
                            <div className="w-5 h-5 rounded border border-current/15 flex items-center justify-center text-[8px] text-current/40">◯</div>
                            <div className="w-5 h-5 rounded border border-current/15 flex items-center justify-center text-[8px] text-current/40">△</div>
                            <div className="w-5 h-5 rounded border border-current/15 flex items-center justify-center text-[8px] text-current/40">◇</div>
                        </div>
                    </div>
                </div>

                {/* Arrow down */}
                <div className="flex justify-center py-1">
                    <div className="w-px h-4 bg-current/30" />
                </div>
                <div className="flex justify-center pb-2">
                    <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/30">
                        <path d="M4 5L0 0h8L4 5z" />
                    </svg>
                </div>

                {/* Phase 2: Output Scan */}
                <div className="border border-current/20 rounded-lg p-5 mb-1 relative">
                    <div className="absolute -top-2.5 left-4 bg-background px-2">
                        <span className="text-[10px] tracking-widest uppercase text-current/40">Phase 2</span>
                    </div>
                    <div className="text-sm font-medium mb-3">Output Scan</div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-current/60">
                        <div className="border border-current/15 rounded px-2 py-1.5 text-center">PII Detection</div>
                        <div className="border border-current/15 rounded px-2 py-1.5 text-center">Instruction Leak</div>
                        <div className="border border-current/15 rounded px-2 py-1.5 text-center">Context Score</div>
                    </div>

                    {/* Context input indicator */}
                    <div className="absolute -right-12 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1">
                        <svg width="6" height="8" viewBox="0 0 6 8" className="fill-current/30">
                            <path d="M0 4L6 0v8L0 4z" />
                        </svg>
                        <div className="w-4 border-t border-dashed border-current/30" />
                    </div>
                </div>

                {/* Arrow down */}
                <div className="flex justify-center py-1">
                    <div className="w-px h-4 bg-current/30" />
                </div>
                <div className="flex justify-center pb-2">
                    <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/30">
                        <path d="M4 5L0 0h8L4 5z" />
                    </svg>
                </div>

                {/* Safe Response */}
                <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/[0.03]">
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 16 16" className="text-green-500/70 fill-current">
                            <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.5 5.5l-4.5 4.5-2.5-2.5-.7.7 3.2 3.2 5.2-5.2-.7-.7z" />
                        </svg>
                        <span className="text-sm font-medium">Safe Response</span>
                    </div>
                </div>
            </div>

            {/* Caption */}
            <div className="mt-8 text-center text-xs text-current/40">
                Context flows from Phase 1 to Phase 2—suspicious inputs trigger stricter output scanning.
            </div>
        </div>
    );
}
