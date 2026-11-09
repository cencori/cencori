"use client";
import { getBrowserAuthUser } from "@/lib/auth/get-browser-auth-user";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { slugify } from "@/lib/utils";
import { isReservedProjectSlug } from "@/lib/reserved-slugs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabaseClient";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { UpgradeDialog } from "@/components/billing/UpgradeDialog";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";

/**
 * Every project runs in one place: the app, database, files and logs are on Brimble afr-west in
 * Lagos. There is no region to pick. projects.region still has a check constraint (projects_region_check)
 * that rejects the column default, so creation sends the closest value it accepts. Nothing reads it.
 */
const STORED_REGION = "af-south-1";

const formSchema = z.object({
    name: z.string().min(2, { message: "Project name must be at least 2 characters." }),
    description: z.string().optional(),
    region: z.literal(STORED_REGION),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId?: string;
    orgSlug: string;
    orgName?: string;
    subscriptionTier?: string;
    consoleMode?: boolean;
}

export function CreateProjectDialog({
    open,
    onOpenChange,
    orgId,
    orgSlug,
    orgName,
    subscriptionTier,
    consoleMode = false,
}: CreateProjectDialogProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { refetchData, selectProject } = useOrganizationProject();
    const [loading, setLoading] = useState(false);
    const [upgradeOpen, setUpgradeOpen] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
            region: STORED_REGION,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({ name: "", description: "", region: STORED_REGION });
        }
    }, [open, form]);

    const onSubmit = async (values: FormValues) => {
        setLoading(true);

        const { data: { user } } = await getBrowserAuthUser(supabase);
        if (!user) {
            toast.error("You must be logged in to create a project.");
            setLoading(false);
            return;
        }

        if (!orgId) {
            toast.error("Organization data is not loaded yet. Please try again.");
            setLoading(false);
            return;
        }

        const tier = subscriptionTier || "free";
        if (tier === "free") {
            const { count } = await supabase
                .from("projects")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", orgId);
            if ((count ?? 0) >= 1) {
                setLoading(false);
                setUpgradeOpen(true);
                return;
            }
        }

        const baseSlug = slugify(values.name) || "project";
        let newSlug = baseSlug;
        let slugExists = true;

        for (let i = 0; i < 20; i++) {
            if (isReservedProjectSlug(newSlug)) {
                newSlug = `${baseSlug}-${i + 2}`;
                continue;
            }
            const { data } = await supabase
                .from("projects")
                .select("slug")
                .eq("organization_id", orgId)
                .eq("slug", newSlug)
                .single();

            if (!data) {
                slugExists = false;
                break;
            }
            newSlug = `${baseSlug}-${i + 2}`;
        }

        if (slugExists) {
            toast.error("Could not generate a unique project slug. Please try a different name.");
            setLoading(false);
            return;
        }

        const { data: inserted, error } = await supabase
            .from("projects")
            .insert({
                name: values.name,
                slug: newSlug,
                description: values.description || null,
                organization_id: orgId,
                visibility: "private",
                region: values.region,
            })
            .select("id, slug")
            .single();

        if (error?.message?.includes("project_limit_reached")) {
            // The Free plan's project limit, enforced by the database.
            setUpgradeOpen(true);
            setLoading(false);
            return;
        } else if (error) {
            console.error("Error creating project:", error.message);
            toast.error("Failed to create project. " + error.message);
            setLoading(false);
            return;
        }

        toast.success("Project created successfully!");
        await refetchData();
        await queryClient.invalidateQueries({ queryKey: ["orgProjects", orgSlug] });
        if (orgId) {
            await queryClient.invalidateQueries({ queryKey: ["sidebarProjects", orgId] });
        }
        setLoading(false);
        onOpenChange(false);

        const createdSlug = inserted?.slug ?? newSlug;
        if (consoleMode && inserted?.id && (await selectProject(inserted.id))) {
            router.push("/home");
            router.refresh();
            return;
        }
        router.push(`/${orgSlug}/${createdSlug}`);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="gap-0 overflow-y-auto !border-0 bg-background p-0 text-foreground shadow-2xl shadow-black/20 dark:bg-[#111111] sm:max-w-2xl">
                    <DialogHeader className="px-6 pt-6 text-left">
                        <DialogTitle className="text-base font-medium">Create a new project</DialogTitle>
                        <DialogDescription className="text-xs">
                            Projects contain API keys and configurations for your AI integrations in {orgName || "your organization"}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 py-6">
                        <div className="rounded-lg bg-transparent">
                            <form onSubmit={form.handleSubmit(onSubmit)}>
                                <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[140px_1fr] md:gap-6">
                                    <label htmlFor="new-project-name" className="pt-2 text-xs font-medium">
                                        Name
                                    </label>
                                    <div className="space-y-1.5">
                                        <Input
                                            id="new-project-name"
                                            placeholder="Project name"
                                            autoComplete="off"
                                            className="h-8 border-0 bg-white text-xs dark:bg-white/[0.06]"
                                            {...form.register("name")}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            What&apos;s the name of your project? You can change this later.
                                        </p>
                                        {form.formState.errors.name && (
                                            <p className="text-[11px] text-red-500">{form.formState.errors.name.message}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[140px_1fr] md:gap-6">
                                    <label htmlFor="new-project-description" className="pt-2 text-xs font-medium">
                                        Description
                                    </label>
                                    <div className="space-y-1.5">
                                        <Input
                                            id="new-project-description"
                                            placeholder="A brief description (optional)"
                                            autoComplete="off"
                                            className="h-8 border-0 bg-white text-xs dark:bg-white/[0.06]"
                                            {...form.register("description")}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Optional description to help identify this project.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[140px_1fr] md:gap-6">
                                    <span className="pt-2 text-xs font-medium">
                                        Region
                                    </span>
                                    <div className="space-y-1.5">
                                        <div className="flex h-8 items-center gap-2 text-xs">
                                          <span className="text-sm">🇳🇬</span>
                                          <span>Lagos, Nigeria</span>
                                          <span className="font-mono text-[10px] text-muted-foreground">afr-west</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">Every project runs in Lagos. Its data and logs are stored there.</p>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 bg-foreground/[0.05] px-3 text-xs hover:bg-foreground/10 dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="h-7 px-4 text-xs"
                                disabled={loading}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                {loading ? "Creating..." : "Create project"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {orgId && (
                <UpgradeDialog
                    open={upgradeOpen}
                    onOpenChange={setUpgradeOpen}
                    orgId={orgId}
                    orgSlug={orgSlug}
                    orgName={orgName}
                    reason="Your free plan is limited to 1 project. Upgrade to Pro for unlimited projects."
                    recommendedTier="pro"
                />
            )}
        </>
    );
}
