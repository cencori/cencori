"use client";

import { useState, type ReactNode } from "react";
import { Check, QrCode } from "lucide-react";
import { StudioLinkQr } from "@/components/studio/StudioLinkQr";
import { useStudioCopilot } from "@/components/studio/StudioCopilot";
import { joinWords, liveChannels, useStudioOverview, type StudioAssistantSummary } from "@/components/studio/useStudioOverview";
import { UserRoundedIcon } from "@solar-icons/react/bold-duotone/user-rounded";
import { STUDIO_FILL_PAGE, StudioEmptyCard } from "@/components/studio/StudioEmptyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getMainSiteUrl } from "@/lib/main-site-url";

/** What each ability is called for an owner. */
const ABILITIES: Record<string, string> = {
    take_payments: "Send payment links",
    sell_products: "Take orders from your product list",
    request_callback: "Ask you to call customers back",
    transfer_to_human: "Hand customers over to you",
};

function abilities(assistant: StudioAssistantSummary): string[] {
    const list: string[] = ["Answer customers' questions"];
    if (assistant.template === "restaurant") list.push(assistant.connected_apps.some((app) => /calendar/i.test(app.app)) ? "Take table bookings" : "Take table bookings once Google Calendar is connected");
    for (const tool of assistant.system_tools) if (ABILITIES[tool]) list.push(ABILITIES[tool]);
    for (const app of assistant.connected_apps) if (!/calendar/i.test(app.app)) list.push(`Use ${app.app}`);
    if (assistant.owner_alerts?.emails.length) list.push("Tell you when someone needs you");
    return list;
}

function Card({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: ReactNode }) {
    return (
        <section className="rounded-2xl border border-border/60 px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
                <button type="button" onClick={onAction} className="text-[13px] font-medium">{action}</button>
            </div>
            {children}
        </section>
    );
}

/** The assistant in four cards: what it knows, can do, where it works, how it's doing. Changes go through Copilot. */
export default function StudioAssistantPage() {
    const { ask } = useStudioCopilot();
    const overview = useStudioOverview();
    const data = overview.data;
    const assistant = data?.assistant ?? null;
    const live = liveChannels(assistant);
    const [qrOpen, setQrOpen] = useState(false);
    const linkUrl = data?.share_token ? `${new URL(getMainSiteUrl("/")).origin}/talk/${data.share_token}` : null;

    return (
        <div className={!overview.isLoading && !assistant ? STUDIO_FILL_PAGE : undefined}>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{assistant?.name ?? "Your assistant"}</h1>
            {overview.isLoading ? (
                <div className="mt-5 space-y-3">
                    <Skeleton className="h-4 w-48" />
                    {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-24 w-full rounded-2xl" />)}
                </div>
            ) : !assistant ? (
                <StudioEmptyCard icon={UserRoundedIcon} title="No assistant yet" description="Set one up and it starts answering customers on your link and WhatsApp.">
                    <button type="button" onClick={() => ask("Help me set up an assistant for my business")} className="mt-4 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background">Set one up</button>
                </StudioEmptyCard>
            ) : (
                <>
                    <div className="mt-5 flex flex-col gap-3">
                        <Card title="What it knows" action="Add" onAction={() => ask("I want to add something my assistant should know")}>
                            {assistant.knowledge.length || assistant.products?.count ? (
                                <p className="text-[15px] leading-6">
                                    {joinWords([
                                        ...assistant.knowledge.filter((doc) => doc.status === "ready").slice(0, 3).map((doc) => doc.name),
                                        ...(assistant.knowledge.filter((doc) => doc.status === "ready").length > 3 ? [`${assistant.knowledge.filter((doc) => doc.status === "ready").length - 3} more`] : []),
                                        ...(assistant.products?.count ? [`${assistant.products.count} products`] : []),
                                    ])}
                                    {assistant.knowledge.some((doc) => doc.status !== "ready") && <span className="text-muted-foreground"> (still reading some)</span>}
                                </p>
                            ) : (
                                <p className="text-[15px] leading-6 text-muted-foreground">Nothing yet. Add your menu, prices or opening hours.</p>
                            )}
                        </Card>

                        <Card title="What it can do" action="Change" onAction={() => ask("I want to change what my assistant can do")}>
                            <ul className="space-y-1">
                                {abilities(assistant).map((ability) => (
                                    <li key={ability} className="flex items-center gap-2 text-[15px] leading-6">
                                        <Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.4} />
                                        {ability}
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <Card title="Where it works" action="Add a place" onAction={() => ask("Help me put my assistant on another channel")}>
                            {live.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {assistant.whatsapp?.replies_on && <span className="rounded-full bg-muted px-3 py-1 text-[13px]">WhatsApp {assistant.whatsapp.number ?? ""}</span>}
                                    {assistant.website_chat?.on && <span className="rounded-full bg-muted px-3 py-1 text-[13px]">{assistant.website_chat.sites[0]?.replace(/^https?:\/\//, "") ?? "Your website"}</span>}
                                    {assistant.website_chat && (linkUrl ? (
                                        <button type="button" onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[13px]"><QrCode className="h-3.5 w-3.5" />Your link and QR code</button>
                                    ) : <span className="rounded-full bg-muted px-3 py-1 text-[13px]">Your link</span>)}
                                </div>
                            ) : (
                                <p className="text-[15px] leading-6 text-muted-foreground">Nowhere yet. Connect WhatsApp or add it to your website.</p>
                            )}
                        </Card>

                        <Card title="How it's doing · this month" action="Chats" onAction={() => window.location.assign("/inbox")}>
                            <div className="grid grid-cols-3 gap-2">
                                <span><span className="block text-xl font-semibold">{data?.month.chats ?? 0}</span><span className="text-xs text-muted-foreground">chats</span></span>
                                {data?.month.earned && <span><span className="block text-xl font-semibold">{data.month.earned.count}</span><span className="text-xs text-muted-foreground">paid</span></span>}
                                {assistant.products && <span><span className="block text-xl font-semibold">{assistant.products.orders_to_fulfil}</span><span className="text-xs text-muted-foreground">orders to send</span></span>}
                            </div>
                            {data?.plan && (
                                <>
                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                                        <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, Math.round((data.plan.used / Math.max(1, data.plan.conversations)) * 100))}%` }} />
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">{data.plan.used} of {data.plan.conversations} chats on {data.plan.name}</p>
                                </>
                            )}
                        </Card>
                    </div>
                </>
            )}
            {linkUrl && assistant && <StudioLinkQr url={linkUrl} name={assistant.name} open={qrOpen} onOpenChange={setQrOpen} />}
        </div>
    );
}
