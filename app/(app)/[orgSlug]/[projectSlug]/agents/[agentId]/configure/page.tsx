"use client";

import { ModelSelect } from "@/components/dashboard/embedded-agents/ModelSelect";
import { Button } from "@/components/ui/button";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VISIBILITY = [
    { value: "private", label: "Private" },
    { value: "tenant", label: "Customers" },
    { value: "unlisted", label: "Unlisted" },
    { value: "public", label: "Public" },
];

const inputClass = "w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring disabled:cursor-not-allowed disabled:opacity-60";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="text-sm font-medium">{title}</h2>
            <div className="mt-3">{children}</div>
        </section>
    );
}

/** The agent itself: name, instructions, model and who can use it. */
export default function AgentConfigurePage() {
    const { data, form, updateForm, version, visualEditable, editable, simpleVersion, canManage, setVisibility, busy, dirty, saveDraft, discardChanges, publishedVersion } = useAgentWorkspace();
    const locked = !visualEditable || !canManage;
    // What customers and the marketplace see comes from the live version.
    const visibility = (publishedVersion ?? version)?.visibility ?? "private";

    return (
        <div>
            <header className="mb-6">
                <h1 className="text-base font-medium">Agent</h1>
            </header>

            {!editable && (
                <p className="mb-6 rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    Version {version?.version} is published and locked. Create a new draft to change it.
                </p>
            )}
            {editable && !simpleVersion && (
                <p className="mb-6 rounded-md border border-amber-500/25 px-4 py-3 text-xs leading-5 text-amber-500">
                    This version includes advanced tools or skills. Edit and publish it through the API.
                </p>
            )}

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-7">
                    <Section title="Name">
                        <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} disabled={locked} placeholder="Agent name" className={inputClass} />
                    </Section>
                    <Section title="Instructions">
                        <textarea
                            value={form.instructions}
                            onChange={(event) => updateForm("instructions", event.target.value)}
                            disabled={locked}
                            placeholder="You are a helpful assistant that..."
                            className={`${inputClass} min-h-[420px] resize-y font-mono text-[13px] leading-6`}
                        />
                        {canManage && visualEditable && (
                            <div className="mt-3 flex items-center justify-end gap-2">
                                {dirty && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={discardChanges} disabled={!!busy}>Discard</Button>
                                )}
                                {/* Always shown as a solid white button; it just does nothing until there's something to save. */}
                                <Button
                                    size="sm"
                                    className="h-7 bg-foreground text-xs text-background hover:bg-foreground/90 disabled:opacity-100"
                                    onClick={() => void saveDraft()}
                                    disabled={!dirty || !!busy}
                                >
                                    {busy === "save_draft" ? "Saving…" : "Save changes"}
                                </Button>
                            </div>
                        )}
                    </Section>
                </div>

                <div className="space-y-7">
                    <Section title="Model">
                        <ModelSelect value={form.model} onChange={(value) => updateForm("model", value)} models={data.models} disabled={locked} placeholder="Choose a model" />
                    </Section>
                    {version && (
                        <Section title="Visibility">
                            <Select value={visibility} onValueChange={(value) => void setVisibility(value)} disabled={!canManage || !!busy}>
                                <SelectTrigger className="h-9 text-sm shadow-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {VISIBILITY.map((item) => (
                                        <SelectItem key={item.value} value={item.value} className="text-sm">{item.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Section>
                    )}
                    {version && (
                        <dl className="space-y-2 rounded-lg border border-border/40 bg-muted/30 p-4 text-xs">
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Version</dt><dd className="font-mono">v{version.version}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{version.status.replaceAll("_", " ")}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last test</dt><dd>{version.last_tested_at ? (version.last_test_passed ? "Passed" : "Failed") : "Not run"}</dd></div>
                        </dl>
                    )}
                </div>
            </div>
        </div>
    );
}
