"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ModelSelect } from "@/components/dashboard/embedded-agents/ModelSelect";
import { postStudioAction, studioQueryKey, type Model } from "@/components/agents/studio";
import { RESTAURANT_DEFAULTS, restaurantInstructions, type RestaurantDetails } from "@/lib/embedded/templates";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring";
const TIME_ZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo", "Europe/London", "America/New_York"];
const VENUE_TYPES: Array<{ value: RestaurantDetails["venueType"]; label: string }> = [
    { value: "restaurant", label: "Restaurant" },
    { value: "lounge", label: "Lounge" },
    { value: "bar", label: "Bar" },
    { value: "cafe", label: "Café" },
];

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
    return (
        <label className={cn("block", className)}>
            <span className="mb-2 block text-xs font-medium">{label}</span>
            {children}
            {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
        </label>
    );
}

/**
 * Step 2 of the restaurant template: the venue's details instead of a prompt.
 * Creates the agent with instructions written from them, and adds the menu as
 * a knowledge document.
 */
export function RestaurantSetup({ projectId, basePath, models, onBack }: { projectId: string | null | undefined; basePath: string; models: Model[]; onBack: () => void }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [details, setDetails] = useState<RestaurantDetails>(RESTAURANT_DEFAULTS);
    const [menu, setMenu] = useState("");
    const [model, setModel] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const set = <K extends keyof RestaurantDetails>(key: K, value: RestaurantDetails[K]) => {
        setDetails((current) => ({ ...current, [key]: value }));
        setError(null);
    };
    const count = (value: string, fallback: number) => Math.max(1, Math.min(500, Number(value.replace(/[^0-9]/g, "")) || fallback));

    const create = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!projectId) return;
        setBusy("Creating the agent…");
        setError(null);
        try {
            const venue = details.venueName.trim();
            const result = await postStudioAction(projectId, "create_agent", {
                name: venue,
                description: `Answers guests and books tables for ${venue}.`,
                model,
                instructions: restaurantInstructions(details),
                template: "restaurant",
            });
            const agentId = result.agent_id as string;
            if (menu.trim()) {
                setBusy("Adding the menu…");
                const response = await fetch(`/api/projects/${projectId}/embedded-agents/${agentId}/knowledge`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: `${venue} menu`, text: menu.trim() }),
                });
                // The agent exists either way; the menu can be added again from Knowledge.
                if (!response.ok) toast.error("Agent created, but the menu wasn't added", { description: "Add it from the Knowledge tab." });
            }
            await queryClient.invalidateQueries({ queryKey: studioQueryKey(projectId) });
            toast.success(`${venue} is ready to set up`);
            router.push(`${basePath}/${encodeURIComponent(agentId)}`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
            setBusy(null);
        }
    };

    const disabled = !!busy;

    return (
        <>
            <h1 className="text-xl font-medium tracking-[-0.02em]">Set up your host</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Tell it about your venue. It answers guests from these details and your menu, and books tables on your Google Calendar. You can change everything later.
            </p>

            <form onSubmit={create} className="mt-8 space-y-6">
                <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                    <Field label="Venue name">
                        <input value={details.venueName} onChange={(e) => set("venueName", e.target.value)} placeholder="e.g. Kapadoccia Lagos" maxLength={80} className={inputClass} autoFocus disabled={disabled} />
                    </Field>
                    <Field label="Type">
                        <select value={details.venueType} onChange={(e) => set("venueType", e.target.value as RestaurantDetails["venueType"])} className={inputClass} disabled={disabled}>
                            {VENUE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                    </Field>
                </div>
                <Field label="Address">
                    <input value={details.address} onChange={(e) => set("address", e.target.value)} placeholder="e.g. 12 Bourdillon Road, Ikoyi, Lagos" maxLength={200} className={inputClass} disabled={disabled} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Opening hours">
                        <input value={details.hours} onChange={(e) => set("hours", e.target.value)} placeholder="e.g. Mon–Thu 12pm–11pm, Fri–Sun 12pm–2am" maxLength={200} className={inputClass} disabled={disabled} />
                    </Field>
                    <Field label="Phone for guests">
                        <input value={details.phone} onChange={(e) => set("phone", e.target.value)} placeholder="e.g. +234 801 234 5678" maxLength={40} className={inputClass} disabled={disabled} />
                    </Field>
                </div>

                <div>
                    <p className="mb-2 text-xs font-medium">Reservations</p>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <Field label="Largest party" className="[&>span:first-child]:font-normal [&>span:first-child]:text-muted-foreground">
                            <input value={String(details.maxPartySize)} onChange={(e) => set("maxPartySize", count(e.target.value, 10))} inputMode="numeric" className={inputClass} disabled={disabled} />
                        </Field>
                        <Field label="Table time (min)" className="[&>span:first-child]:font-normal [&>span:first-child]:text-muted-foreground">
                            <input value={String(details.slotMinutes)} onChange={(e) => set("slotMinutes", count(e.target.value, 120))} inputMode="numeric" className={inputClass} disabled={disabled} />
                        </Field>
                        <Field label="Bookings at once" className="[&>span:first-child]:font-normal [&>span:first-child]:text-muted-foreground">
                            <input value={String(details.tablesPerSlot)} onChange={(e) => set("tablesPerSlot", count(e.target.value, 5))} inputMode="numeric" className={inputClass} disabled={disabled} />
                        </Field>
                        <Field label="Time zone" className="[&>span:first-child]:font-normal [&>span:first-child]:text-muted-foreground">
                            <select value={details.timeZone} onChange={(e) => set("timeZone", e.target.value)} className={inputClass} disabled={disabled}>
                                {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone.split("/")[1].replace("_", " ")}</option>)}
                            </select>
                        </Field>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">A time is full once this many bookings overlap it. Bigger parties are asked to call.</p>
                </div>

                <Field label="Deposit policy" hint="Leave blank if you don't take deposits.">
                    <input value={details.deposit} onChange={(e) => set("deposit", e.target.value)} placeholder="e.g. ₦20,000 per table on Fridays and Saturdays, paid before arrival" maxLength={300} className={inputClass} disabled={disabled} />
                </Field>

                <Field label="Menu" hint="Paste dishes and prices. You can upload a PDF in Knowledge instead, after creating.">
                    <textarea value={menu} onChange={(e) => setMenu(e.target.value)} placeholder={"Jollof rice & chicken — ₦8,500\nAsun — ₦6,000\nChapman — ₦3,500"} rows={6} maxLength={50_000} className={cn(inputClass, "resize-y font-mono text-xs leading-5")} disabled={disabled} />
                </Field>

                <Field label="Anything else guests ask about" hint="Parking, dress code, live music nights, kids, corkage…">
                    <textarea value={details.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={2_000} className={cn(inputClass, "resize-y leading-6")} disabled={disabled} />
                </Field>

                <div>
                    <span className="mb-2 block text-xs font-medium">Model</span>
                    <ModelSelect value={model} onChange={setModel} models={models} placeholder="Choose a model later" />
                </div>

                {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                <div className="flex items-center justify-between pt-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onBack} disabled={disabled}>
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                    <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={!details.venueName.trim() || disabled || !projectId}>
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {busy ?? "Create host"}
                    </Button>
                </div>
            </form>
        </>
    );
}
