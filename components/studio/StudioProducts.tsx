"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { DocumentTextIcon } from "@solar-icons/react/bold-duotone/document-text";
import { GalleryIcon } from "@solar-icons/react/bold-duotone/gallery";
import { PenIcon } from "@solar-icons/react/bold-duotone/pen";
import { WhatsAppMark } from "@/components/studio/ConversationAvatar";
import { Spinner } from "@/components/ui/spinner";
import { useStudio } from "@/components/studio/StudioShell";
import { studioFetch } from "@/components/studio/studio-data";
import { useStudioOverview } from "@/components/studio/useStudioOverview";
import { importCatalogCsv, type CatalogProduct } from "@/lib/embedded/catalog-format";
import { applyMerge, mergeProducts, productLinks, type IncomingProduct, type MergeChoices, type MergeRow } from "@/lib/embedded/catalog-merge";
import { resizePhoto } from "@/lib/studio/resize-photo";
import { xlsxToCsv } from "@/lib/studio/xlsx";
import { cn } from "@/lib/utils";

/**
 * Add products from wherever they are: store exports (Shopify, Bumpa; CSV or
 * Excel), screenshots (a WhatsApp catalog, Instagram), or a pasted list. All
 * of it, and what's already saved, becomes one list; the same product from two
 * places is one product. The owner sees what changes, settles anything
 * unclear, and saves.
 */

const PICTURES_PER_CALL = 6;

/** Online stores' marks (Simple Icons, CC0, in each brand's colour); the WhatsApp catalog uses WhatsApp's glyph. */
const STORE_LOGOS: Record<string, string> = { woocommerce: "/stores/woocommerce.svg", shopify: "/stores/shopify.svg", square: "/stores/square.svg" };

/** A small spaced-capitals label over a part of the sheet. */
function SheetLabel({ children, action, first }: { children: ReactNode; action?: string; first?: boolean }) {
    return (
        <div className={cn("mb-2.5 flex items-baseline justify-between px-1", first ? "mt-1" : "mt-6")}>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h3>
            {action && <span className="text-[13px] text-muted-foreground">{action}</span>}
        </div>
    );
}

type Source = { label: string; count: number };

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
    const response = await studioFetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error((json as { error?: string } | null)?.error ?? "That didn't work. Try again.");
    return json as T;
}

const naira = (amount: number, currency: string) => (currency === "NGN" ? `₦${amount.toLocaleString("en-NG")}` : `${currency} ${amount.toLocaleString("en-NG")}`);

/** "products_export_1.csv" → "Shopify export"; else the file's name without its extension. */
function fileLabel(name: string): string {
    if (/products_export/i.test(name)) return "Shopify export";
    if (/bumpa/i.test(name)) return "Bumpa export";
    return name.replace(/\.[^.]+$/, "").slice(0, 40) || "Spreadsheet";
}

export function ProductsTask({ onDone }: { onDone: () => void }) {
    const { project, agents } = useStudio();
    const assistant = useStudioOverview().data?.assistant ?? null;
    const [catalog, setCatalog] = useState<{ products: CatalogProduct[]; currency: string } | null>(null);
    const [incoming, setIncoming] = useState<IncomingProduct[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [step, setStep] = useState<"add" | "review" | "saved">("add");
    const [reading, setReading] = useState<string | null>(null);
    const [pasting, setPasting] = useState(false);
    const [pasted, setPasted] = useState("");
    const [choices, setChoices] = useState<MergeChoices>({});
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<{ added: number; updated: number; dropped: number; total: number } | null>(null);
    const [turningOn, setTurningOn] = useState(false);
    /** Stores brought in this time, by provider → the source label their products carry. */
    const [fromStores, setFromStores] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const files = useRef<HTMLInputElement>(null);
    const pictures = useRef<HTMLInputElement>(null);

    useEffect(() => {
        send<{ catalog: { products: CatalogProduct[]; currency: string } | null }>(`/api/projects/${project.id}/catalog`, "GET")
            .then((body) => setCatalog(body.catalog ?? { products: [], currency: "NGN" }))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Couldn't load your products."));
    }, [project.id]);

    const add = (label: string, products: Array<Omit<IncomingProduct, "source">>) => {
        setIncoming((current) => [...current, ...products.map((product) => ({ ...product, source: label }))]);
        setSources((current) => {
            const found = current.find((source) => source.label === label);
            return found ? current.map((source) => (source === found ? { ...source, count: source.count + products.length } : source)) : [...current, { label, count: products.length }];
        });
    };

    const readFiles = async (list: FileList | null) => {
        if (!list?.length) return;
        setError(null);
        for (const file of Array.from(list)) {
            try {
                setReading(`Reading ${file.name}`);
                const text = /\.xlsx$/i.test(file.name) ? await xlsxToCsv(file) : await file.text();
                const imported = importCatalogCsv(text);
                if (!imported.ok) throw new Error(`${file.name}: ${imported.message}`);
                add(fileLabel(file.name), imported.products);
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : `Couldn't read ${file.name}.`);
            }
        }
        setReading(null);
        if (files.current) files.current.value = "";
    };

    const readPictures = async (list: FileList | null) => {
        if (!list?.length) return;
        setError(null);
        const all = Array.from(list);
        let done = 0;
        try {
            for (let index = 0; index < all.length; index += PICTURES_PER_CALL) {
                const batch = all.slice(index, index + PICTURES_PER_CALL);
                setReading(`Reading ${Math.min(done + batch.length, all.length)} of ${all.length} pictures`);
                const images = await Promise.all(batch.map((file) => resizePhoto(file)));
                const { products } = await send<{ products: Array<Omit<IncomingProduct, "source">> }>("/api/studio/products/read", "POST", { project_id: project.id, images });
                add("Screenshots", products);
                done += batch.length;
            }
        } catch (cause) {
            setError(`${done ? `Read ${done} of ${all.length} pictures. ` : ""}${cause instanceof Error ? cause.message : "Couldn't read the pictures."}`);
        } finally {
            setReading(null);
            if (pictures.current) pictures.current.value = "";
        }
    };

    const readText = async () => {
        if (!pasted.trim()) return;
        setError(null);
        setReading("Reading your list");
        try {
            // A table pasted from a spreadsheet goes through the import as it is; anything else is read.
            const table = importCatalogCsv(pasted);
            if (table.ok) add("Your list", table.products);
            else {
                const { products } = await send<{ products: Array<Omit<IncomingProduct, "source">> }>("/api/studio/products/read", "POST", { project_id: project.id, text: pasted });
                add("Your list", products);
            }
            setPasted("");
            setPasting(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't read your list.");
        } finally {
            setReading(null);
        }
    };

    const rows = useMemo(() => (step === "review" && catalog ? mergeProducts(catalog.products, incoming) : []), [step, catalog, incoming]);
    const count = (kind: MergeRow["kind"]) => rows.filter((row) => row.kind === kind).length;
    const changed = rows.filter((row) => row.kind !== "update" || row.changes.length > 0);

    const save = async () => {
        if (!catalog) return;
        setSaving(true);
        setError(null);
        try {
            const merged = applyMerge(catalog.products, rows, choices);
            await send(`/api/projects/${project.id}/catalog`, "PUT", { products: merged.products, currency: catalog.currency });
            // Stores brought in this time stay in sync from now on: remember which product each became.
            const links = productLinks(rows, choices);
            await Promise.all(Object.entries(fromStores).map(([provider, label]) => {
                const ids = new Set(incoming.filter((item) => item.source === label && item.externalId).map((item) => item.externalId!));
                return send("/api/studio/stores", "POST", { project_id: project.id, action: "link", provider, links: Object.fromEntries(Object.entries(links).filter(([id]) => ids.has(id))) });
            }));
            setResult({ added: merged.added, updated: merged.updated, dropped: merged.dropped, total: merged.products.length });
            setStep("saved");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't save the products.");
        } finally {
            setSaving(false);
        }
    };

    /**
     * Switch on "sell products" for the assistant: a new version with the tool
     * added to the ones it has, tested and made live, as Go live does.
     */
    const sellThem = async (agentId: string) => {
        setTurningOn(true);
        setError(null);
        const studio = `/api/projects/${project.id}/embedded-agents/studio`;
        try {
            const { version_id } = await send<{ version_id: string }>(studio, "POST", { action: "new_version", agent_id: agentId });
            // Saved without changes first: the answer has the tools it already has, which the next save must keep.
            const { system_tools } = await send<{ system_tools: Record<string, unknown> }>(studio, "POST", { action: "save_tools", agent_id: agentId, version_id });
            await send(studio, "POST", { action: "save_tools", agent_id: agentId, version_id, system_tools: { ...system_tools, sell_products: true } });
            await send(studio, "POST", { action: "test_version", agent_id: agentId, version_id, input: "What do you sell?" });
            await send(studio, "POST", { action: "publish_version", agent_id: agentId, version_id });
            onDone();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Couldn't switch it on. Try again.");
            setTurningOn(false);
        }
    };

    if (!catalog) {
        return error ? <p role="alert" className="text-[13px] text-destructive">{error}</p> : <div className="mt-5 flex justify-center"><Spinner className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
    }

    if (step === "saved" && result) {
        const selling = assistant?.system_tools.includes("sell_products") ?? true;
        return (
            <>
                <p className="flex items-center gap-2 text-[15px] font-semibold"><Check className="h-4 w-4 text-emerald-600" />{result.total} products saved</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    {[result.added && `${result.added} new`, result.updated && `${result.updated} updated`, result.dropped && `${result.dropped} left out (500 is the most)`].filter(Boolean).join(" · ") || "Nothing changed"}
                </p>
                {error && <p role="alert" className="mt-3 text-[13px] leading-5 text-destructive">{error}</p>}
                {!selling && agents[0] ? (
                    <button type="button" disabled={turningOn} onClick={() => void sellThem(assistant?.id ?? agents[0].id)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-60">
                        {turningOn && <Spinner className="h-4 w-4 animate-spin" />}Let my assistant sell them
                    </button>
                ) : (
                    <button type="button" onClick={onDone} className="mt-5 h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background">Done</button>
                )}
            </>
        );
    }

    if (step === "review") {
        return (
            <>
                <p className="text-[15px] leading-6">
                    {[
                        count("new") > 0 && `${count("new")} new`,
                        changed.filter((row) => row.kind === "update").length > 0 && `${changed.filter((row) => row.kind === "update").length} updated`,
                        count("prices") + count("maybe") > 0 && `${count("prices") + count("maybe")} to check`,
                    ].filter(Boolean).join(" · ") || "Already up to date"}
                </p>
                <ul className="mt-4 space-y-2.5">
                    {changed.map((row) => (
                        <li key={row.key} className="rounded-2xl bg-muted px-4 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="min-w-0 truncate text-[15px] font-medium">{row.product.name}</span>
                                {row.kind !== "prices" && <span className="shrink-0 text-[15px]">{naira(row.product.price, catalog.currency)}</span>}
                            </div>
                            {row.kind === "prices" && (
                                <>
                                    <p className="mt-0.5 text-[13px] text-muted-foreground">Different prices. Which one?</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {row.prices.map((option) => {
                                            const chosen = (choices[row.key]?.price ?? row.prices[0].price) === option.price;
                                            return (
                                                <button key={option.price} type="button" onClick={() => setChoices((current) => ({ ...current, [row.key]: { price: option.price } }))} className={cn("rounded-full border px-3 py-1.5 text-[13px]", chosen ? "border-foreground bg-foreground text-background" : "border-border/60")}>
                                                    {naira(option.price, catalog.currency)} <span className="opacity-70">{option.sources.join(", ")}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                            {row.kind === "maybe" && (
                                <>
                                    <p className="mt-0.5 text-[13px] text-muted-foreground">Same as &ldquo;{row.existing.name}&rdquo;?</p>
                                    <div className="mt-2 flex gap-2">
                                        {[true, false].map((same) => (
                                            <button key={String(same)} type="button" onClick={() => setChoices((current) => ({ ...current, [row.key]: { same } }))} className={cn("rounded-full border px-3 py-1.5 text-[13px]", !!choices[row.key]?.same === same ? "border-foreground bg-foreground text-background" : "border-border/60")}>
                                                {same ? "Same" : "Different"}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                            {row.kind === "update" && <p className="mt-0.5 text-[13px] text-muted-foreground">{row.changes.join(" · ")}</p>}
                            {row.kind === "new" && <p className="mt-0.5 text-[13px] text-muted-foreground">New · {row.sources.join(", ")}</p>}
                        </li>
                    ))}
                </ul>
                {error && <p role="alert" className="mt-3 text-[13px] leading-5 text-destructive">{error}</p>}
                <button type="button" disabled={saving || changed.length === 0} onClick={() => void save()} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-50">
                    {saving && <Spinner className="h-4 w-4 animate-spin" />}{changed.length === 0 ? "Nothing new" : "Save"}
                </button>
                <button type="button" onClick={() => setStep("add")} className="mt-3 w-full text-center text-[13px] text-muted-foreground">Add more</button>
            </>
        );
    }

    return (
        <>
            <input ref={files} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv" multiple hidden onChange={(event) => void readFiles(event.target.files)} />
            <input ref={pictures} type="file" accept="image/*" multiple hidden onChange={(event) => void readPictures(event.target.files)} />
            <SheetLabel first action={catalog.products.length ? `${catalog.products.length} saved` : undefined}>Add from</SheetLabel>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted">
                {[
                    { label: "Spreadsheet", hint: "Shopify, Bumpa, Excel", icon: <DocumentTextIcon size={20} />, tone: "bg-emerald-400/15 text-emerald-500 dark:text-emerald-400", onClick: () => files.current?.click() },
                    { label: "Screenshots", hint: "WhatsApp, Instagram", icon: <GalleryIcon size={20} />, tone: "bg-violet-400/15 text-violet-500 dark:text-violet-400", onClick: () => pictures.current?.click() },
                    { label: "Type or paste", hint: "A price list", icon: <PenIcon size={20} />, tone: "bg-orange-400/15 text-orange-500 dark:text-orange-400", onClick: () => setPasting((open) => !open) },
                ].map((option) => (
                    <li key={option.label}>
                        <button type="button" disabled={!!reading} onClick={option.onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-50">
                            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", option.tone)}>{option.icon}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-semibold">{option.label}</span>
                                <span className="block truncate text-[13px] text-muted-foreground">{option.hint}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                    </li>
                ))}
            </ul>
            {pasting && (
                <div className="mt-2.5">
                    <textarea value={pasted} onChange={(event) => setPasted(event.target.value)} rows={5} placeholder={"Jollof rice ₦4,000\nChapman ₦2,500"} className="w-full resize-none rounded-2xl bg-muted px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground" />
                    <button type="button" disabled={!pasted.trim() || !!reading} onClick={() => void readText()} className="mt-2 h-10 w-full rounded-full border border-border/60 text-sm font-semibold disabled:opacity-50">Add this list</button>
                </div>
            )}
            <StoreSection
                disabled={!!reading}
                onProducts={(provider, label, products) => {
                    add(label, products);
                    setFromStores((current) => ({ ...current, [provider]: label }));
                }}
                onError={setError}
            />
            {reading && <p className="mt-4 flex items-center gap-2 px-1 text-[13px] text-muted-foreground"><Spinner className="h-4 w-4" />{reading}</p>}
            {sources.length > 0 && (
                <>
                    <SheetLabel>Added</SheetLabel>
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted">
                        {sources.map((source) => (
                            <li key={source.label} className="flex items-center gap-3 px-4 py-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-500 dark:text-emerald-400"><Check className="h-4 w-4" /></span>
                                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{source.label}</span>
                                <span className="shrink-0 text-[13px] text-muted-foreground">{source.count}</span>
                                <button type="button" aria-label={`Remove ${source.label}`} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground" onClick={() => {
                                    setIncoming((current) => current.filter((item) => item.source !== source.label));
                                    setSources((current) => current.filter((item) => item !== source));
                                    setFromStores((current) => Object.fromEntries(Object.entries(current).filter(([, label]) => label !== source.label)));
                                }}><X className="h-4 w-4" /></button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {error && <p role="alert" className="mt-3 text-[13px] leading-5 text-destructive">{error}</p>}
            <span aria-hidden className="block h-5 shrink-0" />
            <button type="button" disabled={incoming.length === 0 || !!reading} onClick={() => { setChoices({}); setStep("review"); }} className="mt-auto h-12 w-full shrink-0 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-50">
                {incoming.length ? `Review ${incoming.length} products` : "Review"}
            </button>
        </>
    );
}

type StoreState = { provider: string; label: string; connected: boolean; broken: boolean; syncing: boolean; last_synced_at: string | null; last_error: string | null; products: number };

function ago(iso: string): string {
    const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

/**
 * Online stores (Shopify, WooCommerce): connect, bring the products in once
 * through the review, then they stay in sync by themselves.
 */
function StoreSection({ disabled, onProducts, onError }: { disabled: boolean; onProducts: (provider: string, label: string, products: Array<Omit<IncomingProduct, "source">>) => void; onError: (message: string | null) => void }) {
    const { project } = useStudio();
    const [stores, setStores] = useState<StoreState[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [brought, setBrought] = useState<Record<string, boolean>>({});

    const load = useMemo(() => () => {
        send<{ stores: StoreState[] }>(`/api/studio/stores?project_id=${project.id}`, "GET").then((body) => setStores(body.stores)).catch(() => setStores([]));
    }, [project.id]);
    useEffect(() => {
        load();
        // Back from the store's sign-in (another tab or window): look again.
        const again = () => { if (document.visibilityState === "visible") load(); };
        document.addEventListener("visibilitychange", again);
        return () => document.removeEventListener("visibilitychange", again);
    }, [load]);

    // Shown straight away (WooCommerce and Square are always on); the real list, with each store's state, follows.
    const placeholder = (provider: string, label: string) => ({ provider, label, connected: false, broken: false, syncing: false, last_synced_at: null, last_error: null, products: 0, loading: true });
    const shown: Array<StoreState & { loading?: boolean }> = stores ?? [placeholder("woocommerce", "WooCommerce"), placeholder("square", "Square")];
    if (!shown.length) return null;

    const act = async (store: StoreState, action: "connect" | "fetch" | "sync" | "disconnect") => {
        setBusy(`${store.provider}:${action}`);
        onError(null);
        try {
            if (action === "connect") {
                const { url } = await send<{ url: string }>("/api/studio/stores", "POST", { project_id: project.id, action, provider: store.provider });
                window.open(url, "_blank", "noopener");
            } else if (action === "fetch") {
                const { products } = await send<{ products: Array<{ externalId: string; name: string; price: number; description: string; options: string; stock: number | null }> }>("/api/studio/stores", "POST", { project_id: project.id, action, provider: store.provider });
                onProducts(store.provider, store.label, products);
                setBrought((current) => ({ ...current, [store.provider]: true }));
            } else {
                await send("/api/studio/stores", "POST", { project_id: project.id, action, provider: store.provider });
                load();
            }
        } catch (cause) {
            onError(cause instanceof Error ? cause.message : "The store didn't answer. Try again.");
        } finally {
            setBusy(null);
        }
    };
    const button = "flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-3.5 text-[13px] font-semibold disabled:opacity-50";

    return (
        <>
            <SheetLabel>Online stores</SheetLabel>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-muted">
                {shown.map((store) => (
                    <li key={store.provider} className="flex items-center gap-3 px-4 py-3">
                        {STORE_LOGOS[store.provider]
                            // eslint-disable-next-line @next/next/no-img-element -- our own small static file
                            ? <img src={STORE_LOGOS[store.provider]} alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
                            : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]"><WhatsAppMark className="h-5 w-5" /></span>}
                        <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold">{store.label}</span>
                            <span className="block truncate text-[13px] text-muted-foreground">
                                {store.syncing
                                    ? store.last_error ? "Last sync failed" : `${store.products} products · synced ${store.last_synced_at ? ago(store.last_synced_at) : ""}`
                                    : store.broken ? "Sign in again" : store.connected ? "Connected" : "Stays in sync by itself"}
                            </span>
                        </span>
                        {store.loading ? (
                            <Spinner className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : store.syncing ? (
                            <>
                                <button type="button" disabled={disabled || !!busy} onClick={() => void act(store, "sync")} className={button}>{busy === `${store.provider}:sync` && <Spinner className="h-3.5 w-3.5" />}Sync now</button>
                                <button type="button" disabled={disabled || !!busy} onClick={() => void act(store, "disconnect")} aria-label={`Stop syncing ${store.label}`} className="text-muted-foreground disabled:opacity-50"><X className="h-4 w-4" /></button>
                            </>
                        ) : store.connected && !store.broken ? (
                            <button type="button" disabled={disabled || !!busy || brought[store.provider]} onClick={() => void act(store, "fetch")} className={button}>
                                {busy === `${store.provider}:fetch` && <Spinner className="h-3.5 w-3.5" />}{brought[store.provider] ? "Added" : "Bring in"}
                            </button>
                        ) : (
                            <button type="button" disabled={disabled || !!busy} onClick={() => void act(store, "connect")} className={button}>{busy === `${store.provider}:connect` && <Spinner className="h-3.5 w-3.5" />}Connect</button>
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}
