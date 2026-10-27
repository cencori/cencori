"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Check, ChevronLeft, Link2, Loader2 } from "lucide-react";
import { useStudio } from "@/components/studio/StudioShell";
import { useStudioCopilot } from "@/components/studio/StudioCopilot";
import { BUSINESS_KINDS, setupInstructions, setupKnowledge, setupQuestions, type AnswerKey, type BusinessKind } from "@/lib/studio/setup";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { cn } from "@/lib/utils";

type Answers = Partial<Record<AnswerKey, string>>;
type Built = { agentId: string; publicKey: string; previewToken: string; shareToken: string | null };
type Saved = { step: number; kind: BusinessKind | null; answers: Answers; asked: number; built: Built | null };

const STORAGE_KEY = (projectId: string) => `cencori:studio-setup:${projectId}`;
const BUSINESS_MODEL = "deepseek-v4-flash";

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? `That didn't work (${response.status}).`);
    return json as T;
}

const shareUrl = (token: string) => `${new URL(getMainSiteUrl("/")).origin}/talk/${token}`;

function Progress({ step }: { step: number }) {
    return (
        <div className="grid grid-cols-5 gap-1.5" aria-label={`Step ${step} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => <span key={n} className={cn("h-1 rounded-full", n <= step ? "bg-foreground" : "bg-muted")} />)}
        </div>
    );
}

/**
 * Studio setup, five steps: what kind of business, a few questions (then the
 * assistant is built and goes live), try it as a customer, where it works,
 * and done. Progress is kept on this device, so leaving (to connect
 * WhatsApp, say) picks up where it stopped.
 */
export default function StudioSetupPage() {
    const { project, organization, user } = useStudio();
    const { ask } = useStudioCopilot();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [state, setState] = useState<Saved>({ step: 1, kind: null, answers: { name: organization.name }, asked: 0, built: null });
    const [draft, setDraft] = useState("");
    const [building, setBuilding] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    // Pick up where they left off.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY(project.id));
            if (saved) setState(JSON.parse(saved) as Saved);
        } catch {
            // Starting fresh is fine.
        }
    }, [project.id]);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY(project.id), JSON.stringify(state));
        } catch {
            // Not kept on this device; the flow still works.
        }
    }, [project.id, state]);
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }, [state.asked, building]);

    // Back from connecting WhatsApp.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get("whatsapp");
        if (!outcome) return;
        const phoneNumberId = params.get("phone_number_id");
        window.history.replaceState(null, "", window.location.pathname);
        let saved: Saved | null = null;
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY(project.id)) ?? "null") as Saved | null;
        } catch {
            saved = null;
        }
        if (!saved?.built) return;
        if (outcome !== "connected") {
            setError("WhatsApp didn't finish connecting. You can try again, or do it later.");
            return;
        }
        setBusy(true);
        call(`/api/projects/${project.id}/embedded-agents/${saved.built.agentId}/whatsapp`, "POST", { action: "kapso_finish", ...(phoneNumberId ? { phone_number_id: phoneNumberId } : {}) })
            .then(() => setState((current) => ({ ...current, step: 5 })))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't finish connecting WhatsApp."))
            .finally(() => setBusy(false));
    }, [project.id]);

    const kind = state.kind;
    const questions = kind ? setupQuestions(kind) : [];
    const current = questions[state.asked];

    const answer = (value: string | null) => {
        if (!current) return;
        const text = value?.trim() ?? "";
        if (!text && !current.optional) return;
        setDraft("");
        const answers = { ...state.answers, [current.key]: text };
        const asked = state.asked + 1;
        setState((s) => ({ ...s, answers, asked }));
        if (asked >= questions.length && kind) void build(kind, answers);
    };

    // Build the assistant the same way Copilot does, as the signed-in owner.
    const build = async (businessKind: BusinessKind, answers: Answers) => {
        setError(null);
        const done: string[] = [];
        const tick = (label: string) => {
            done.push(label);
            setBuilding([...done]);
        };
        setBuilding([]);
        const studio = `/api/projects/${project.id}/embedded-agents/studio`;
        try {
            const name = answers.name?.trim() || organization.name;
            const created = await call<{ agent_id: string; version_id: string }>(studio, "POST", {
                action: "create_agent",
                name,
                description: BUSINESS_KINDS.find((item) => item.id === businessKind)?.name ?? "",
                model: BUSINESS_MODEL,
                instructions: setupInstructions(businessKind, answers),
                ...(businessKind === "restaurant" ? { template: "restaurant" } : {}),
            });
            tick("Created your assistant");
            const knowledge = setupKnowledge(businessKind, answers);
            const agentBase = `/api/projects/${project.id}/embedded-agents/${created.agent_id}`;
            if (knowledge) {
                await call(`${agentBase}/knowledge`, "POST", knowledge);
                tick(businessKind === "restaurant" ? "Added your menu" : "Added your prices");
            }
            await call(studio, "POST", { action: "save_tools", agent_id: created.agent_id, version_id: created.version_id, system_tools: { end_conversation: {}, request_callback: {} } });
            if (user.email) await call(`${agentBase}/alerts`, "PUT", { emails: [user.email], ...(businessKind === "restaurant" ? { time_zone: "Africa/Lagos" } : {}) }).catch(() => undefined);
            tick("Set it to tell you when someone needs you");
            await call(studio, "POST", { action: "test_version", agent_id: created.agent_id, version_id: created.version_id, input: "Hello" });
            await call(studio, "POST", { action: "publish_version", agent_id: created.agent_id, version_id: created.version_id });
            tick("Tested it and made it live");
            const widget = await call<{ widget: { public_key: string }; preview_token: string; share_token: string | null }>(`${agentBase}/widget`, "PUT", {});
            tick("Made your link");
            void queryClient.invalidateQueries();
            setState((s) => ({ ...s, step: 3, built: { agentId: created.agent_id, publicKey: widget.widget.public_key, previewToken: widget.preview_token, shareToken: widget.share_token } }));
            setBuilding(null);
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Setting up didn't finish. Try again.");
            setBuilding(null);
        }
    };

    const connectWhatsApp = async () => {
        if (!state.built) return;
        setBusy(true);
        setError(null);
        try {
            const { url } = await call<{ url: string }>(`/api/projects/${project.id}/embedded-agents/${state.built.agentId}/whatsapp`, "POST", { action: "kapso_link", return_path: "/setup" });
            window.location.assign(url);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't start connecting WhatsApp.");
            setBusy(false);
        }
    };

    const copyLink = async () => {
        if (!state.built?.shareToken) return;
        const url = shareUrl(state.built.shareToken);
        try {
            if (navigator.share) await navigator.share({ title: state.answers.name ?? organization.name, url });
            else await navigator.clipboard.writeText(url);
        } catch {
            // Dismissed the share sheet.
        }
    };

    const finish = () => {
        try {
            localStorage.removeItem(STORAGE_KEY(project.id));
        } catch {
            // Nothing to clear.
        }
        router.push("/");
    };

    const back = state.step > 1 && state.step < 3 && !building ? () => setState((s) => ({ ...s, step: s.step - 1, asked: 0 })) : null;

    return (
        <div className="flex min-h-svh flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
            <div className="flex h-10 items-center justify-between">
                {back ? (
                    <button type="button" onClick={back} aria-label="Back" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full"><ChevronLeft className="h-5 w-5" /></button>
                ) : (
                    <Link href="/" className="text-[15px] font-semibold tracking-tight">Cencori Studio</Link>
                )}
                <span className="text-[13px] text-muted-foreground">Step {state.step} of 5</span>
            </div>
            <div className="mt-3"><Progress step={state.step} /></div>
            {error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] leading-5 text-destructive">{error}</p>}

            {state.step === 1 && (
                <>
                    <h1 className="mt-8 text-[28px] font-semibold leading-tight tracking-tight">What kind of business do you run?</h1>
                    <p className="mt-2 text-[15px] leading-6 text-muted-foreground">Your assistant starts with what businesses like yours need. You can change anything later.</p>
                    <div className="mt-6 grid grid-cols-2 gap-2.5">
                        {BUSINESS_KINDS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setState((s) => ({ ...s, kind: item.id }))}
                                className={cn("min-h-24 rounded-2xl border p-3.5 text-left", state.kind === item.id ? "border-2 border-foreground p-[13px]" : "border-border/60")}
                            >
                                <span className="block text-[15px] font-semibold">{item.name}</span>
                                <span className="mt-1 block text-xs leading-4 text-muted-foreground">{item.hint}</span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-auto pt-8">
                        <button type="button" disabled={!state.kind} onClick={() => setState((s) => ({ ...s, step: 2, asked: 0 }))} className="h-[52px] w-full rounded-full bg-foreground text-base font-semibold text-background disabled:opacity-40">Continue</button>
                    </div>
                </>
            )}

            {state.step === 2 && kind && (
                <>
                    <h1 className="mt-6 text-2xl font-semibold leading-tight tracking-tight">Tell it about your business</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Answer like you&apos;d brief a new member of staff.</p>
                    <div className="mt-5 flex flex-1 flex-col gap-3">
                        {questions.slice(0, state.asked + 1).map((question, index) => (
                            <div key={question.key} className="flex flex-col gap-3">
                                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-[15px] leading-6">{question.ask(state.answers)}</div>
                                {index < state.asked && (
                                    <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-6 text-background">
                                        {state.answers[question.key] || <span className="opacity-70">Skipped</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                        {building && (
                            <div className="rounded-2xl border border-border/60 px-4 py-3.5">
                                <p className="text-[15px] font-semibold">Setting up your assistant…</p>
                                <ul className="mt-2 space-y-1.5">
                                    {building.map((line) => <li key={line} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-emerald-600" />{line}</li>)}
                                    <li className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Working…</li>
                                </ul>
                            </div>
                        )}
                        {!building && state.asked >= questions.length && error && (
                            <button type="button" onClick={() => void build(kind, state.answers)} className="h-11 rounded-full border border-border/60 text-sm font-medium">Try again</button>
                        )}
                        <div ref={endRef} />
                    </div>
                    {current && !building && (
                        <div className="sticky bottom-0 -mx-5 mt-4 border-t border-border/60 bg-background px-5 pt-3">
                            {(current.choices || current.optional) && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {current.choices?.map((choice) => (
                                        <button key={choice} type="button" onClick={() => answer(choice)} className="h-9 rounded-full border border-border/60 px-4 text-sm">{choice}</button>
                                    ))}
                                    {current.optional && <button type="button" onClick={() => answer(null)} className="h-9 rounded-full border border-border/60 px-4 text-sm text-muted-foreground">Skip</button>}
                                </div>
                            )}
                            <form onSubmit={(event) => { event.preventDefault(); answer(draft); }} className="flex items-end gap-2">
                                <label className="flex min-h-12 flex-1 items-center rounded-3xl bg-muted px-4 py-2">
                                    <span className="sr-only">{current.ask(state.answers)}</span>
                                    {current.long ? (
                                        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder={current.placeholder} className="max-h-40 w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground" />
                                    ) : (
                                        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={current.placeholder} autoFocus className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
                                    )}
                                </label>
                                <button type="submit" disabled={!draft.trim()} aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"><ArrowUp className="h-5 w-5" /></button>
                            </form>
                        </div>
                    )}
                </>
            )}

            {state.step === 3 && state.built && (
                <>
                    <h1 className="mt-6 text-2xl font-semibold leading-tight tracking-tight">Try it like a customer</h1>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">This is a preview: nothing you say here counts as a real chat.</p>
                    <iframe
                        title="Preview your assistant"
                        src={`${new URL(getMainSiteUrl("/")).origin}/api/widget/frame/${state.built.publicKey}?mode=inline&preview=${encodeURIComponent(state.built.previewToken)}`}
                        className="mt-4 h-[52svh] w-full rounded-3xl border border-border/60"
                    />
                    <button type="button" onClick={() => ask("Something about my assistant is off. ")} className="mt-3 text-left text-[13px] text-muted-foreground underline underline-offset-2">Something off? Tell Copilot what to change</button>
                    <div className="mt-auto pt-6">
                        <button type="button" onClick={() => setState((s) => ({ ...s, step: 4 }))} className="h-[52px] w-full rounded-full bg-foreground text-base font-semibold text-background">Looks good</button>
                    </div>
                </>
            )}

            {state.step === 4 && state.built && (
                <>
                    <h1 className="mt-6 text-2xl font-semibold leading-tight tracking-tight">Where should customers find it?</h1>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">Your link works right away. Connect WhatsApp now or later.</p>
                    <div className="mt-5 overflow-hidden rounded-2xl border border-border/60">
                        <div className="flex items-center gap-3 px-4 py-3.5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Link2 className="h-5 w-5" /></span>
                            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Your link</span><span className="block truncate text-[13px] text-muted-foreground">For Instagram, a QR code or a table card</span></span>
                            <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">Ready</span>
                        </div>
                        <div className="flex items-center gap-3 border-t border-border/60 px-4 py-3.5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.4A8.4 8.4 0 1 1 21 11.5z" /></svg>
                            </span>
                            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">WhatsApp</span><span className="block text-[13px] text-muted-foreground">The WhatsApp Business number you already use</span></span>
                            <button type="button" onClick={() => void connectWhatsApp()} disabled={busy} className="h-9 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">{busy ? "…" : "Connect"}</button>
                        </div>
                    </div>
                    <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">Facebook will ask you to log in, confirm your business and approve the connection in the WhatsApp Business app. About two minutes.</p>
                    <div className="mt-auto flex flex-col gap-2 pt-6">
                        <button type="button" onClick={() => setState((s) => ({ ...s, step: 5 }))} className="h-[52px] w-full rounded-full bg-foreground text-base font-semibold text-background">Continue</button>
                        <button type="button" onClick={() => setState((s) => ({ ...s, step: 5 }))} className="h-10 text-sm text-muted-foreground">I&apos;ll do this later</button>
                    </div>
                </>
            )}

            {state.step === 5 && (
                <>
                    <div className="mt-10 flex flex-col items-center text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Check className="h-8 w-8" strokeWidth={2.4} /></span>
                        <h1 className="mt-4 text-[26px] font-semibold tracking-tight">You&apos;re live</h1>
                        <p className="mt-2 max-w-xs text-[15px] leading-6 text-muted-foreground">Customers can chat with {state.answers.name || organization.name} now. Put your link where they&apos;ll see it.</p>
                    </div>
                    {state.built?.shareToken && (
                        <div className="mt-6 rounded-2xl border border-border/60 px-4 py-3.5">
                            <p className="text-[13px] text-muted-foreground">Your link</p>
                            <p className="mt-0.5 truncate text-sm font-semibold">{shareUrl(state.built.shareToken).replace(/^https?:\/\//, "")}</p>
                            <button type="button" onClick={() => void copyLink()} className="mt-3 h-9 rounded-full border border-border/60 px-4 text-sm font-semibold">Share link</button>
                        </div>
                    )}
                    <div className="mt-3 rounded-2xl bg-muted px-4 py-3.5">
                        <p className="text-sm font-semibold">Never miss a customer</p>
                        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Add Studio to your home screen: in your browser&apos;s menu, choose &ldquo;Add to Home Screen&rdquo;.</p>
                    </div>
                    <div className="mt-auto pt-6">
                        <button type="button" onClick={finish} className="h-[52px] w-full rounded-full bg-foreground text-base font-semibold text-background">Go to Home</button>
                    </div>
                </>
            )}
        </div>
    );
}
