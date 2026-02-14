'use client';

/**
 * TokenizationFlowDiagram
 * 
 * A Ghost Diagram showing how PII tokenization works:
 * User input → Tokenize → LLM processes placeholders → De-tokenize → User sees real data
 * With a parallel branch showing that logs only store tokenized content.
 */

import {
    GhostContainer, GhostBox, GhostBoxTitle, GhostBoxContent,
    GhostArrow, GhostLabel, GhostCaption
} from '@/components/ui/ghost-diagram';

export function TokenizationFlowDiagram() {
    return (
        <GhostContainer maxWidth="lg">
            {/* User Input */}
            <GhostLabel>User Input</GhostLabel>
            <GhostBox className="border border-current/20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-current/20 flex items-center justify-center">
                        <span className="text-current/40 text-xs">→</span>
                    </div>
                    <div className="flex-1">
                        <div className="text-xs text-current/60 font-mono">
                            &quot;My email is <span className="text-blue-400/80">sarah@acme.com</span>&quot;
                        </div>
                    </div>
                </div>
            </GhostBox>

            <GhostArrow />

            {/* Tokenize Phase */}
            <GhostBox label="Step 1 — Tokenize" variant="default" className="border border-current/20">
                <GhostBoxTitle>Replace PII with Named Placeholders</GhostBoxTitle>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-current/60 font-mono">
                        <span className="text-red-400/70 line-through">sarah@acme.com</span>
                        <span className="text-current/30">→</span>
                        <span className="text-blue-400/80 font-semibold">[EMAIL_1]</span>
                    </div>
                    <GhostBoxContent>
                        Token map stored in memory (per-request, never persisted)
                    </GhostBoxContent>
                </div>
            </GhostBox>

            <GhostArrow label="sanitized" />

            {/* LLM Processing */}
            <GhostBox className="border border-current/20 bg-current/[0.02]">
                <div className="flex items-center justify-between mb-3">
                    <GhostBoxTitle className="mb-0">AI Model</GhostBoxTitle>
                    <div className="flex gap-1.5">
                        <div className="w-5 h-5 rounded border border-current/15 flex items-center justify-center text-[8px] text-current/40">◯</div>
                        <div className="w-5 h-5 rounded border border-current/15 flex items-center justify-center text-[8px] text-current/40">△</div>
                        <div className="w-5 h-5 rounded border border-current/15 flex items-center justify-center text-[8px] text-current/40">◇</div>
                    </div>
                </div>
                <div className="border border-current/10 rounded p-3 space-y-1.5">
                    <div className="text-[11px] text-current/40 uppercase tracking-wider mb-2">LLM sees</div>
                    <div className="text-xs text-current/60 font-mono">&quot;My email is <span className="text-blue-400/80 font-semibold">[EMAIL_1]</span>&quot;</div>
                </div>
                <div className="border border-current/10 rounded p-3 mt-2 space-y-1.5">
                    <div className="text-[11px] text-current/40 uppercase tracking-wider mb-2">LLM responds</div>
                    <div className="text-xs text-current/60 font-mono">&quot;Reach me at <span className="text-blue-400/80 font-semibold">[EMAIL_1]</span> for follow-up&quot;</div>
                </div>
            </GhostBox>

            {/* Split into two paths */}
            <div className="flex justify-center py-1">
                <div className="w-px h-4 bg-current/30" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                {/* Left: De-tokenize path */}
                <div>
                    <GhostArrow label="de-tokenize" />
                    <GhostBox variant="success" className="border border-green-500/30">
                        <GhostBoxTitle>User Sees</GhostBoxTitle>
                        <div className="text-xs text-current/60 font-mono">
                            &quot;Reach me at <span className="text-green-500/80 font-semibold">sarah@acme.com</span>&quot;
                        </div>
                        <GhostBoxContent className="mt-2">
                            Real PII restored — seamless experience
                        </GhostBoxContent>
                    </GhostBox>
                </div>

                {/* Right: Log path */}
                <div>
                    <GhostArrow label="log as-is" />
                    <GhostBox variant="muted" className="border border-current/20">
                        <GhostBoxTitle>Database Logs</GhostBoxTitle>
                        <div className="text-xs text-current/60 font-mono">
                            &quot;Reach me at <span className="text-blue-400/80 font-semibold">[EMAIL_1]</span>&quot;
                        </div>
                        <GhostBoxContent className="mt-2">
                            No PII stored — safe if compromised
                        </GhostBoxContent>
                    </GhostBox>
                </div>
            </div>

            <GhostCaption>
                PII is replaced before the LLM, restored for the user, and never stored in logs.
            </GhostCaption>
        </GhostContainer>
    );
}
