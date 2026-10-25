'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Steps, Step, StepTitle, StepContent, StepDescription } from '@/components/docs/mdx/components/steps';
import { CommandBlock } from '@/components/docs/mdx/components/command-block';
import CopyButton from '@/components/docs/mdx/components/copy-button';
import { cn } from '@/lib/utils';

const ENV = `# .env.local for Next.js, .env for most Node apps
CENCORI_API_KEY=csk_...`;

const PATHS = {
    gateway: {
        label: 'Through Cencori',
        hint: 'Your app already calls models through Cencori. One field turns memory on.',
        code: `import { Cencori } from 'cencori';

const cencori = new Cencori();

const response = await cencori.chat.completions.create({
  model: 'gpt-4o',
  messages,
  // Your app's own stable user id, never an email or a name.
  memory: { userId: user.id },
});`,
    },
    standalone: {
        label: 'Any provider',
        hint: 'Your app calls a model provider directly. Recall before the call, remember after it.',
        code: `import { Cencori } from 'cencori';

const cencori = new Cencori();

// Before your model call: what do we know about this user?
const context = await cencori.memory.recall(user.id, message);

// ...call any provider with \`context\` as a system message...

// After the reply: remember what was said.
await cencori.memory.remember(user.id, { user: message, assistant: reply });`,
    },
} as const;

type PathKey = keyof typeof PATHS;

/**
 * A code block that looks like the docs': same frame, same Shiki themes. The
 * highlighter loads on demand, so the dashboard only pays for it when this
 * dialog opens; until then the code shows unhighlighted.
 */
function DocsCode({ code, language }: { code: string; language: string }) {
    const [html, setHtml] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        import('@/lib/docs/highlight-code')
            .then(({ highlightCode }) => highlightCode(code, language, { showLineNumbers: false }))
            .then((result) => { if (!cancelled) setHtml(result); })
            .catch(() => { /* keep the plain fallback */ });
        return () => { cancelled = true; };
    }, [code, language]);

    return (
        <div className="dark:bg-primary-foreground group relative rounded-[8px] bg-[#F5F5F5] p-1">
            <div className="absolute right-2 top-2 z-10">
                <CopyButton code={code} withBlurBg />
            </div>
            <div className="no-scrollbar bg-background min-w-0 overflow-x-auto rounded-sm border py-3.5 text-[.8125rem]">
                {html ? (
                    <div className="[&_pre]:bg-transparent! [&_pre]:px-4" dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                    <pre className="px-4 font-mono"><code>{code}</code></pre>
                )}
            </div>
        </div>
    );
}

/**
 * Manual setup for people who would rather paste code than hand a prompt to an
 * agent. Shown inline under the setup cards, so long code never scrolls inside
 * a dialog.
 */
export function MemoryManualSetup({ onHide }: { onHide: () => void }) {
    const [path, setPath] = useState<PathKey>('gateway');
    const active = PATHS[path];
    const sectionRef = useRef<HTMLElement>(null);

    // Opening it from the card above should bring it into view.
    useEffect(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, []);

    return (
        // At least a screen tall, so the scroll can bring it to the top instead of
        // stopping where the page runs out. The offset clears the top bar and the
        // maintenance banner with room to spare.
        <section ref={sectionRef} className="mt-8 min-h-[calc(100dvh-8rem)] scroll-mt-32" aria-labelledby="manual-setup-heading">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 id="manual-setup-heading" className="text-sm font-medium tracking-[-0.02em]">Manual setup</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Three steps. Stored memories show up on this page as soon as the first request lands.
                    </p>
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={onHide}>Hide</Button>
            </div>

            <div className="max-w-[760px]">
                <Steps className="mt-2">
                    <Step>
                        <StepTitle>Install the SDK</StepTitle>
                        <StepContent>
                            <StepDescription>Add the Cencori SDK with your package manager.</StepDescription>
                            <CommandBlock commands={['cencori']} />
                        </StepContent>
                    </Step>

                    <Step>
                        <StepTitle>Set your API key</StepTitle>
                        <StepContent>
                            <StepDescription>
                                Keep the key on the server. Never expose it through NEXT_PUBLIC_ variables or browser code.
                            </StepDescription>
                            <DocsCode code={ENV} language="bash" />
                        </StepContent>
                    </Step>

                    <Step>
                        <StepTitle>Add memory to your calls</StepTitle>
                        <StepContent>
                            <div className="flex gap-1" role="tablist" aria-label="Setup path">
                                {(Object.keys(PATHS) as PathKey[]).map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        role="tab"
                                        aria-selected={path === key}
                                        onClick={() => setPath(key)}
                                        className={cn(
                                            'h-7 rounded-md px-2.5 text-xs transition-colors',
                                            path === key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {PATHS[key].label}
                                    </button>
                                ))}
                            </div>
                            <StepDescription>{active.hint}</StepDescription>
                            <DocsCode key={path} code={active.code} language="typescript" />
                        </StepContent>
                    </Step>
                </Steps>

                <a
                    href="/docs/memory"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-9 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                    Scopes, sessions and every option are in the memory docs
                </a>
            </div>
        </section>
    );
}
