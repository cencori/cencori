"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Porter } from "./shared";

/**
 * Talk to a Porter before putting it on a website.
 *
 * This runs the same path a visitor gets -- a session, then /v1/porter/chat, streamed -- so what is
 * tested here is what ships rather than a friendlier version of it. The only difference is how the
 * session is obtained: a signed-in member of the organization does not have to add cencori.com to
 * their own allowed domains to try their own Porter.
 *
 * Sources are shown under every answer, because the question a buyer is really asking is not
 * whether it replies but whether the reply can be trusted.
 */

type Source = { title: string; url: string };
type Turn = { role: "you" | "them"; text: string; sources?: Source[] };

export type PorterPreviewHandle = { ask: (question: string) => void };

export function PorterPreview({
    porter,
    handleRef,
    className,
    greeting,
}: {
    porter: Porter;
    handleRef?: Ref<PorterPreviewHandle>;
    className?: string;
    greeting?: string;
}) {
    // The widget opens with the greeting already said, so this does too rather than showing an
    // instruction the visitor will never see.
    const [turns, setTurns] = useState<Turn[]>(
        greeting ? [{ role: "them", text: greeting }] : []
    );
    const [question, setQuestion] = useState("");
    const [busy, setBusy] = useState(false);
    const token = useRef<{ value: string; expiresAt: number } | null>(null);

    async function session(): Promise<string> {
        if (token.current && Date.now() < token.current.expiresAt) return token.current.value;

        const response = await fetch(`/api/porter/${porter.id}/preview-session`, { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "Could not start a preview.");

        token.current = {
            value: body.token,
            expiresAt: Date.now() + Math.max((body.expiresIn || 1800) - 60, 60) * 1000,
        };
        return body.token;
    }

    useImperativeHandle(handleRef, () => ({ ask: (asked: string) => void send(asked) }), [busy]);

    async function ask() {
        void send(question);
    }

    async function send(raw: string) {
        const asked = raw.trim();
        if (!asked || busy) return;

        setQuestion("");
        setTurns((current) => [...current, { role: "you", text: asked }]);
        setBusy(true);

        try {
            const value = await session();
            const response = await fetch("/api/v1/porter/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${value}` },
                body: JSON.stringify({ message: asked, stream: true }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error?.message || "Something went wrong.");
            }

            let sources: Source[] = [];
            const encoded = response.headers.get("X-Porter-Sources");
            if (encoded) {
                try {
                    sources = JSON.parse(atob(encoded)) as Source[];
                } catch {
                    sources = [];
                }
            }

            setTurns((current) => [...current, { role: "them", text: "", sources }]);

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = "";
            let answer = "";

            for (;;) {
                const { done, value: chunk } = await reader.read();
                if (done) break;
                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) continue;
                    const payload = trimmed.slice(5).trim();
                    if (!payload || payload === "[DONE]") continue;
                    try {
                        const piece = JSON.parse(payload)?.choices?.[0]?.delta?.content;
                        if (!piece) continue;
                        answer += piece;
                        setTurns((current) => {
                            const next = [...current];
                            next[next.length - 1] = { ...next[next.length - 1], text: answer };
                            return next;
                        });
                    } catch {
                        /* a partial frame; the next read completes it */
                    }
                }
            }
        } catch (error) {
            setTurns((current) => [
                ...current,
                { role: "them", text: error instanceof Error ? error.message : "Something went wrong." },
            ]);
        } finally {
            setBusy(false);
        }
    }

    if (!porter.enabled) {
        return (
            <div className={`rounded-lg border border-border p-5 ${className ?? ""}`}>
                <p className="text-sm font-medium">Nothing to preview yet</p>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                    Your Porter answers from pages on your own site, and it has not read any. Choose what it
                    should read on the Knowledge page first.
                </p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col ${className ?? ""}`}>
            {/* The waiting dots from porter.js, same curve and same delays. */}
            <style>{`
                @keyframes porter-pulse {
                    0%, 80%, 100% { opacity: .2; transform: scale(.8); }
                    40% { opacity: 1; transform: scale(1.2); }
                }
            `}</style>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
                {turns.map((turn, index) => (
                        <div
                            key={index}
                            className={`flex flex-col ${turn.role === "you" ? "items-end" : "items-start"}`}
                        >
                            {turn.role === "you" ? (
                                <p className="max-w-[85%] whitespace-pre-wrap rounded-[.875rem] rounded-br-[.25rem] bg-foreground px-3 py-1.5 text-sm leading-[1.4] text-background">
                                    {turn.text}
                                </p>
                            ) : (
                                <div className="w-full">
                                    {turn.text ? (
                                        <p className="whitespace-pre-wrap text-sm leading-[1.4]">{turn.text}</p>
                                    ) : (
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                            {[0, 1, 2].map((dot) => (
                                                <i
                                                    key={dot}
                                                    className="block size-1 rounded-full bg-current"
                                                    style={{
                                                        animation: "porter-pulse 1.4s infinite ease-in-out both",
                                                        animationDelay: `${-0.32 + dot * 0.16}s`,
                                                    }}
                                                />
                                            ))}
                                        </span>
                                    )}
                                    {turn.sources && turn.sources.length > 0 && (
                                        <ul className="mt-2 flex flex-wrap gap-1.5">
                                            {turn.sources.map((source, position) => (
                                                <li key={source.url}>
                                                    <a
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-block rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                                                    >
                                                        [{position + 1}] {new URL(source.url).pathname}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                ))}
            </div>

            {/* The composer from porter.js: a pill, a borderless field, a round arrow. */}
            <div className="p-3">
                <div className="flex items-center gap-2 rounded-full border border-border bg-card py-2 pl-4 pr-2 transition-colors focus-within:border-foreground/40">
                    <input
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") ask();
                        }}
                        placeholder="Ask a question..."
                        aria-label="Ask your Porter a question"
                        disabled={busy}
                        className="h-6 min-w-0 flex-1 border-none bg-transparent text-[.95rem] outline-none placeholder:text-muted-foreground"
                    />
                    <button
                        type="button"
                        onClick={ask}
                        disabled={busy || !question.trim()}
                        aria-label="Send message"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:scale-100 disabled:bg-border disabled:text-muted-foreground"
                    >
                        <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true">
                            <path
                                d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
