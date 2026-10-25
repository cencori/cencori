'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GenerateKeyDialog } from '@/components/api-keys/GenerateKeyDialog';
import { useApiKeyCount } from '@/components/dashboard/project-overview/ConsoleHomeOverview';
import { AgentLogos } from '@/components/memory/AgentLogos';
import { MemoryManualSetup } from '@/components/memory/MemoryManualSetup';

const AGENT_PROMPT = `# Add Cencori Memory to this project

Cencori Memory lets this app remember facts about each of its users across chats, devices and model changes. Before changing code, read https://cencori.com/llm.txt and https://cencori.com/docs/memory and treat them as the source of truth.

## Two ways in

| Path | Use when |
|---|---|
| \`memory\` field on a chat call | The app already calls models through Cencori (cencori.chat.completions.create) |
| cencori.memory.recall / remember | The app calls a model provider directly |

## Steps

1. Find where the app calls models and how it identifies the signed-in user.
2. Use the app's own stable user id as userId. Never an email address or a name.
3. Through Cencori: add memory: { userId } to the chat call. Recall and writes are both on by default.
4. Provider called directly: before the call, const context = await cencori.memory.recall(userId, message) and add it as a system message. After the reply, await cencori.memory.remember(userId, { user: message, assistant: reply }).
5. Keep CENCORI_API_KEY server-side. Add only a placeholder to the example env file.
6. Run the formatter, type checks and tests, and fix anything the change broke.
7. Summarize the files changed and how to see stored memories in the Cencori dashboard under Memory.`;

/** The Memory overview for a project that has never stored a memory; laid out like the console home. */
export function MemoryGetStarted({ projectId }: { projectId: string }) {
    const queryClient = useQueryClient();
    const [copied, setCopied] = useState(false);
    const [showKeyDialog, setShowKeyDialog] = useState(false);
    const [showManual, setShowManual] = useState(false);
    const { data: keyCountData, isPending: keysLoading } = useApiKeyCount(projectId);
    const keyCount = keyCountData ?? 0;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(AGENT_PROMPT);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div>
            <h2 className="mb-3 text-sm font-medium tracking-[-0.02em]">Setup</h2>
            <article className="relative flex min-h-44 flex-col overflow-hidden rounded-md bg-muted/60 p-5">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(circle 340px at 88% 50%, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.16) 38%, transparent 68%), radial-gradient(circle 220px at 95% 28%, rgba(139, 92, 246, 0.5) 0%, transparent 70%), radial-gradient(circle 220px at 96% 74%, rgba(20, 184, 166, 0.4) 0%, transparent 70%), radial-gradient(circle 170px at 101% 52%, rgba(236, 72, 153, 0.28) 0%, transparent 70%)',
                    }}
                />
                <div className="relative z-10 mt-auto flex flex-wrap items-end justify-between gap-4 pt-3">
                    <div className="min-w-0">
                        <AgentLogos />
                        <p className="mt-3 text-2xl font-medium tracking-tight">Add memory to your app</p>
                        <p className="mt-1 max-w-[60ch] text-xs text-muted-foreground">
                            Paste one prompt into Claude Code, Codex, Cursor or Tensor. Your agent wires memory in for you.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={copy}>
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            <span aria-live="polite">{copied ? 'Copied' : 'Copy prompt'}</span>
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => setShowManual((shown) => !shown)}>
                            {showManual ? 'Hide manual setup' : 'Set up manually'}
                        </Button>
                    </div>
                </div>
            </article>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
                <article className="rounded-md bg-muted/60 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">API key</p>
                    {keysLoading ? (
                        <div className="mt-3 space-y-2">
                            <Skeleton className="h-8 w-40" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                    ) : (
                        <>
                            <p className="mt-3 text-2xl font-medium tracking-tight">
                                {keyCount === 0 ? 'Get your API key' : `${keyCount} active ${keyCount === 1 ? 'key' : 'keys'}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {keyCount === 0 ? 'Memory calls use the same key as the gateway.' : 'Memory calls use these same keys.'}
                            </p>
                        </>
                    )}
                    <div className="mt-4">
                        <Button size="sm" className="h-7 text-xs" onClick={() => setShowKeyDialog(true)}>
                            Create API key
                        </Button>
                    </div>
                </article>

                <article className="rounded-md bg-muted/60 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Docs</p>
                    <p className="mt-3 text-2xl font-medium tracking-tight">How memory works</p>
                    <p className="mt-1 text-xs text-muted-foreground">Scopes, recall, forgetting and quotas.</p>
                    <div className="mt-4">
                        <Button asChild size="sm" className="h-7 text-xs">
                            <a href="/docs/memory" target="_blank" rel="noreferrer">
                                Read the docs
                            </a>
                        </Button>
                    </div>
                </article>

                <article className="rounded-md bg-muted/60 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">API reference</p>
                    <p className="mt-3 text-2xl font-medium tracking-tight">Memory API</p>
                    <p className="mt-1 text-xs text-muted-foreground">Every endpoint, option and error code.</p>
                    <div className="mt-4">
                        <Button asChild size="sm" className="h-7 text-xs">
                            <a href="/docs/api/memory" target="_blank" rel="noreferrer">
                                View the API
                            </a>
                        </Button>
                    </div>
                </article>
            </div>

            {showManual && <MemoryManualSetup onHide={() => setShowManual(false)} />}

            <GenerateKeyDialog
                projectId={projectId}
                open={showKeyDialog}
                onOpenChange={setShowKeyDialog}
                defaultKeyType="secret"
                onKeyGenerated={() => {
                    void queryClient.invalidateQueries({ queryKey: ['consoleHomeApiKeyCount', projectId] });
                }}
            />
        </div>
    );
}
