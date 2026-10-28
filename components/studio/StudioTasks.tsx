"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Camera, Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useStudio } from "@/components/studio/StudioShell";
import { studioFetch } from "@/components/studio/studio-data";
import { resizePhoto } from "@/lib/studio/resize-photo";
import { cn } from "@/lib/utils";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { ProductsTask } from "@/components/studio/StudioProducts";

/**
 * Setting the assistant up, in Studio: each "Finish setting up" step (and
 * each page Copilot would otherwise send to the console) is a bottom sheet
 * here. It changes the same assistant the console shows, so a developer who
 * signs in there sees everything done from Studio.
 */

export type StudioTask = "knowledge" | "products" | "whatsapp" | "website" | "golive" | "alerts" | "payments" | "plans" | "business" | "newbusiness" | "later";

/** Another business the ⋯ menu acts on (never the open one). */
export type BusinessTarget = { id: string; name: string; isBusiness: boolean };

/** business: the business the ⋯ menu acts on. agentId: which assistant (else the first). */
type TaskOptions = { business?: BusinessTarget; agentId?: string };

const TasksContext = createContext<{ open: (task: StudioTask, options?: TaskOptions) => void } | null>(null);

export function useStudioTasks() {
    const value = useContext(TasksContext);
    if (!value) throw new Error("useStudioTasks must be used inside Studio");
    return value;
}

/** The sheet for a "Finish setting up" step, or null when Copilot should help instead. */
export function taskForStep(step: string): StudioTask | null {
    const text = step.toLowerCase();
    if (text.startsWith("add knowledge")) return "knowledge";
    if (text.startsWith("add products")) return "products";
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
    if (text.includes("website")) return "website";
    if (text.includes("product")) return "products";
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
    products: "Add products",
    whatsapp: "Connect WhatsApp",
    website: "Chat on your website",
    golive: "Go live",
    alerts: "Get told when someone needs you",
    payments: "Get paid by link",
    plans: "Choose a plan",
    business: "",
    newbusiness: "New business",
    later: "Coming to Studio soon",
};

export function StudioTasksProvider({ children }: { children: ReactNode }) {
    const [task, setTask] = useState<StudioTask | null>(null);
    const [target, setTarget] = useState<BusinessTarget | null>(null);
    const [agentId, setAgentId] = useState<string | null>(null);
    const open = useCallback((next: StudioTask, options?: TaskOptions) => {
        setTarget(options?.business ?? null);
        setAgentId(options?.agentId ?? null);
        setTask(next);
    }, []);
    const [notice, setNotice] = useState<string | null>(null);
    const { project, agents } = useStudio();
    const queryClient = useQueryClient();
    const finishing = useRef(false);

    // Back from paying for a plan (Bachs returns here with ?plan=paid). The plan
    // itself switches on when Bachs tells us (the billing webhook), moments later.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        // From a plan reminder (push or email): open the plans.
        if (params.get("plan") === "choose") {
            window.history.replaceState(null, "", window.location.pathname);
            open("plans");
            return;
        }
        if (params.get("plan") !== "paid") return;
        window.history.replaceState(null, "", window.location.pathname);
        setNotice("Payment received. Your plan is on: thank you!");
        const refresh = () => void queryClient.invalidateQueries();
        refresh();
        const later = window.setTimeout(refresh, 5000);
        return () => window.clearTimeout(later);
    }, [queryClient, open]);

    // Back from connecting WhatsApp (Kapso returns here with ?whatsapp=…).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get("whatsapp");
        const agentId = agents[0]?.id;
        if (!outcome || !agentId || finishing.current || window.location.pathname.startsWith("/setup")) return;
        finishing.current = true;
        // Meta's own signup: the server already connected it on the way back.
        if (params.get("via") === "meta") {
            window.history.replaceState(null, "", window.location.pathname);
            setNotice(outcome === "connected" ? "WhatsApp is connected. Your assistant answers there now." : (params.get("message") || "WhatsApp didn't finish connecting. Try again."));
            void queryClient.invalidateQueries();
            return;
        }
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
                            <Drawer.Title className="min-w-0 truncate text-[17px] font-semibold">{task === "business" ? target?.name ?? "" : task ? TITLES[task] : ""}</Drawer.Title>
                            <button type="button" onClick={() => setTask(null)} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button>
                        </div>
                        <Drawer.Description className="sr-only">Set up your assistant without leaving Studio.</Drawer.Description>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1">
                            {task === "business" && target
                                ? <BusinessTask target={target} onDone={() => { setTask(null); void queryClient.invalidateQueries(); }} />
                                : task && task !== "business" && <TaskBody task={task} agentId={agentId} onDone={() => { setTask(null); void queryClient.invalidateQueries(); }} />}
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

function TaskBody({ task, agentId: chosen, onDone }: { task: StudioTask; agentId: string | null; onDone: () => void }) {
    const { project, agents, user, organization } = useStudio();
    const agentId = chosen ?? agents[0]?.id ?? null;
    if (task === "plans") return <PlansTask organizationId={organization.id} />;
    if (task === "newbusiness") return <NewBusinessTask />;
    if (task === "products") return <ProductsTask onDone={onDone} />;
    if (task === "later") {
        return (
            <>
                <p className="text-[15px] leading-6 text-muted-foreground">Not in Studio yet. Coming soon.</p>
                <button type="button" onClick={onDone} className="mt-5 h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background">OK</button>
            </>
        );
    }
    if (!agentId) {
        return <p className="text-[15px] leading-6 text-muted-foreground">Set up your assistant first.</p>;
    }
    const agentBase = `/api/projects/${project.id}/embedded-agents/${agentId}`;
    if (task === "knowledge") return <KnowledgeTask agentBase={agentBase} projectId={project.id} onDone={onDone} />;
    if (task === "whatsapp") return <WhatsAppTask agentBase={agentBase} projectId={project.id} agentId={agentId} />;
    if (task === "website") return <WebsiteTask agentBase={agentBase} />;
    if (task === "golive") return <GoLiveTask projectId={project.id} agentId={agentId} agentBase={agentBase} onDone={onDone} />;
    if (task === "alerts") return <AlertsTask agentBase={agentBase} email={user.email} onDone={onDone} />;
    return <PaymentsTask projectId={project.id} onDone={onDone} />;
}

function Primary({ children, busy, disabled, onClick }: { children: ReactNode; busy?: boolean; disabled?: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} disabled={busy || disabled} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-50">
            {busy && <Spinner className="h-4 w-4 animate-spin" />}{children}
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
                        {busy === "reading" ? <Spinner className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{busy === "reading" ? "Reading your photo…" : "Take a photo instead"}
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
type WhatsAppState = { channel: { display_phone_number?: string | null } | null; signup: { app_id: string } | null; kapso: boolean };

/**
 * Connect WhatsApp: Meta's own signup as a full page (it works from an app
 * installed on the phone, where popups can't report back), or Kapso's.
 */
function WhatsAppTask({ agentBase, projectId, agentId }: { agentBase: string; projectId: string; agentId: string }) {
    const [state, setState] = useState<WhatsAppState | null>(null);
    const [keepApp, setKeepApp] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        send<WhatsAppState>(`${agentBase}/whatsapp`, "GET")
            .then(setState)
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load it."));
    }, [agentBase]);

    const withMeta = () => {
        setBusy(true);
        window.location.assign(`/api/studio/whatsapp/start?project_id=${projectId}&agent_id=${agentId}&coexistence=${keepApp ? 1 : 0}`);
    };
    const withKapso = async () => {
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

    if (!state) return error ? <ErrorLine error={error} /> : <div className="mt-5 flex justify-center"><Spinner className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
    if (state.channel) {
        return <p className="flex items-center gap-2 text-[15px] leading-6"><Check className="h-4 w-4 text-emerald-600" />Connected{state.channel.display_phone_number ? `: ${state.channel.display_phone_number}` : ""}</p>;
    }
    // Meta only returns to https addresses, so the local dev server (http) uses Kapso.
    if (!state.signup || window.location.protocol !== "https:") {
        return (
            <>
                <ErrorLine error={error} />
                <Primary busy={busy} disabled={!state.kapso} onClick={() => void withKapso()}>Connect WhatsApp</Primary>
            </>
        );
    }
    return (
        <>
            <button type="button" onClick={() => setKeepApp((value) => !value)} className="flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">Keep the WhatsApp Business app</span>
                    <span className="block text-[13px] leading-5 text-muted-foreground">Same number. You can still reply from your phone.</span>
                </span>
                <span className={cn("flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors", keepApp ? "bg-emerald-600" : "bg-muted-foreground/30")}>
                    <span className={cn("h-6 w-6 rounded-full bg-white shadow transition-transform", keepApp && "translate-x-5")} />
                </span>
            </button>
            <ErrorLine error={error} />
            <Primary busy={busy} onClick={withMeta}>Connect WhatsApp</Primary>
            {state.kapso && (
                <button type="button" disabled={busy} onClick={() => void withKapso()} className="mt-4 w-full text-center text-[13px] text-muted-foreground disabled:opacity-50">Other way to connect</button>
            )}
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
type WidgetState = { enabled: boolean; allowed_origins: string[]; public_key: string } | null;

/** The chat bubble on the owner's own website: their address, then the code to paste (or send to whoever built the site). */
function WebsiteTask({ agentBase }: { agentBase: string }) {
    const { agents } = useStudio();
    const [widget, setWidget] = useState<WidgetState | undefined>(undefined);
    const [site, setSite] = useState("");
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        send<{ widget: WidgetState }>(`${agentBase}/widget`, "GET")
            .then((body) => {
                setWidget(body.widget ?? null);
                setSite(body.widget?.allowed_origins[0]?.replace(/^https?:\/\//, "") ?? "");
            })
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load it."));
    }, [agentBase]);

    const save = async (body: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        try {
            const result = await send<{ widget: WidgetState }>(`${agentBase}/widget`, "PUT", body);
            setWidget(result.widget);
            setSite("");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work.");
        } finally {
            setBusy(false);
        }
    };

    if (widget === undefined) {
        return error ? <ErrorLine error={error} /> : <div className="mt-5 flex justify-center"><Spinner className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
    }

    const on = !!widget?.enabled;
    const snippet = widget ? `<script src="${new URL(getMainSiteUrl("/")).origin}/widget.js" data-key="${widget.public_key}" async></script>` : "";
    const forDeveloper = `Please add this to every page of our website, just before </body>. It adds the chat bubble for our assistant.\n\n${snippet}`;
    const copy = async () => {
        await navigator.clipboard?.writeText(snippet).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };
    const shareWithDeveloper = async () => {
        if (navigator.share) {
            await navigator.share({ title: `${agents[0]?.name ?? "Our"} chat for the website`, text: forDeveloper }).catch(() => undefined);
            return;
        }
        await navigator.clipboard?.writeText(forDeveloper).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    if (!on) {
        const known = widget?.allowed_origins ?? [];
        return (
            <>
                <p className="text-[15px] leading-6 text-muted-foreground">Your website&apos;s address.</p>
                <input value={site} onChange={(event) => setSite(event.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="yourbusiness.com" className={cn(field, "mt-4 h-12")} />
                <ErrorLine error={error} />
                <Primary busy={busy} disabled={!site.trim()} onClick={() => void save({ allowed_origins: [...new Set([...known, site.trim()])], enabled: true })}>Turn on</Primary>
            </>
        );
    }

    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">On for {widget!.allowed_origins.map((origin) => origin.replace(/^https?:\/\//, "")).join(", ")}. Paste this on your site, before &lt;/body&gt;.</p>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-muted px-4 py-3 font-mono text-[12px] leading-5">{snippet}</pre>
            <div className="mt-3 flex gap-2.5">
                <button type="button" onClick={() => void copy()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border/60 text-[15px] font-medium">
                    {copied ? <><Check className="h-4 w-4" />Copied</> : "Copy code"}
                </button>
                <button type="button" onClick={() => void shareWithDeveloper()} className="h-12 flex-1 rounded-full bg-foreground text-[15px] font-semibold text-background">Send to developer</button>
            </div>
            <ErrorLine error={error} />
            <button type="button" disabled={busy} onClick={() => void save({ enabled: false })} className="mt-4 w-full text-center text-[13px] text-muted-foreground disabled:opacity-50">Turn off</button>
        </>
    );
}

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

interface BusinessPlanOption { id: string; name: string; price_ngn: number; conversations: number; agents: number; extras?: string[] }

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
            <p className="text-[15px] leading-6 text-muted-foreground">30 days each. Card, transfer or USSD.</p>
            {!data && !error && <div className="mt-5 flex justify-center"><Spinner className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <div className="mt-4 flex flex-col gap-2.5">
                {data?.plans.map((option) => {
                    const current = data.active && data.plan?.id === option.id;
                    return (
                        <div key={option.id} className={cn("rounded-2xl border px-4 py-3.5", current ? "border-foreground" : "border-border/60")}>
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-[15px] font-semibold">{option.name} <span className="text-xs font-normal text-muted-foreground">{naira(Math.round((option.price_ngn / option.conversations) * 100) / 100)} a chat</span></span>
                                <span className="text-[15px] font-semibold">{naira(option.price_ngn)}<span className="text-xs font-normal text-muted-foreground"> / 30 days</span></span>
                            </div>
                            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                                {option.conversations.toLocaleString("en-NG")} chats · {option.agents} {option.agents === 1 ? "assistant" : "assistants"}{option.extras?.length ? ` · ${option.extras.join(" · ")}` : ""}
                            </p>
                            <button type="button" disabled={busy !== null} onClick={() => void choose(option.id)} className={cn("mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60", current ? "border border-border/60" : "bg-foreground text-background")}>
                                {busy === option.id && <Spinner className="h-4 w-4 animate-spin" />}{current ? "Pay for another 30 days" : `Choose ${option.name}`}
                            </button>
                        </div>
                    );
                })}
            </div>
            <ErrorLine error={error} />
        </>
    );
}

/** The ⋯ menu for another business: rename it, or delete it and everything in it. */
function BusinessTask({ target, onDone }: { target: BusinessTarget; onDone: () => void }) {
    const router = useRouter();
    const [view, setView] = useState<"menu" | "rename" | "delete">("menu");
    const [name, setName] = useState(target.name);
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = async (method: "PATCH" | "DELETE", body: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await send("/api/studio/business", method, { organization_id: target.id, ...body });
            // The list of businesses comes with the page: load it again.
            router.refresh();
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work.");
            setBusy(false);
        }
    };

    if (view === "menu") {
        return (
            <div className="mt-2 divide-y divide-border/40 overflow-hidden rounded-2xl bg-muted/60">
                <button type="button" onClick={() => setView("rename")} className="flex h-13 w-full items-center px-4 py-3.5 text-left text-[15px]">Rename</button>
                {target.isBusiness ? (
                    <button type="button" onClick={() => setView("delete")} className="flex h-13 w-full items-center px-4 py-3.5 text-left text-[15px] text-destructive">Delete business</button>
                ) : (
                    // A developer organization holds API keys, logs and console projects: not deleted from a phone menu.
                    <p className="px-4 py-3.5 text-[13px] leading-5 text-muted-foreground">This is a developer organization. Delete it from the console.</p>
                )}
            </div>
        );
    }
    if (view === "rename") {
        const ready = !!name.trim() && name.trim() !== target.name;
        return (
            <>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} autoFocus placeholder="Arcie Lounge" className={cn(field, "mt-4 h-12")} onKeyDown={(event) => { if (event.key === "Enter" && ready) void run("PATCH", { name: name.trim() }); }} />
                <ErrorLine error={error} />
                <Primary busy={busy} disabled={!ready} onClick={() => void run("PATCH", { name: name.trim() })}>Save</Primary>
            </>
        );
    }
    return (
        <>
            <p className="text-[15px] leading-6 text-muted-foreground">
                Deletes <span className="font-semibold text-foreground">{target.name}</span> and everything in it. This can&apos;t be undone.
            </p>
            <p className="mt-4 text-[13px] text-muted-foreground">Type the name to confirm.</p>
            <input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder={target.name} className={cn(field, "mt-2 h-12")} />
            <ErrorLine error={error} />
            <button
                type="button"
                disabled={busy || confirm.trim() !== target.name}
                onClick={() => void run("DELETE", { confirm: confirm.trim() })}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-destructive text-[15px] font-semibold text-white disabled:opacity-40"
            >
                {busy && <Spinner className="h-4 w-4 animate-spin" />}Delete business
            </button>
        </>
    );
}

/** Another business, set up like signing up: its own free trial, then setup starts there. */
function NewBusinessTask() {
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const created = await send<{ organization_id: string }>("/api/studio/business", "POST", { name: name.trim() });
            await send("/api/studio/workspace", "POST", { organization_id: created.organization_id });
            // A full load into the new business, where Home starts its setup.
            window.location.assign("/");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't create the business.");
            setBusy(false);
        }
    };
    return (
        <>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} autoFocus placeholder="What's it called?" className={cn(field, "mt-4 h-12")} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) void create(); }} />
            <ErrorLine error={error} />
            <Primary busy={busy} disabled={!name.trim()} onClick={() => void create()}>Create business</Primary>
        </>
    );
}
