"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, QrCode, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useStudio } from "@/components/studio/StudioShell";
import { StudioLoadError, studioFetch } from "@/components/studio/studio-data";
import { StudioLink } from "@/components/studio/studio-nav";
import { StudioLinkQr } from "@/components/studio/StudioLinkQr";
import { useStudioCopilot } from "@/components/studio/StudioCopilot";
import { useStudioTasks } from "@/components/studio/StudioTasks";
import { useAssistants, useSetAssistantActive } from "@/components/studio/useAssistants";
import { useStudioOverview, type StudioAssistantSummary } from "@/components/studio/useStudioOverview";
import { assistantStatus } from "@/components/studio/views/AssistantView";
import { Skeleton } from "@/components/ui/skeleton";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { cn } from "@/lib/utils";

/** What each ability is called for an owner. */
const ABILITIES: Record<string, string> = {
    take_payments: "Send payment links",
    sell_products: "Take orders",
    request_callback: "Ask you to call customers back",
    transfer_to_human: "Hand customers over to you",
};

function abilities(assistant: StudioAssistantSummary): string[] {
    const list: string[] = ["Answer questions"];
    if (assistant.template === "restaurant") list.push(assistant.connected_apps.some((app) => /calendar/i.test(app.app)) ? "Take table bookings" : "Take table bookings (needs Google Calendar)");
    for (const tool of assistant.system_tools) if (ABILITIES[tool]) list.push(ABILITIES[tool]);
    for (const app of assistant.connected_apps) if (!/calendar/i.test(app.app)) list.push(`Use ${app.app}`);
    if (assistant.owner_alerts?.emails.length) list.push("Tell you when someone needs you");
    return list;
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
    return (
        <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-[15px] font-semibold">{title}</h2>
                {action && <button type="button" onClick={onAction} className="text-[13px] font-medium text-muted-foreground">{action}</button>}
            </div>
            <div className="divide-y divide-border/40 overflow-hidden rounded-2xl bg-muted/60">{children}</div>
        </section>
    );
}

function Line({ label, detail, right, onClick }: { label: string; detail?: string | null; right?: ReactNode; onClick?: () => void }) {
    const inner = (
        <>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{label}</span>
                {detail && <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>}
            </span>
            {right ?? (onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />)}
        </>
    );
    return onClick
        ? <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">{inner}</button>
        : <div className="flex items-center gap-3 px-4 py-3.5">{inner}</div>;
}

/** One assistant: try it, switch it on or off, where it answers, what it knows and can do. */
export default function StudioAssistantDetailPage({ id }: { id: string }) {
    const { project } = useStudio();
    const { ask } = useStudioCopilot();
    const tasks = useStudioTasks();
    const queryClient = useQueryClient();
    const overview = useStudioOverview(id);
    const row = useAssistants().data?.assistants.find((item) => item.id === id) ?? null;
    const setActive = useSetAssistantActive();
    const [qrOpen, setQrOpen] = useState(false);
    const [tryOpen, setTryOpen] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const assistant = overview.data?.assistant ?? null;
    const origin = new URL(getMainSiteUrl("/")).origin;
    const linkUrl = overview.data?.share_token ? `${origin}/talk/${overview.data.share_token}` : null;
    const status = row ? assistantStatus(row) : null;

    const removeKnowledge = async (sourceId: string) => {
        setRemoving(sourceId);
        try {
            await studioFetch(`/api/projects/${project.id}/embedded-agents/${id}/knowledge?source_id=${encodeURIComponent(sourceId)}`, { method: "DELETE" });
            await queryClient.invalidateQueries({ queryKey: ["studio-overview", project.id] });
        } finally {
            setRemoving(null);
        }
    };

    return (
        <div className="min-h-svh px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <div className="flex h-10 items-center">
                <StudioLink href="/assistant" aria-label="Back to Assistants" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full"><ChevronLeft className="h-5 w-5" /></StudioLink>
            </div>
            {overview.isLoading ? (
                <div className="mt-3 space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full rounded-full" />{[0, 1, 2].map((index) => <Skeleton key={index} className="h-28 w-full rounded-2xl" />)}</div>
            ) : !assistant ? (
                <StudioLoadError error={overview.error} fallback="Couldn't load this assistant." onRetry={() => void overview.refetch()} />
            ) : (
                <>
                    <div className="mt-2 flex items-center gap-2">
                        <h1 className="min-w-0 truncate text-[26px] font-semibold leading-tight tracking-tight">{assistant.name}</h1>
                        {status && <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", status.tone)}>{status.label}</span>}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                        <button type="button" onClick={() => setTryOpen(true)} className="h-12 flex-1 rounded-full bg-foreground text-[15px] font-semibold text-background">Try it</button>
                        {row?.published ? (
                            <button
                                type="button"
                                role="switch"
                                aria-checked={row.active}
                                disabled={setActive.isPending}
                                onClick={() => setActive.mutate({ agentId: id, active: !row.active })}
                                className="flex h-12 items-center gap-2.5 rounded-full border border-border/60 pl-4 pr-1.5 text-[15px] font-medium disabled:opacity-60"
                            >
                                {row.active ? "Live" : "Paused"}
                                <span className={cn("flex h-7 w-12 items-center rounded-full p-0.5 transition-colors", row.active ? "bg-emerald-600" : "bg-muted-foreground/30")}>
                                    <span className={cn("h-6 w-6 rounded-full bg-white shadow transition-transform", row.active && "translate-x-5")} />
                                </span>
                            </button>
                        ) : (
                            <button type="button" onClick={() => tasks.open("golive", { agentId: id })} className="h-12 rounded-full border border-border/60 px-5 text-[15px] font-medium">Go live</button>
                        )}
                    </div>
                    {setActive.error && <p role="alert" className="mt-2 text-[13px] text-destructive">{setActive.error.message}</p>}

                    <Section title="Where it answers">
                        <Line
                            label="WhatsApp"
                            detail={assistant.whatsapp ? assistant.whatsapp.number ?? "Connected" : null}
                            onClick={assistant.whatsapp ? undefined : () => tasks.open("whatsapp", { agentId: id })}
                            right={assistant.whatsapp ? <Check className="h-4 w-4 text-emerald-600" /> : <span className="text-[13px] font-medium">Connect</span>}
                        />
                        <Line
                            label="Your link"
                            detail={linkUrl ? linkUrl.replace(/^https?:\/\//, "") : "Ready once it's live"}
                            onClick={linkUrl ? () => setQrOpen(true) : undefined}
                            right={linkUrl ? <QrCode className="h-4 w-4 text-muted-foreground" /> : <span />}
                        />
                        <Line
                            label="Your website"
                            detail={assistant.website_chat?.on ? assistant.website_chat.sites.map((site) => site.replace(/^https?:\/\//, "")).join(", ") || "On" : "Off"}
                            onClick={() => ask(`Help me put ${assistant.name} on my website`)}
                        />
                    </Section>

                    <Section title="What it knows" action="Add" onAction={() => tasks.open("knowledge", { agentId: id })}>
                        {assistant.knowledge.length === 0 && !assistant.products?.count ? (
                            <Line label="Nothing yet" detail="Add your menu, prices or hours." />
                        ) : (
                            <>
                                {assistant.knowledge.map((doc) => (
                                    <Line
                                        key={doc.id ?? doc.name}
                                        label={doc.name}
                                        detail={doc.status === "ready" ? null : "Reading…"}
                                        right={doc.id ? (
                                            <button type="button" onClick={() => void removeKnowledge(doc.id!)} disabled={removing !== null} aria-label={`Remove ${doc.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground disabled:opacity-50">
                                                {removing === doc.id ? <Spinner className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                            </button>
                                        ) : <span />}
                                    />
                                ))}
                                {!!assistant.products?.count && <Line label={`${assistant.products.count} products`} detail={assistant.products.orders_to_fulfil ? `${assistant.products.orders_to_fulfil} orders to send` : null} />}
                            </>
                        )}
                    </Section>

                    <Section title="What it can do" action="Change" onAction={() => ask(`I want to change what ${assistant.name} can do`)}>
                        {abilities(assistant).map((ability) => (
                            <Line key={ability} label={ability} right={<Check className="h-4 w-4 shrink-0 text-emerald-600" />} />
                        ))}
                    </Section>

                    <Section title="This week">
                        <Line label="Chats" right={<span className="text-[15px] font-semibold">{row?.chats_this_week ?? 0}</span>} />
                    </Section>

                    <button type="button" onClick={() => ask(`For ${assistant.name}: `)} className="mt-6 h-12 w-full rounded-full border border-border/60 text-[15px] font-medium">Change something with Copilot</button>

                    {linkUrl && <StudioLinkQr url={linkUrl} name={assistant.name} open={qrOpen} onOpenChange={setQrOpen} />}
                    <TrySheet projectId={project.id} agentId={id} name={assistant.name} origin={origin} open={tryOpen} onOpenChange={setTryOpen} />
                </>
            )}
        </div>
    );
}

/** A preview chat with the assistant: nothing said here counts as a real chat. */
function TrySheet({ projectId, agentId, name, origin, open, onOpenChange }: { projectId: string; agentId: string; name: string; origin: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [frame, setFrame] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Opened by the Try it button (vaul only reports drags and taps on the sheet itself).
    useEffect(() => {
        if (open && !frame) void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    const load = async () => {
        setError(null);
        try {
            const base = `/api/projects/${projectId}/embedded-agents/${agentId}/widget`;
            let body = await (await studioFetch(base, { cache: "no-store" })).json() as { widget: { public_key: string } | null; preview_token: string | null; error?: string };
            // No chat widget yet: make one (it starts switched off for websites).
            if (!body.widget) body = await (await studioFetch(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" })).json() as typeof body;
            if (!body.widget || !body.preview_token) throw new Error(body.error ?? "Couldn't open a preview.");
            setFrame(`${origin}/api/widget/frame/${body.widget.public_key}?mode=bare&preview=${encodeURIComponent(body.preview_token)}`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't open a preview.");
        }
    };
    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-black/30" />
                <Drawer.Content className="dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[88svh] max-w-md flex-col rounded-t-3xl border-t border-border/60 bg-background font-sans text-foreground outline-none">
                    <div className="flex items-center justify-between px-5 pt-3">
                        <Drawer.Title className="min-w-0 truncate text-[17px] font-semibold">Try it</Drawer.Title>
                        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button>
                    </div>
                    <Drawer.Description className="px-5 text-[13px] text-muted-foreground">A preview. It doesn&apos;t count as a chat.</Drawer.Description>
                    <div className="min-h-0 flex-1 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
                        {frame ? (
                            <iframe title={`Try ${name}`} src={frame} className="h-full w-full bg-transparent" />
                        ) : error ? (
                            <p className="px-2 text-[13px] text-destructive">{error}</p>
                        ) : (
                            <div className="flex h-full items-center justify-center"><HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        )}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
