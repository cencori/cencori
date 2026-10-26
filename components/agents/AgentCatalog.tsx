"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import { ChevronDown, Plus, ShoppingBag, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { DockedPanel } from "@/components/agents/DockedPanel";
import { postStudioAction, studioQueryKey } from "@/components/agents/studio";
import { readJson } from "@/components/agents/widget-preview";
import { cn } from "@/lib/utils";
import { formatPrice, importCatalogCsv, newProductId, parsePrice, type CatalogProduct } from "@/lib/embedded/catalog-format";

type OrderStatus = "awaiting_payment" | "paid" | "new" | "done" | "cancelled";
type CatalogOrder = {
    id: string;
    items: Array<{ name: string; option: string | null; quantity: number }>;
    total: number;
    currency: string;
    customer: string | null;
    delivery: string | null;
    note: string | null;
    status: OrderStatus;
    created_at: string;
};
type CatalogPayload = {
    catalog: { currency: string; products: CatalogProduct[]; orders: CatalogOrder[]; updated_at: string } | null;
    can_manage: boolean;
};

export const catalogQueryKey = (projectId: string) => ["project-catalog", projectId];
const catalogEndpoint = (projectId: string) => `/api/projects/${projectId}/catalog`;

const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "USD", "GBP", "EUR"];
const ORDER_STATUS: Record<OrderStatus, string> = { awaiting_payment: "Waiting for payment", paid: "Paid, to fulfil", new: "New, not paid", done: "Done", cancelled: "Cancelled" };
const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring disabled:cursor-not-allowed disabled:opacity-60";

type Draft = { id: string; name: string; price: string; options: string; stock: string; description: string; available: boolean };
const toDraft = (p: CatalogProduct): Draft => ({ id: p.id, name: p.name, price: String(p.price), options: p.options, stock: p.stock === null ? "" : String(p.stock), description: p.description, available: p.available });
const emptyDraft = (): Draft => ({ id: newProductId(), name: "", price: "", options: "", stock: "", description: "", available: true });

export function useCatalog(projectId: string) {
    return useQuery({
        queryKey: catalogQueryKey(projectId),
        queryFn: async () => readJson<CatalogPayload>(await fetch(catalogEndpoint(projectId), { cache: "no-store" })),
        staleTime: 30_000,
    });
}

/** Start the project's catalog (empty) and switch Sell products on in this agent's draft. */
export async function startCatalog(projectId: string, agentId: string, version: { id: string; config_json: Record<string, unknown> } | null, editable: boolean): Promise<{ payload: CatalogPayload; note: string }> {
    const payload = await readJson<CatalogPayload>(await fetch(catalogEndpoint(projectId), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: [] }) }));
    const current = (version?.config_json.system_tools ?? {}) as Record<string, unknown>;
    if (current.sell_products) return { payload, note: "" };
    if (!version || !editable) return { payload, note: "Turn on Sell products under Tools in a new draft." };
    await postStudioAction(projectId, "save_tools", { agent_id: agentId, version_id: version.id, system_tools: { ...current, sell_products: {} } });
    return { payload, note: "Sell products is on in this draft. Publish to make it live." };
}

/**
 * The business's products, which its agents sell from, and the orders they
 * take: added by hand or imported from a spreadsheet (Bumpa, Selar, Shopify
 * exports or a sheet of its own). Project-level, so every agent shares it.
 */
export function AgentCatalog() {
    const { projectId, agent, version, editable, canManage, busy } = useAgentWorkspace();
    const queryClient = useQueryClient();
    const catalogQuery = useCatalog(projectId);
    const catalog = catalogQuery.data?.catalog ?? null;
    const manage = canManage && !!catalogQuery.data?.can_manage;
    const sellOn = !!(version?.config_json.system_tools as { sell_products?: unknown } | undefined)?.sell_products;
    const [open, setOpen] = useState(true);
    const [tab, setTab] = useState<"products" | "orders">("products");
    const [draft, setDraft] = useState<Draft | null>(null);
    const [working, setWorking] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const locked = !manage || !!busy || !!working;

    if (!catalog) return null;
    const { products, orders, currency } = catalog;
    const toFulfil = orders.filter((o) => o.status === "paid" || o.status === "new").length;

    const send = async (method: "PUT" | "PATCH", body: unknown, key: string) => {
        setWorking(key);
        setError(null);
        try {
            const payload = await readJson<CatalogPayload>(await fetch(catalogEndpoint(projectId), { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
            queryClient.setQueryData(catalogQueryKey(projectId), payload);
            return true;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save. Try again.");
            return false;
        } finally {
            setWorking(null);
        }
    };

    const saveDraft = async () => {
        if (!draft) return;
        const price = parsePrice(draft.price);
        if (!draft.name.trim()) return setError("Give the product a name.");
        if (price === null) return setError("Give it a price, like 12500.");
        const product: CatalogProduct = {
            id: draft.id,
            name: draft.name.trim(),
            price,
            options: draft.options.trim(),
            stock: draft.stock.trim() === "" ? null : Math.max(0, Math.floor(Number(draft.stock) || 0)),
            description: draft.description.trim(),
            available: draft.available,
        };
        const exists = products.some((p) => p.id === product.id);
        const next = exists ? products.map((p) => (p.id === product.id ? product : p)) : [...products, product];
        if (await send("PUT", { products: next }, "draft")) {
            toast.success(exists ? `${product.name} saved` : `${product.name} added`);
            setDraft(null);
        }
    };

    const remove = async (product: CatalogProduct) => {
        if (await send("PUT", { products: products.filter((p) => p.id !== product.id) }, "draft")) {
            toast.success(`${product.name} removed`);
            setDraft(null);
        }
    };

    /** Products from a spreadsheet: same-named products are updated, new ones added. */
    const importFile = async (file: File) => {
        const imported = importCatalogCsv(await file.text());
        if (!imported.ok) return setError(imported.message);
        const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]));
        let updated = 0;
        for (const product of imported.products) {
            const existing = byName.get(product.name.toLowerCase());
            if (existing) updated++;
            byName.set(product.name.toLowerCase(), existing ? { ...product, id: existing.id, available: existing.available } : product);
        }
        const added = imported.products.length - updated;
        if (await send("PUT", { products: [...byName.values()] }, "import")) {
            toast.success(`Imported ${imported.products.length} product${imported.products.length === 1 ? "" : "s"}`, {
                description: [added && `${added} new`, updated && `${updated} updated`, imported.skipped && `${imported.skipped} rows skipped (no name or price)`].filter(Boolean).join(", "),
            });
        }
    };

    const turnOnSelling = async () => {
        if (!version) return;
        setWorking("tool");
        try {
            const current = (version.config_json.system_tools ?? {}) as Record<string, unknown>;
            await postStudioAction(projectId, "save_tools", { agent_id: agent.id, version_id: version.id, system_tools: { ...current, sell_products: {} } });
            await queryClient.invalidateQueries({ queryKey: studioQueryKey(projectId) });
            toast.success("Sell products is on", { description: "Publish to make it live." });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't turn it on.");
        } finally {
            setWorking(null);
        }
    };

    return (
        <div className="overflow-hidden rounded-lg border border-border/60">
            <header className={cn("flex items-center gap-3 px-4 py-3", open && "border-b border-border/60")}>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} products`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/70"><ShoppingBag className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">Products</span>
                        <span className="block truncate text-xs text-muted-foreground">
                            {products.length} product{products.length === 1 ? "" : "s"} · prices in {currency}
                            {toFulfil ? ` · ${toFulfil} order${toFulfil === 1 ? "" : "s"} to fulfil` : ""}
                            {sellOn ? "" : " · Sell products off"}
                        </span>
                    </span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
                {manage && (
                    <div className="flex shrink-0 items-center gap-1">
                        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importFile(file); }} />
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={locked} title="Import a CSV with Name and Price columns (Stock, Options, Description optional)">
                            {working === "import" ? <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Import
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { setError(null); setDraft(emptyDraft()); }} disabled={locked}>
                            <Plus className="h-3.5 w-3.5" />
                            Add
                        </Button>
                    </div>
                )}
            </header>
            {open && (
                <>
                    {!sellOn && (
                        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-amber-500/5 px-4 py-2.5 text-xs">
                            <span className="text-muted-foreground">{agent.name} can&apos;t sell these until Sell products is on.</span>
                            {editable && canManage && (
                                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void turnOnSelling()} disabled={locked}>
                                    {working === "tool" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                    Turn on
                                </Button>
                            )}
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2">
                        <div className="flex gap-1 text-xs">
                            {(["products", "orders"] as const).map((key) => (
                                <button key={key} type="button" onClick={() => setTab(key)} className={cn("rounded-md px-2.5 py-1 transition-colors", tab === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                    {key === "products" ? `Products (${products.length})` : `Orders (${orders.length})`}
                                </button>
                            ))}
                        </div>
                        {tab === "products" && manage && (
                            <select value={currency} onChange={(event) => void send("PUT", { products, currency: event.target.value }, "currency")} disabled={locked} aria-label="Currency" className="h-7 rounded-md border border-border/50 bg-background px-2 text-xs outline-none">
                                {[...new Set([currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        )}
                    </div>
                    {tab === "products" ? (
                        products.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm">No products yet</p>
                                <p className="mx-auto mt-1 max-w-[46ch] text-xs leading-5 text-muted-foreground">
                                    Add them one by one, or import a spreadsheet: a CSV with Name and Price columns (Stock, Options and Description if you have them). Exports from Bumpa, Selar and Shopify work as they are.
                                </p>
                            </div>
                        ) : (
                            <ul className="max-h-[420px] divide-y divide-border/60 overflow-y-auto">
                                {products.map((product) => (
                                    <li key={product.id}>
                                        <button type="button" disabled={!manage} onClick={() => { setError(null); setDraft(toDraft(product)); }} className="flex w-full items-start justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-muted/30 disabled:cursor-default disabled:hover:bg-transparent">
                                            <span className={cn("min-w-0", !product.available && "opacity-50")}>
                                                <span className="block truncate text-sm">{product.name}</span>
                                                {(product.options || product.description) && <span className="block truncate text-[11px] text-muted-foreground">{[product.options, product.description].filter(Boolean).join(" · ")}</span>}
                                            </span>
                                            <span className="shrink-0 text-right">
                                                <span className="block text-sm tabular-nums">{formatPrice(product.price, currency)}</span>
                                                <span className={cn("block text-[11px]", product.stock === 0 ? "text-destructive" : "text-muted-foreground")}>
                                                    {!product.available ? "Hidden" : product.stock === null ? "Stock not tracked" : product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )
                    ) : orders.length === 0 ? (
                        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No orders yet. Orders {agent.name} takes show up here.</p>
                    ) : (
                        <ul className="max-h-[420px] divide-y divide-border/60 overflow-y-auto">
                            {orders.map((order) => (
                                <li key={order.id} className="flex items-start justify-between gap-4 px-4 py-2.5 text-xs">
                                    <span className="min-w-0">
                                        <span className="font-medium">{formatPrice(order.total, order.currency)}</span> · {order.items.map((item) => `${item.quantity} × ${item.name}${item.option ? ` (${item.option})` : ""}`).join(", ")}
                                        <span className="block text-[11px] text-muted-foreground">
                                            {[order.id, order.customer, order.delivery, order.note].filter(Boolean).join(" · ")}
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                        <span className={cn("text-[11px]", order.status === "paid" ? "text-emerald-600 dark:text-emerald-400" : order.status === "new" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                                            {ORDER_STATUS[order.status]} · {new Date(order.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                                        </span>
                                        {manage && (order.status === "paid" || order.status === "new") && (
                                            <span className="flex gap-1">
                                                <button type="button" disabled={locked} onClick={() => void send("PATCH", { order_id: order.id, status: "done" }, order.id)} className="rounded px-1.5 py-0.5 text-[11px] text-foreground hover:bg-muted disabled:opacity-50">Mark done</button>
                                                <button type="button" disabled={locked} onClick={() => void send("PATCH", { order_id: order.id, status: "cancelled" }, order.id)} className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50">Cancel</button>
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
            {error && !draft && <p role="alert" className="border-t border-border/60 px-4 py-2 text-xs text-destructive">{error}</p>}

            <DockedPanel open={!!draft} onOpenChange={(next) => { if (!next && !working) setDraft(null); }}>
                {draft && (
                    <>
                        <SheetHeader className="border-b border-border/60 px-5 py-4">
                            <SheetTitle className="text-base font-medium">{products.some((p) => p.id === draft.id) ? draft.name || "Product" : "Add product"}</SheetTitle>
                            <SheetDescription className="text-xs">What {agent.name} tells customers and charges for it.</SheetDescription>
                        </SheetHeader>
                        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-medium">Name</span>
                                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ankara wrap dress" maxLength={120} className={inputClass} />
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-medium">Price ({currency})</span>
                                    <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputMode="decimal" placeholder="25000" className={cn(inputClass, "tabular-nums")} />
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-xs font-medium">Stock</span>
                                    <input value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" placeholder="Not tracked" className={cn(inputClass, "tabular-nums")} />
                                </label>
                            </div>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-medium">Options</span>
                                <input value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} placeholder="S, M, L, XL" maxLength={200} className={inputClass} />
                                <span className="mt-1.5 block text-[11px] text-muted-foreground">Sizes, colours or flavours. {agent.name} asks which one before ordering.</span>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-medium">Description</span>
                                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} maxLength={500} placeholder="Fabric, fit, what's included…" className={cn(inputClass, "resize-none")} />
                            </label>
                            <div className="flex items-center justify-between gap-4">
                                <span>
                                    <span className="block text-xs font-medium">For sale</span>
                                    <span className="block text-[11px] text-muted-foreground">Off hides it from customers without deleting it.</span>
                                </span>
                                <Switch checked={draft.available} onCheckedChange={(available) => setDraft({ ...draft, available })} aria-label="For sale" />
                            </div>
                            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                        </div>
                        <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
                            {products.some((p) => p.id === draft.id) ? (
                                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive" disabled={locked} onClick={() => { const product = products.find((p) => p.id === draft.id); if (product) void remove(product); }}>
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                            ) : <span />}
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDraft(null)} disabled={!!working}>Cancel</Button>
                                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void saveDraft()} disabled={locked}>
                                    {working === "draft" && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        </SheetFooter>
                    </>
                )}
            </DockedPanel>
        </div>
    );
}
