'use client';

/**
 * CircuitBreakerDiagram
 * 
 * A Ghost Diagram showing the three-state circuit breaker lifecycle:
 * CLOSED (normal) → OPEN (blocked) → HALF-OPEN (testing) → CLOSED or OPEN
 * 
 * Visual state machine with transition labels and status indicators.
 */

import {
    GhostContainer, GhostBox, GhostBoxTitle, GhostBoxContent,
    GhostArrow, GhostCaption
} from '@/components/ui/ghost-diagram';

function StateIndicator({ color, pulse }: { color: string; pulse?: boolean }) {
    return (
        <div className="relative">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            {pulse && (
                <div className={`absolute inset-0 w-2 h-2 rounded-full ${color} animate-ping opacity-40`} />
            )}
        </div>
    );
}

function TransitionLabel({ children, direction = 'down' }: { children: React.ReactNode; direction?: 'down' | 'right' | 'up' }) {
    if (direction === 'right') {
        return (
            <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-current/30" />
                <span className="text-[9px] text-current/50 whitespace-nowrap">{children}</span>
                <svg width="6" height="8" viewBox="0 0 6 8" className="fill-current/30">
                    <path d="M6 4L0 0v8l6-4z" />
                </svg>
            </div>
        );
    }
    if (direction === 'up') {
        return (
            <div className="flex flex-col items-center">
                <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/30 rotate-180">
                    <path d="M4 5L0 0h8L4 5z" />
                </svg>
                <span className="text-[9px] text-current/50 my-1">{children}</span>
                <div className="w-px h-3 bg-current/30" />
            </div>
        );
    }
    return null;
}

export function CircuitBreakerDiagram() {
    return (
        <GhostContainer maxWidth="xl">
            {/* State Machine - Horizontal Layout */}
            <div className="grid grid-cols-3 gap-3 items-start">

                {/* CLOSED State */}
                <GhostBox variant="success" className="border border-green-500/30">
                    <div className="flex items-center gap-2 mb-3">
                        <StateIndicator color="bg-green-500" />
                        <GhostBoxTitle className="mb-0 text-green-500/90">Closed</GhostBoxTitle>
                    </div>
                    <GhostBoxContent>
                        Normal operation. All requests pass through. Failures are counted.
                    </GhostBoxContent>
                    <div className="mt-3 border border-current/10 rounded p-2">
                        <div className="text-[10px] text-current/40 uppercase tracking-wider mb-1.5">State</div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">Failures</span>
                                <span className="font-mono text-current/60">0 / 5</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">Traffic</span>
                                <span className="font-mono text-green-500/70">flowing</span>
                            </div>
                        </div>
                    </div>
                </GhostBox>

                {/* OPEN State */}
                <GhostBox variant="error" className="border border-red-500/30">
                    <div className="flex items-center gap-2 mb-3">
                        <StateIndicator color="bg-red-500" pulse />
                        <GhostBoxTitle className="mb-0 text-red-500/90">Open</GhostBoxTitle>
                    </div>
                    <GhostBoxContent>
                        Provider isolated. All requests rejected instantly. No network calls made.
                    </GhostBoxContent>
                    <div className="mt-3 border border-current/10 rounded p-2">
                        <div className="text-[10px] text-current/40 uppercase tracking-wider mb-1.5">State</div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">Failures</span>
                                <span className="font-mono text-red-500/70">≥ 5</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">Traffic</span>
                                <span className="font-mono text-red-500/70">blocked</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">Timeout</span>
                                <span className="font-mono text-current/60">60s</span>
                            </div>
                        </div>
                    </div>
                </GhostBox>

                {/* HALF-OPEN State */}
                <GhostBox variant="warning" className="border border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-3">
                        <StateIndicator color="bg-yellow-500" pulse />
                        <GhostBoxTitle className="mb-0 text-yellow-500/90">Half-Open</GhostBoxTitle>
                    </div>
                    <GhostBoxContent>
                        Testing recovery. Exactly one probe request allowed through.
                    </GhostBoxContent>
                    <div className="mt-3 border border-current/10 rounded p-2">
                        <div className="text-[10px] text-current/40 uppercase tracking-wider mb-1.5">State</div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">Probe</span>
                                <span className="font-mono text-yellow-500/70">1 request</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">On success</span>
                                <span className="font-mono text-green-500/70">→ closed</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-current/50">On failure</span>
                                <span className="font-mono text-red-500/70">→ open</span>
                            </div>
                        </div>
                    </div>
                </GhostBox>
            </div>

            {/* Transition Arrows */}
            <div className="mt-6 space-y-3">
                {/* Transition descriptions */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center">
                        <div className="w-px h-3 bg-current/20" />
                        <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/20">
                            <path d="M4 5L0 0h8L4 5z" />
                        </svg>
                    </div>
                    <div />
                    <div className="flex flex-col items-center">
                        <svg width="8" height="5" viewBox="0 0 8 5" className="fill-current/20 rotate-180">
                            <path d="M4 5L0 0h8L4 5z" />
                        </svg>
                        <div className="w-px h-3 bg-current/20" />
                    </div>
                </div>

                {/* Transition flow */}
                <div className="border border-current/10 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-[10px] text-current/40 uppercase tracking-wider mb-1">Trigger</div>
                            <div className="text-xs text-current/60">
                                failures <span className="font-mono text-red-400/70">≥ threshold</span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-current/40">
                                <span className="text-green-500/60">CLOSED</span>
                                <span>→</span>
                                <span className="text-red-500/60">OPEN</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-current/40 uppercase tracking-wider mb-1">Cooldown</div>
                            <div className="text-xs text-current/60">
                                timeout <span className="font-mono text-yellow-400/70">elapsed</span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-current/40">
                                <span className="text-red-500/60">OPEN</span>
                                <span>→</span>
                                <span className="text-yellow-500/60">HALF-OPEN</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-current/40 uppercase tracking-wider mb-1">Recovery</div>
                            <div className="text-xs text-current/60">
                                probe <span className="font-mono text-green-400/70">succeeds</span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-current/40">
                                <span className="text-yellow-500/60">HALF-OPEN</span>
                                <span>→</span>
                                <span className="text-green-500/60">CLOSED</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <GhostCaption>
                Three-state circuit breaker. Failed providers are isolated instantly, tested with a single probe after cooldown, and restored only on confirmed recovery.
            </GhostCaption>
        </GhostContainer>
    );
}
