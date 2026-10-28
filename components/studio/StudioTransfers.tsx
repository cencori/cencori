"use client";

import { useEffect, useState } from "react";
import { studioFetch } from "@/components/studio/studio-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "vaul";
import { SHEET_AS_PAGE, SHEET_OVERLAY_PHONE_ONLY, SheetPageBack } from "@/components/studio/studio-sheet";
import { ChevronRight, CreditCard, Landmark, Plus, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { BankLogo } from "@/components/studio/BankLogo";
import { VerifiedCheckIcon } from "@solar-icons/react/bold-duotone/verified-check";
import { useStudio } from "@/components/studio/StudioShell";
import { formatMoney } from "@/components/studio/useStudioOverview";
import { shortTime } from "@/components/studio/useInbox";
import { cn } from "@/lib/utils";

export interface BankAccount { bank: string; account_number: string; account_name: string; /** Its bank's logo, when Money sends it. */ logo?: string | null; /** Set on saved accounts. */ id?: string }

/** "OPay Digital Services Limited (OPay)" → "OPay", "Guaranty Trust Bank" → "GTBank": the names people use. */
const SHORT_BANK: Record<string, string> = { "guaranty trust bank": "GTBank", "united bank for africa": "UBA", "first bank of nigeria": "First Bank", "first city monument bank": "FCMB", "moniepoint mfb": "Moniepoint", "stanbic ibtc bank": "Stanbic IBTC" };
export function shortBankName(name: string): string {
    const bracket = /\(([^)]+)\)\s*$/.exec(name)?.[1];
    if (bracket) return bracket;
    return SHORT_BANK[name.trim().toLowerCase()] ?? name.replace(/\s+(limited|ltd|plc)\.?$/i, "");
}
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

const PROVIDERS: Record<string, string> = { paystack: "Paystack", flutterwave: "Flutterwave", stripe: "Stripe" };
const PROVIDER_LOGOS: Record<string, string> = { paystack: "/payments/paystack.svg", flutterwave: "/payments/flutterwave.png", stripe: "/payments/stripe.png" };
/** Paystack's and Flutterwave's marks fill their icons edge to edge: a little room so they sit like the others. */
const PROVIDER_LOGO_INSET: Record<string, string> = { paystack: "p-1.5", flutterwave: "p-1.5" };

/**
 * Money → Get paid: how customers pay, one row each. With a payment provider
 * connected, that's the way (payment links), so it's the only row; without
 * one, the business's own account for transfers, and the provider to connect.
 */
export function GetPaidCard({ accounts, payments, onConnectProvider }: { accounts: BankAccount[]; payments: { provider: string; mode: string } | null; onConnectProvider: () => void }) {
    // Which account the sheet is for: an existing one, "new", or none (closed).
    const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
    const row = "flex w-full items-center gap-3 px-4 py-3.5 text-left";
    const circle = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full";
    return (
        <section className="mt-9">
            <h2 className="mb-3 px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Get paid</h2>
            <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted/60">
                {payments ? (
                    <div className={row}>
                        {PROVIDER_LOGOS[payments.provider]
                            // eslint-disable-next-line @next/next/no-img-element -- our own small static file
                            ? <img src={PROVIDER_LOGOS[payments.provider]} alt="" className={cn("h-10 w-10 shrink-0 rounded-full bg-white object-contain", PROVIDER_LOGO_INSET[payments.provider])} />
                            : <span className={cn(circle, "bg-sky-400/15 text-sky-400")}><CreditCard className="h-5 w-5" /></span>}
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-[15px] font-semibold">
                                {PROVIDERS[payments.provider] ?? "Payment link"}
                                {payments.mode === "test" && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">Test</span>}
                            </span>
                            <span className="block text-[13px] text-muted-foreground">Payments go straight to your account</span>
                        </span>
                    </div>
                ) : (
                    <>
                        {accounts.map((account, index) => (
                            <button key={account.id ?? account.account_number} type="button" onClick={() => setEditing(account)} className={row}>
                                <BankLogo name={account.bank} logo={account.logo} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-semibold">{account.account_name}</span>
                                    <span className="block truncate text-[13px] text-muted-foreground">{shortBankName(account.bank)} · {account.account_number}</span>
                                </span>
                                {index === 0 && accounts.length > 1 && <span className="shrink-0 rounded-md bg-foreground/10 px-1.5 py-0.5 text-[11px] font-semibold">Main</span>}
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </button>
                        ))}
                        <button type="button" onClick={() => setEditing("new")} className={row}>
                            <span className={cn(circle, "bg-emerald-400/15 text-emerald-500 dark:text-emerald-400")}>{accounts.length ? <Plus className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-semibold">{accounts.length ? "Add another account" : "Bank transfer"}</span>
                                {!accounts.length && <span className="block truncate text-[13px] text-muted-foreground">Bank, OPay, PalmPay, Moniepoint</span>}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                        <button type="button" onClick={onConnectProvider} className={row}>
                            <span className={cn(circle, "bg-sky-400/15 text-sky-400")}><CreditCard className="h-5 w-5" /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-semibold">Payment link</span>
                                <span className="block truncate text-[13px] text-muted-foreground">Paystack, Flutterwave, Stripe</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                    </>
                )}
            </div>
            {accounts.length > 1 && !payments && <p className="mt-2 px-1 text-[12px] leading-5 text-muted-foreground">Customers are given your main account.</p>}
            <BankAccountSheet
                account={editing === "new" ? null : editing}
                isMain={editing !== "new" && !!editing && accounts[0]?.id === editing.id}
                count={accounts.length}
                open={editing !== null}
                onOpenChange={(next) => { if (!next) setEditing(null); }}
            />
        </section>
    );
}

function BankAccountSheet({ account, isMain, count, open, onOpenChange }: { account: BankAccount | null; isMain: boolean; count: number; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { project } = useStudio();
    const refresh = useRefresh();
    const [form, setForm] = useState<BankAccount>(account ?? { bank: "", account_number: "", account_name: "" });
    // Opened from the card (vaul doesn't report opens it didn't start): load that account, or start empty.
    useEffect(() => {
        if (open) setForm(account ? { bank: account.bank, account_number: account.account_number, account_name: account.account_name } : { bank: "", account_number: "", account_name: "" });
    }, [open, account?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const save = useMutation({
        mutationFn: () => send("/api/studio/transfers", "PUT", { project_id: project.id, bank: form.bank, account_number: form.account_number, account_name: form.account_name, ...(account?.id ? { id: account.id } : {}) }),
        onSuccess: () => { refresh(); onOpenChange(false); },
    });
    const remove = useMutation({
        mutationFn: () => send(`/api/studio/transfers?project_id=${project.id}${account?.id ? `&id=${account.id}` : ""}`, "DELETE"),
        onSuccess: () => { refresh(); onOpenChange(false); },
    });
    const makeMain = useMutation({
        mutationFn: () => send("/api/studio/transfers", "POST", { project_id: project.id, action: "main", id: account?.id }),
        onSuccess: () => { refresh(); onOpenChange(false); },
    });
    const error = save.error ?? remove.error ?? makeMain.error;
    // Rows of one joined card (same height the separate pills had).
    const row = "block h-12 w-full bg-transparent px-5 text-[15px] outline-none placeholder:text-muted-foreground";

    // The bank field suggests banks as the owner types: names and nicknames (GTB, UBA), best match first.
    const [banks, setBanks] = useState<Array<{ name: string; also: string[]; popular: boolean; logo: string | null }>>([]);
    const [picking, setPicking] = useState(false);
    const [loadingBanks, setLoadingBanks] = useState(false);
    // Loaded when the sheet opens, and again on typing if that didn't work (never left empty).
    const wantsBanks = open && (form.bank.trim().length >= 2 || !banks.length);
    useEffect(() => {
        if (!wantsBanks || banks.length || loadingBanks) return;
        setLoadingBanks(true);
        studioFetch(`/api/studio/transfers/banks?project_id=${project.id}`, { cache: "no-store" })
            .then((response) => response.json())
            .then((body: { banks?: Array<{ name: string; also: string[]; popular: boolean; logo: string | null }> }) => setBanks(body.banks ?? []))
            .catch(() => undefined)
            .finally(() => setLoadingBanks(false));
    }, [wantsBanks, banks.length, loadingBanks, project.id, form.bank]);
    // The bank as chosen (or typed exactly), for its logo in the field.
    const chosenBank = banks.find((bank) => bank.name.toLowerCase() === form.bank.trim().toLowerCase()) ?? null;
    const query = form.bank.trim().toLowerCase();
    const suggestions = query.length < 2 || banks.some((bank) => bank.name === form.bank) ? [] : banks
        .map((bank) => {
            const name = bank.name.toLowerCase();
            const words = name.split(/[^a-z0-9]+/);
            const match = bank.also.some((nick) => nick === query) ? 0 : name.startsWith(query) || bank.also.some((nick) => nick.startsWith(query)) ? 1 : words.some((word) => word.startsWith(query)) ? 2 : name.includes(query) ? 3 : 9;
            // The banks and apps most people use go first among equal matches ("op": OPay before Optimus).
            return { ...bank, score: match === 9 ? 9 : match - (bank.popular ? 0.5 : 0) };
        })
        .filter((bank) => bank.score < 9)
        .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
        .slice(0, 6);

    // Name enquiry: with a bank and all 10 digits, ask the bank whose account it is and fill the name in.
    const [lookup, setLookup] = useState<"idle" | "checking" | "found" | "not_found" | "unknown_bank" | "unavailable">("idle");
    useEffect(() => {
        if (!open || !form.bank.trim() || form.account_number.length !== 10) {
            setLookup("idle");
            return;
        }
        // An account already saved and unchanged doesn't need checking again.
        if (account && account.bank === form.bank && account.account_number === form.account_number) return;
        let stale = false;
        setLookup("checking");
        const timer = window.setTimeout(async () => {
            try {
                const response = await studioFetch(`/api/studio/transfers/resolve?project_id=${project.id}&bank=${encodeURIComponent(form.bank)}&account_number=${form.account_number}`, { cache: "no-store" });
                const result = await response.json() as { ok: true; name: string } | { ok: false; reason: "not_found" | "unknown_bank" | "unavailable" };
                if (stale) return;
                if (result.ok) {
                    setForm((current) => ({ ...current, account_name: result.name }));
                    setLookup("found");
                } else setLookup(result.reason);
            } catch {
                if (!stale) setLookup("unavailable");
            }
        }, 350);
        return () => {
            stale = true;
            window.clearTimeout(timer);
        };
    }, [open, form.bank, form.account_number, project.id, account]);

    return (
        <Drawer.Root repositionInputs={false} open={open} onOpenChange={(next) => { if (next) setForm(account ?? { bank: "", account_number: "", account_name: "" }); onOpenChange(next); }}>
            <Drawer.Portal>
                <Drawer.Overlay className={`fixed inset-0 z-50 bg-black/30 ${SHEET_OVERLAY_PHONE_ONLY}`} />
                <Drawer.Content className={`dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto flex min-h-[55svh] max-h-[92svh] max-w-md flex-col lg:left-[var(--studio-sidebar,0px)] overflow-y-auto rounded-t-3xl border-t border-border/60 bg-background px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 font-sans text-foreground outline-none ${SHEET_AS_PAGE}`}>
                    <SheetPageBack />
                    <div className="flex h-10 items-center justify-between">
                        <Drawer.Title className="text-[17px] font-semibold">{account ? (isMain && count > 1 ? "Main account" : "Your account") : count ? "Add another account" : "Add your account"}</Drawer.Title>
                        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button>
                    </div>
                    <Drawer.Description className="text-[13px] leading-5 text-muted-foreground">Customers send money straight to this account. You confirm it in Money once you see it.</Drawer.Description>
                    <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="mt-4 flex flex-1 flex-col gap-3">
                        {/* One card: the bank (with its suggestions under it), the number, the name. */}
                        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted">
                            <span className="relative block">
                                {chosenBank && <BankLogo name={chosenBank.name} logo={chosenBank.logo} className="absolute left-3 top-1/2 h-8 w-8 -translate-y-1/2 text-[11px]" />}
                                <input value={form.bank} onChange={(event) => { setForm({ ...form, bank: event.target.value }); setPicking(true); }} onFocus={() => setPicking(true)} placeholder="Bank Name" aria-label="Bank name" autoComplete="off" className={cn(row, chosenBank && "pl-14")} />
                            </span>
                            {picking && form.bank.trim().length >= 2 && !banks.length && (
                                <p className="flex items-center gap-2 px-5 py-3 text-[13px] text-muted-foreground">{loadingBanks ? <><Spinner className="h-3.5 w-3.5" />Loading banks…</> : "Couldn't load the list. Type your bank's full name."}</p>
                            )}
                            {picking && suggestions.map((bank) => (
                                <button key={bank.name} type="button" onClick={() => { setForm({ ...form, bank: bank.name }); setPicking(false); }} className="flex w-full items-center gap-3 bg-background/40 px-4 py-2.5 text-left text-[15px]"><BankLogo name={bank.name} logo={bank.logo} className="h-8 w-8 text-[11px]" />{bank.name}</button>
                            ))}
                            <input value={form.account_number} onChange={(event) => setForm({ ...form, account_number: event.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" autoComplete="off" placeholder="Account Number" aria-label="Account number" className={row} />
                            <span className="relative block">
                                <input value={form.account_name} onChange={(event) => { setForm({ ...form, account_name: event.target.value }); if (lookup === "found") setLookup("idle"); }} placeholder={lookup === "checking" ? "Checking…" : "Name on Account"} aria-label="Name on account" className={cn(row, "pr-12")} />
                                {lookup === "checking" && <Spinner className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
                                {/* The bank confirmed this name. */}
                                {lookup === "found" && <VerifiedCheckIcon size={22} aria-label="Confirmed by your bank" className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />}
                            </span>
                        </div>
                        {lookup === "not_found" && <span className="-mt-1 block pl-5 text-[12px] text-destructive">We couldn&apos;t find that account. Check the number and the bank.</span>}
                        {lookup === "unknown_bank" && <span className="-mt-1 block pl-5 text-[12px] text-muted-foreground">We don&apos;t know that bank. Pick one from the list, or type the name yourself.</span>}
                        {lookup === "unavailable" && <span className="-mt-1 block pl-5 text-[12px] text-muted-foreground">Couldn&apos;t check with the bank right now. Type the name as it is on the account.</span>}
                        {error && <p role="alert" className="text-[13px] text-destructive">{error.message}</p>}
                        <button type="submit" disabled={save.isPending} className="mt-auto h-12 shrink-0 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-60">{save.isPending ? "Saving…" : "Save"}</button>
                        {account && (
                            <div className="flex items-center justify-center gap-6">
                                {count > 1 && !isMain && <button type="button" disabled={makeMain.isPending} onClick={() => makeMain.mutate()} className="h-10 text-sm font-semibold">Make main</button>}
                                <button type="button" disabled={remove.isPending} onClick={() => remove.mutate()} className="h-10 text-sm text-muted-foreground">{count > 1 ? "Remove account" : "Stop taking transfers"}</button>
                            </div>
                        )}
                    </form>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
