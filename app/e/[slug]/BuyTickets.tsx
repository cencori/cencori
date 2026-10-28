"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Tier = { id: string; name: string; price: number; left: number | null };

const money = (amount: number, currency: string) => (currency === "NGN" ? `₦${amount.toLocaleString("en-NG")}` : `${currency} ${amount.toLocaleString("en-NG")}`);

/** Choose tickets, say who they're for, and pay. */
export function BuyTickets({ slug, currency, tiers }: { slug: string; currency: string; tiers: Tier[] }) {
    const firstOpen = tiers.find((tier) => tier.left === null || tier.left > 0);
    const [tierId, setTierId] = useState(firstOpen?.id ?? "");
    const [quantity, setQuantity] = useState(1);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const tier = tiers.find((item) => item.id === tierId);
    const max = Math.min(20, tier?.left ?? 20);
    const total = (tier?.price ?? 0) * quantity;

    const buy = async () => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/events/${slug}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier_id: tierId, quantity, name, phone, email }) });
            const body = await response.json().catch(() => null) as { order?: string; pay_url?: string; error?: string } | null;
            if (!response.ok || !body?.order) throw new Error(body?.error ?? "That didn't work. Try again.");
            window.location.assign(body.pay_url ?? body.order);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            setBusy(false);
        }
    };

    if (!firstOpen) return <p className="rounded-2xl bg-white/[0.06] px-4 py-4 text-[15px] font-medium">Sold out</p>;
    // Rows of one joined card: no box of their own.
    // Browsers paint autofilled fields (pale blue in Chrome); a solid inner shadow in the card's own
    // colour (white at 6% on black) covers it, and the text stays white.
    const field = "block h-14 w-full bg-transparent px-4 text-[15px] text-white outline-none placeholder:text-white/35 autofill:shadow-[inset_0_0_0_1000px_#0f0f0f] autofill:[-webkit-text-fill-color:#fff] autofill:[caret-color:#fff]";

    return (
        <div>
            <ul className="divide-y divide-[#262626] overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                {tiers.map((item) => {
                    const soldOut = item.left !== null && item.left <= 0;
                    const chosen = tierId === item.id;
                    return (
                        <li key={item.id}>
                            <button type="button" disabled={soldOut} aria-pressed={chosen} onClick={() => { setTierId(item.id); setQuantity(1); }} className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition", chosen && "bg-white/[0.06]", soldOut && "opacity-40")}>
                                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition", chosen ? "border-white" : "border-white/30")}>
                                    {chosen && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold">{item.name}</span>
                                    <span className="block text-[13px] text-white/50">{soldOut ? "Sold out" : item.left !== null && item.left <= 20 ? `${item.left} left` : "Available"}</span>
                                </span>
                                <span className="shrink-0 text-[15px] font-semibold">{item.price === 0 ? "Free" : money(item.price, currency)}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="mt-4 flex items-center justify-between rounded-full bg-white/[0.06] py-1.5 pl-5 pr-1.5 ring-1 ring-white/10">
                <span className="text-[15px]">Tickets</span>
                <span className="flex items-center gap-4">
                    <button type="button" aria-label="Fewer" disabled={quantity <= 1} onClick={() => setQuantity((n) => n - 1)} className="h-9 w-9 rounded-full bg-white/10 text-lg disabled:opacity-30">−</button>
                    <span className="w-5 text-center text-[15px] font-semibold">{quantity}</span>
                    <button type="button" aria-label="More" disabled={quantity >= max} onClick={() => setQuantity((n) => n + 1)} className="h-9 w-9 rounded-full bg-white/10 text-lg disabled:opacity-30">+</button>
                </span>
            </div>
            <div className="mt-4 divide-y divide-[#262626] overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" className={field} />
                <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="Phone (WhatsApp)" className={field} />
                <input value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="Email, for your tickets" className={field} />
            </div>
            {error && <p role="alert" className="mt-3 text-[13px] text-red-400">{error}</p>}
            <button type="button" disabled={busy || !tier || !name.trim()} onClick={() => void buy()} className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[15px] font-semibold text-black disabled:opacity-40">
                {busy && <Spinner className="h-4 w-4" />}{total === 0 ? "Get tickets" : `Pay ${money(total, currency)}`}
            </button>
        </div>
    );
}
