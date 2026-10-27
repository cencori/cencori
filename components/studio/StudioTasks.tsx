"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Loader2, X } from "lucide-react";
import { useStudio } from "@/components/studio/StudioShell";
import { studioFetch } from "@/components/studio/studio-data";
import { resizePhoto } from "@/lib/studio/resize-photo";
import { cn } from "@/lib/utils";

/**
 * Setting the assistant up, in Studio: each "Finish setting up" step (and
 * each page Copilot would otherwise send to the console) is a bottom sheet
 * here. It changes the same assistant the console shows, so a developer who
 * signs in there sees everything done from Studio.
 */

export type StudioTask = "knowledge" | "whatsapp" | "golive" | "alerts" | "payments" | "plans" | "later";

const TasksContext = createContext<{ open: (task: StudioTask) => void } | null>(null);

export function useStudioTasks() {
    const value = useContext(TasksContext);
    if (!value) throw new Error("useStudioTasks must be used inside Studio");
    return value;
}

/** The sheet for a "Finish setting up" step, or null when Copilot should help instead. */
export function taskForStep(step: string): StudioTask | null {
    const text = step.toLowerCase();
    if (text.startsWith("add knowledge")) return "knowledge";
    if (text.startsWith("go live")) return "golive";
    if (text.startsWith("connect whatsapp")) return "whatsapp";
    if (text.startsWith("set owner alerts")) return "alerts";
    if (text.startsWith("connect a payment provider") || text.startsWith("connect payments")) return "payments";
    return null;
}

/** The sheet for one of Copilot's "open the page" offers (by its title). */
export function taskForCopilotPage(title: string): StudioTask {
    const text = title.toLowerCase();
    if (text.includes("whatsapp")) return "whatsapp";
    if (text.includes("payment")) return "payments";
    return "later";
}

async function send<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
    const response = await studioFetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "That didn't work. Try again.");
    return json as T;
}

const TITLES: Record<StudioTask, string> = {
    knowledge: "Add knowledge",
    whatsapp: "Connect WhatsApp",
    golive: "Go live",
    alerts: "Get told when someone needs you",
    payments: "Get paid by link",
    plans: "Choose a plan",
    later: "Coming to Studio soon",
};

export function StudioTasksProvider({ children }: { children: ReactNode }) {
    const [task, setTask] = useState<StudioTask | null>(null);
    const open = useCallback((next: StudioTask) => setTask(next), []);
    const [notice, setNotice] = useState<string | null>(null);
    const { project, agents } = useStudio();
    const queryClient = useQueryClient();
    const finishing = useRef(false);

    // Back from paying for a plan (Bachs returns here with ?plan=paid). The plan
    // itself switches on when Bachs tells us (the billing webhook), moments later.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("plan") !== "paid") return;
        window.history.replaceState(null, "", window.location.pathname);
        setNotice("Payment received. Your plan is on: thank you!");
        const refresh = () => void queryClient.invalidateQueries();
        refresh();
        const later = window.setTimeout(refresh, 5000);
        return () => window.clearTimeout(later);
    }, [queryClient]);

    // Back from connecting WhatsApp (Kapso returns here with ?whatsapp=…).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get("whatsapp");
        const agentId = agents[0]?.id;
        if (!outcome || !agentId || finishing.current || window.location.pathname.startsWith("/setup")) return;
        finishing.current = true;
        const phoneNumberId = params.get("phone_number_id");
        window.history.replaceState(null, "", window.location.pathname);
        if (outcome !== "connected") {
            setNotice("WhatsApp didn't finish connecting. You can try again from Home.");
            return;
        }
        send(`/api/projects/${project.id}/embedded-agents/${agentId}/whatsapp`, "POST", { action: "kapso_finish", ...(phoneNumberId ? { phone_number_id: phoneNumberId } : {}) })
            .then(() => {
                setNotice("WhatsApp is connected. Your assistant answers there now.");
                void queryClient.invalidateQueries();
            })
            .catch((cause) => setNotice(cause instanceof Error ? cause.message : "Couldn't finish connecting WhatsApp."));
    }, [agents, project.id, queryClient]);

    return (
        <TasksContext.Provider value={{ open }}>
            {children}
            <Drawer.Root open={!!task} onOpenChange={(next) => { if (!next) setTask(null); }}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/30" />
                    <Drawer.Content className="dashboard-theme fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[92svh] max-w-md flex-col rounded-t-3xl border-t border-border/60 bg-background font-sans text-foreground outline-none">
                        <div className="flex items-center justify-between px-5 pt-3">
                            <Drawer.Title className="text-[17px] font-semibold">{task ? TITLES[task] : ""}</Drawer.Title>
                            <button type="button" onClick={() => setTask(null)} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button>
                        </div>
                        <Drawer.Description className="sr-only">Set up your assistant without leaving Studio.</Drawer.Description>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1">
                            {task && <TaskBody task={task} onDone={() => { setTask(null); void queryClient.invalidateQueries(); }} />}
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
            {notice && (
                <div role="status" className="fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm shadow-sm">
                    <span className="flex-1">{notice}</span>
                    <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
                </div>
            )}
        </TasksContext.Provider>
    );
}

function TaskBody({ task, onDone }: { task: StudioTask; onDone: () => void }) {
    const { project, agents, user, organization } = useStudio();
    const agentId = agents[0]?.id ?? null;
    if (task === "plans") return <PlansTask organizationId={organization.id} />;
    if (task === "later") {
        return (
            <>
                <p className="text-[15px] leading-6 text-muted-foreground">This one can&apos;t be done from Studio yet. Your assistant works fine without it, and we&apos;re bringing it here soon.</p>
                <button type="button" onClick={onDone} className="mt-5 h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background">OK</button>
            </>
        );
    }
    if (!agentId) {
        return <p className="text-[15px] leading-6 text-muted-foreground">Set up your assistant first, then come back to this.</p>;
    }
    const agentBase = `/api/projects/${project.id}/embedded-agents/${agentId}`;
    if (task === "knowledge") return <KnowledgeTask agentBase={agentBase} projectId={project.id} onDone={onDone} />;
    if (task === "whatsapp") return <WhatsAppTask agentBase={agentBase} />;
    if (task === "golive") return <GoLiveTask projectId={project.id} agentId={agentId} agentBase={agentBase} onDone={onDone} />;
    if (task === "alerts") return <AlertsTask agentBase={agentBase} email={user.email} onDone={onDone} />;
    return <PaymentsTask projectId={project.id} onDone={onDone} />;
}

function Primary({ children, busy, disabled, onClick }: { children: ReactNode; busy?: boolean; disabled?: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} disabled={busy || disabled} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}
        </button>
    );
}

function ErrorLine({ error }: { error: string | null }) {
    return error ? <p role="alert" className="mt-3 text-[13px] leading-5 text-destructive">{error}</p> : null;
}

const field = "w-full rounded-2xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground";

/** What the assistant should know: typed or pasted, read from a photo, or a website. */
function KnowledgeTask({ agentBase, projectId, onDone }: { agentBase: string; projectId: string; onDone: () => void }) {
    const [mode, setMode] = useState<"text" | "website">("text");
    const [name, setName] = useState("");
    const [text, setText] = useState("");
    const [url, setUrl] = useState("");
    const [busy, setBusy] = useState<"saving" | "reading" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const photo = useRef<HTMLInputElement>(null);

    const readPhotos = async (files: FileList | null) => {
        if (!files?.length) return;
        setBusy("reading");
        setError(null);
        try {
            const images = await Promise.all(Array.from(files).slice(0, 4).map((file) => resizePhoto(file)));
            const { text: read } = await send<{ text: string }>("/api/studio/menu-photo", "POST", { project_id: projectId, images });
            setText((current) => (current.trim() ? `${current.trim()}\n\n${read}` : read));
            if (!name.trim()) setName("Menu");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't read that photo.");
        } finally {
            setBusy(null);
            if (photo.current) photo.current.value = "";
        }
    };

    const save = async () => {
        setBusy("saving");
        setError(null);
        try {
            if (mode === "website") await send(`${agentBase}/knowledge`, "POST", { url: url.trim(), kind: "website" });
            else await send(`${agentBase}/knowledge`, "POST", { name: name.trim() || "About the business", text: text.trim() });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't add that.");
            setBusy(null);
        }
    };

    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">What your assistant answers from: your menu or prices, opening hours, policies, anything customers ask.</p>
            <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
                {(["text", "website"] as const).map((item) => (
                    <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)} className={cn("h-9 rounded-full text-sm font-medium", mode === item ? "bg-background" : "text-muted-foreground")}>
                        {item === "text" ? "Type or photo" : "Your website"}
                    </button>
                ))}
            </div>
            {mode === "text" ? (
                <>
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name it, e.g. Menu" className={cn(field, "mt-4 h-12")} />
                    <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} placeholder="Jollof rice ₦6,500…" className={cn(field, "mt-2 resize-none py-3 leading-6")} />
                    <input ref={photo} type="file" accept="image/*" multiple hidden onChange={(event) => void readPhotos(event.target.files)} />
                    <button type="button" onClick={() => photo.current?.click()} disabled={busy !== null} className="mt-2 flex h-10 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm disabled:opacity-60">
                        {busy === "reading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{busy === "reading" ? "Reading your photo…" : "Take a photo instead"}
                    </button>
                </>
            ) : (
                <input value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" autoCapitalize="none" placeholder="yourbusiness.com" className={cn(field, "mt-4 h-12")} />
            )}
            <ErrorLine error={error} />
            <Primary busy={busy === "saving"} disabled={mode === "text" ? !text.trim() : !url.trim()} onClick={() => void save()}>Add it</Primary>
        </>
    );
}

/** The WhatsApp Business number they already use (Kapso's setup page, then back to Studio). */
function WhatsAppTask({ agentBase }: { agentBase: string }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const connect = async () => {
        setBusy(true);
        setError(null);
        try {
            const { url } = await send<{ url: string }>(`${agentBase}/whatsapp`, "POST", { action: "kapso_link", return_path: "/" });
            window.location.assign(url);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't start connecting WhatsApp.");
            setBusy(false);
        }
    };
    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">Your assistant answers on the WhatsApp Business number you already use. You keep using the WhatsApp Business app on your phone too.</p>
            <p className="mt-3 text-[13px] leading-5 text-muted-foreground">Facebook will ask you to log in, confirm your business and approve the connection in the WhatsApp Business app. About two minutes; you come back here after.</p>
            <ErrorLine error={error} />
            <Primary busy={busy} onClick={() => void connect()}>Connect WhatsApp</Primary>
        </>
    );
}

/** Test the latest version and make it what customers talk to. */
function GoLiveTask({ projectId, agentId, agentBase, onDone }: { projectId: string; agentId: string; agentBase: string; onDone: () => void }) {
    const [steps, setSteps] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const studio = `/api/projects/${projectId}/embedded-agents/studio`;
    const goLive = async () => {
        setBusy(true);
        setError(null);
        setSteps([]);
        try {
            const { version_id } = await send<{ version_id: string }>(studio, "POST", { action: "new_version", agent_id: agentId });
            await send(studio, "POST", { action: "test_version", agent_id: agentId, version_id, input: "Hello" });
            setSteps((s) => [...s, "Tested it"]);
            await send(studio, "POST", { action: "publish_version", agent_id: agentId, version_id });
            setSteps((s) => [...s, "Made it live"]);
            await send(`${agentBase}/widget`, "PUT", {}).catch(() => undefined);
            setSteps((s) => [...s, "Your link is ready"]);
            setTimeout(onDone, 700);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't make it live. Try again.");
            setBusy(false);
        }
    };
    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">Your assistant is ready but not answering customers yet. Going live tests it once, then turns it on for your link, website and WhatsApp.</p>
            {steps.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                    {steps.map((step) => <li key={step} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-emerald-600" />{step}</li>)}
                </ul>
            )}
            <ErrorLine error={error} />
            <Primary busy={busy} onClick={() => void goLive()}>Go live</Primary>
        </>
    );
}

/** Who gets emailed about bookings, callbacks and payments. */
function AlertsTask({ agentBase, email, onDone }: { agentBase: string; email: string | null; onDone: () => void }) {
    const [emails, setEmails] = useState(email ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await send(`${agentBase}/alerts`, "PUT", { emails: emails.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean) });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save that.");
            setBusy(false);
        }
    };
    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">We&apos;ll email you when a customer books, asks for a callback or pays. Add more than one address with commas.</p>
            <input value={emails} onChange={(event) => setEmails(event.target.value)} inputMode="email" autoCapitalize="none" placeholder="you@business.com" className={cn(field, "mt-4 h-12")} />
            <ErrorLine error={error} />
            <Primary busy={busy} disabled={!emails.trim()} onClick={() => void save()}>Save</Primary>
        </>
    );
}

/** A payment provider account, by its secret key, so the assistant can send payment links. */
function PaymentsTask({ projectId, onDone }: { projectId: string; onDone: () => void }) {
    const [providers, setProviders] = useState<Array<{ id: string; name: string; key_help: string; key_placeholder: string; available: boolean }>>([]);
    const [provider, setProvider] = useState("paystack");
    const [key, setKey] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        send<{ providers: typeof providers }>(`/api/projects/${projectId}/payments`, "GET")
            .then((body) => setProviders(body.providers.filter((item) => item.available)))
            .catch(() => undefined);
    }, [projectId]);
    const chosen = providers.find((item) => item.id === provider);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await send(`/api/projects/${projectId}/payments`, "PUT", { provider, secret_key: key.trim() });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't connect that.");
            setBusy(false);
        }
    };
    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">Customers pay through a link and the money goes straight to your account. Cencori never holds it.</p>
            <div className="mt-4 flex flex-wrap gap-2">
                {(providers.length ? providers : [{ id: "paystack", name: "Paystack" }]).map((item) => (
                    <button key={item.id} type="button" onClick={() => setProvider(item.id)} className={cn("h-10 rounded-full border px-4 text-sm", provider === item.id ? "border-foreground bg-foreground text-background" : "border-border/60")}>{item.name}</button>
                ))}
            </div>
            <input value={key} onChange={(event) => setKey(event.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder={chosen?.key_placeholder || "Secret key"} className={cn(field, "mt-4 h-12 font-mono text-sm")} />
            {chosen?.key_help && <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{chosen.key_help}</p>}
            <ErrorLine error={error} />
            <Primary busy={busy} disabled={!key.trim()} onClick={() => void save()}>Connect</Primary>
        </>
    );
}

interface BusinessPlanOption { id: string; name: string; price_ngn: number; conversations: number; agents: number; all_models: boolean }

/** Starter, Growth or Business: a 30-day pass, paid through Bachs, back to Studio after. */
function PlansTask({ organizationId }: { organizationId: string }) {
    const [data, setData] = useState<{ plan: { id: string } | null; active: boolean; plans: BusinessPlanOption[] } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        send<NonNullable<typeof data>>(`/api/billing/business?orgId=${organizationId}`, "GET")
            .then(setData)
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load the plans."));
    }, [organizationId]);
    const choose = async (plan: string) => {
        setBusy(plan);
        setError(null);
        try {
            const { url } = await send<{ url: string }>("/api/billing/business", "POST", { orgId: organizationId, action: "checkout", plan });
            window.location.assign(url);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't open checkout.");
            setBusy(null);
        }
    };
    const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;
    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">Each plan runs for 30 days. Pay by card, bank transfer or USSD. Paying early keeps the days you have left.</p>
            {!data && !error && <div className="mt-5 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <div className="mt-4 flex flex-col gap-2.5">
                {data?.plans.map((option) => {
                    const current = data.active && data.plan?.id === option.id;
                    return (
                        <div key={option.id} className={cn("rounded-2xl border px-4 py-3.5", current ? "border-foreground" : "border-border/60")}>
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-[15px] font-semibold">{option.name}</span>
                                <span className="text-[15px] font-semibold">{naira(option.price_ngn)}<span className="text-xs font-normal text-muted-foreground"> / 30 days</span></span>
                            </div>
                            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                                {option.conversations.toLocaleString("en-NG")} customer chats · {option.agents} {option.agents === 1 ? "assistant" : "assistants"}{option.all_models ? " · every AI model" : ""}
                            </p>
                            <button type="button" disabled={busy !== null} onClick={() => void choose(option.id)} className={cn("mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60", current ? "border border-border/60" : "bg-foreground text-background")}>
                                {busy === option.id && <Loader2 className="h-4 w-4 animate-spin" />}{current ? "Pay for another 30 days" : `Choose ${option.name}`}
                            </button>
                        </div>
                    );
                })}
            </div>
            <ErrorLine error={error} />
        </>
    );
}
