"use client";

import { useState } from "react";
import { studioFetch } from "@/components/studio/studio-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "vaul";
import { SHEET_AS_PAGE, SHEET_OVERLAY_PHONE_ONLY, SheetPageBack } from "@/components/studio/studio-sheet";
import { Landmark, X } from "lucide-react";
import { useStudio } from "@/components/studio/StudioShell";
import { formatMoney } from "@/components/studio/useStudioOverview";
import { shortTime } from "@/components/studio/useInbox";
import { cn } from "@/lib/utils";

export interface BankAccount { bank: string; account_number: string; account_name: string }
export interface TransferToConfirm {
    reference: string;
    amount: number;
    currency: string;
    description: string;
    customer: string | null;
    status: "awaiting" | "claimed";
    created_at: string;
    claimed_at: string | null;
    conversation_id: string | null;
}

const BANKS = ["OPay", "PalmPay", "Moniepoint", "Kuda", "GTBank", "Access", "Zenith", "First Bank", "UBA"];

async function send(url: string, method: string, body?: unknown) {
    const response = await studioFetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "That didn't work. Try again.");
    return json;
}

/** Refresh everything a transfer changes: Money, Sales, Home. */
function useRefresh() {
    const { project } = useStudio();
    const queryClient = useQueryClient();
    return () => {
        for (const key of ["studio-money", "studio-sales", "studio-overview", "studio-inbox"]) void queryClient.invalidateQueries({ queryKey: [key, project.id] });
    };
}

/**
 * Customers who said they've sent money (first), and ones asked to pay
 * recently. The owner checks their own account, then taps Received.
 */
export function TransfersToConfirm({ transfers }: { transfers: TransferToConfirm[] }) {
    const { project } = useStudio();
    const refresh = useRefresh();
    const act = useMutation({
        mutationFn: (input: { reference: string; action: "confirm" | "not_received" }) => send("/api/studio/transfers", "POST", { project_id: project.id, ...input }),
        onSettled: refresh,
    });
    const claimed = transfers.filter((t) => t.status === "claimed");
    const waiting = transfers.filter((t) => t.status === "awaiting");
    if (transfers.length === 0) return null;

    return (
        <section className="mt-6">
            <h2 className="mb-1 text-[15px] font-semibold">Transfers to confirm{claimed.length > 0 ? ` · ${claimed.length}` : ""}</h2>
            <p className="mb-2 text-[13px] leading-5 text-muted-foreground">Check your bank app. Tap Received only once you see the money.</p>
            {act.error && <p role="alert" className="mb-2 text-[13px] text-destructive">{act.error.message}</p>}
            <ul className="overflow-hidden rounded-2xl border border-border/60">
                {[...claimed, ...waiting].map((transfer) => {
                    const busy = act.isPending && act.variables?.reference === transfer.reference;
                    return (
                        <li key={transfer.reference} className="border-b border-border/60 px-4 py-3 last:border-0">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="min-w-0 truncate text-[15px] font-medium">{transfer.customer?.split(/[·,]/)[0]?.trim() || "A customer"}</span>
                                <span className="shrink-0 text-[15px] font-semibold">{formatMoney(transfer.amount, transfer.currency)}</span>
                            </div>
                            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{transfer.description}</p>
                            <p className={cn("mt-1 text-xs", transfer.status === "claimed" ? "font-medium text-amber-800 dark:text-amber-400" : "text-muted-foreground")}>
                                {transfer.status === "claimed" ? `Says they've paid · ${shortTime(transfer.claimed_at ?? transfer.created_at)}` : `Asked to pay · ${shortTime(transfer.created_at)}`} · {transfer.reference}
                            </p>
                            <div className="mt-2.5 flex gap-2">
                                <button type="button" disabled={busy} onClick={() => act.mutate({ reference: transfer.reference, action: "confirm" })} className="h-9 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">Received</button>
                                {transfer.status === "claimed" && (
                                    <button type="button" disabled={busy} onClick={() => act.mutate({ reference: transfer.reference, action: "not_received" })} className="h-9 rounded-full border border-border/60 px-4 text-sm font-medium disabled:opacity-60">Not yet</button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/**
 * The account customers transfer to: shown with Edit, or a prompt to add it
 * (with the other way to get paid, a payment provider, beside it).
 */
export function BankAccountCard({ account, onUseProvider }: { account: BankAccount | null; onUseProvider?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            {account ? (
                <section className="mt-6 flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Landmark className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-muted-foreground">Customers pay by transfer to</span>
                        <span className="block truncate text-[15px] font-semibold">{account.account_name}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">{account.bank} · {account.account_number}</span>
                    </span>
                    <button type="button" onClick={() => setOpen(true)} className="h-9 shrink-0 rounded-full border border-border/60 px-4 text-sm font-medium">Edit</button>
                </section>
            ) : (
                <section className="mt-6 rounded-2xl border border-border/60 px-4 py-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Landmark className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold">Get paid by transfer</span>
                            <span className="block text-[13px] leading-5 text-muted-foreground">Your bank, OPay, PalmPay or Moniepoint account. Your assistant gives it to customers when they&apos;re ready to pay.</span>
                        </span>
                    </div>
                    <button type="button" onClick={() => setOpen(true)} className="mt-3 h-11 w-full rounded-full bg-foreground text-sm font-semibold text-background">Add your account</button>
                    {onUseProvider && (
                        <button type="button" onClick={onUseProvider} className="mt-2 h-11 w-full rounded-full border border-border/60 text-sm font-semibold">Use a payment provider</button>
                    )}
                </section>
            )}
            <BankAccountSheet account={account} open={open} onOpenChange={setOpen} />
        </>
    );
}

function BankAccountSheet({ account, open, onOpenChange }: { account: BankAccount | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { project } = useStudio();
    const refresh = useRefresh();
    const [form, setForm] = useState<BankAccount>(account ?? { bank: "", account_number: "", account_name: "" });
    const save = useMutation({
        mutationFn: () => send("/api/studio/transfers", "PUT", { project_id: project.id, ...form }),
        onSuccess: () => { refresh(); onOpenChange(false); },
    });
    const remove = useMutation({
        mutationFn: () => send(`/api/studio/transfers?project_id=${project.id}`, "DELETE"),
        onSuccess: () => { refresh(); onOpenChange(false); },
    });
    const error = save.error ?? remove.error;
    const field = "h-12 w-full rounded-2xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground";

    return (
        <Drawer.Root repositionInputs={false} open={open} onOpenChange={(next) => { if (next) setForm(account ?? { bank: "", account_number: "", account_name: "" }); onOpenChange(next); }}>
            <Drawer.Portal>
                <Drawer.Overlay className={`fixed inset-0 z-50 bg-black/30 ${SHEET_OVERLAY_PHONE_ONLY}`} />
                <Drawer.Content className={`dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92svh] max-w-md lg:left-[var(--studio-sidebar,0px)] overflow-y-auto rounded-t-3xl border-t border-border/60 bg-background px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 font-sans text-foreground outline-none ${SHEET_AS_PAGE}`}>
                    <SheetPageBack />
                    <div className="flex h-10 items-center justify-between">
                        <Drawer.Title className="text-[17px] font-semibold">{account ? "Your account" : "Add your account"}</Drawer.Title>
                        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button>
                    </div>
                    <Drawer.Description className="text-[13px] leading-5 text-muted-foreground">Customers send money straight to this account. You confirm it in Money once you see it.</Drawer.Description>
                    <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="mt-4 flex flex-col gap-3">
                        <label className="block">
                            <span className="mb-1.5 block text-[13px] font-medium">Bank or app</span>
                            <input value={form.bank} onChange={(event) => setForm({ ...form, bank: event.target.value })} placeholder="OPay" className={field} />
                        </label>
                        <div className="-mt-1 flex flex-wrap gap-1.5">
                            {BANKS.map((bank) => (
                                <button key={bank} type="button" onClick={() => setForm({ ...form, bank })} className={cn("h-8 rounded-full border px-3 text-[13px]", form.bank === bank ? "border-foreground bg-foreground text-background" : "border-border/60")}>{bank}</button>
                            ))}
                        </div>
                        <label className="block">
                            <span className="mb-1.5 block text-[13px] font-medium">Account number</span>
                            <input value={form.account_number} onChange={(event) => setForm({ ...form, account_number: event.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="off" placeholder="0123456789" className={field} />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-[13px] font-medium">Name on the account</span>
                            <input value={form.account_name} onChange={(event) => setForm({ ...form, account_name: event.target.value })} placeholder="Arcie Lounge Ltd" className={field} />
                        </label>
                        {error && <p role="alert" className="text-[13px] text-destructive">{error.message}</p>}
                        <button type="submit" disabled={save.isPending} className="mt-1 h-12 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-60">{save.isPending ? "Saving…" : "Save"}</button>
                        {account && (
                            <button type="button" disabled={remove.isPending} onClick={() => remove.mutate()} className="h-10 text-sm text-muted-foreground">Stop taking transfers</button>
                        )}
                    </form>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
