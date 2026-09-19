"use client";

import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { Check, CircleUserRound, LogOut, PlusCircle, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import posthog from "posthog-js";
import { beginIntentionalSignOut, clearClientSessionCaches } from "@/lib/auth/session-caches";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { getConsoleRoute } from "@/lib/console/routing";

const UpgradeDialog = dynamic(
    () => import("@/components/billing/UpgradeDialog").then((module) => module.UpgradeDialog),
    { ssr: false },
);

type ProfileData = {
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string | null;
};

type UserMenuProps = {
    organization?: {
        id: string;
        name: string;
        slug: string;
        subscriptionTier: string;
    };
};

export function UserMenu({ organization }: UserMenuProps) {
    const router = useRouter();
    const pathname = usePathname();
    const {
        organizations,
        projects,
        activeOrganization,
        selectProject,
    } = useOrganizationProject();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [upgradePreload, setUpgradePreload] = useState(false);

    useEffect(() => {
        let cancelled = false;

        supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
            if (cancelled) return;
            if (session?.user) {
                const meta = session.user.user_metadata;
                setProfile({
                    first_name: meta?.first_name || meta?.given_name || "",
                    last_name: meta?.last_name || meta?.family_name || "",
                    email: session.user.email || "",
                    avatar_url: meta?.avatar_url || meta?.picture || null,
                });
            }
        });

        fetch("/api/user/profile")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (cancelled || !data?.profile) return;
                setProfile(data.profile);
            })
            .catch(() => {});

        return () => { cancelled = true; };
    }, []);

    const displayAvatar = profile?.avatar_url || null;
    const email = profile?.email || "";
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    const displayName = fullName || email;
    const currentOrganization = activeOrganization
        ?? (organization ? organizations.find((item) => item.id === organization.id) : null)
        ?? (organization ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            subscription_tier: organization.subscriptionTier,
        } : null);
    const organizationOptions = organizations.length > 0
        ? organizations
        : currentOrganization ? [currentOrganization] : [];
    const isCanonicalConsoleRoute = getConsoleRoute(pathname) !== null;
    const organizationSettingsHref = currentOrganization
        ? (isCanonicalConsoleRoute
            ? "/organization/settings"
            : `/${currentOrganization.slug}/~/settings`)
        : null;
    const currentTier = organization?.subscriptionTier === "pro" || organization?.subscriptionTier === "team"
        ? organization.subscriptionTier
        : "free";
    const canUpgrade = currentTier === "free";
    const upgradeLabel = "Upgrade to Pro";

    const openUpgrade = () => {
        if (!organization || !canUpgrade) return;
        setMenuOpen(false);
        setUpgradeOpen(true);
    };

    const switchOrganization = async (organizationId: string) => {
        const nextOrganization = organizations.find((item) => item.id === organizationId);
        if (!nextOrganization) return;

        const firstProject = projects.find((project) => project.organization_id === nextOrganization.id);
        setMenuOpen(false);

        if (firstProject) {
            if (isCanonicalConsoleRoute && await selectProject(firstProject.id)) {
                router.push("/home");
                router.refresh();
                return;
            }
            router.push(`/${nextOrganization.slug}/${firstProject.slug}`);
            return;
        }

        router.push(`/${nextOrganization.slug}/~/projects`);
    };

    return (
        <>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors outline-hidden"
                        aria-label="User menu"
                    >
                        <UserAvatar
                            src={displayAvatar}
                            name={fullName}
                            email={email}
                            size={24}
                        />
                        <span className="flex-1 truncate">{displayName}</span>
                        <span className="inline-flex items-center justify-center size-6 rounded-full border border-border/60 text-xs text-muted-foreground font-bold leading-none">⋯</span>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-66 rounded-xl !border-0 !bg-[#f3f3f1] dark:!bg-[#181818] p-1 shadow-[0_18px_48px_rgba(0,0,0,0.35)] data-[state=closed]:!animate-none data-[state=open]:!animate-none" side="top" sideOffset={4} align="start" forceMount>
                    <div className="space-y-0 px-3 pb-1.5 pt-1.5">
                        <p className="truncate text-[13px] font-medium leading-tight text-popover-foreground">{fullName || email}</p>
                        {fullName && <p className="truncate text-[11px] leading-tight text-muted-foreground">{email}</p>}
                    </div>
                    <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                    {currentOrganization && (
                        <>
                            <p className="px-3 pb-1 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Organization</p>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="min-h-9 cursor-pointer rounded-lg px-3 py-1 text-[13px]">
                                    <span className="min-w-0 flex-1 truncate text-left font-medium text-popover-foreground">
                                        {currentOrganization.name}
                                    </span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent
                                    sideOffset={6}
                                    className="w-64 rounded-xl !border-0 !bg-[#f3f3f1] dark:!bg-[#181818] p-1 shadow-[0_18px_48px_rgba(0,0,0,0.35)]"
                                >
                                    <p className="px-3 pb-1 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Organizations</p>
                                    <div className="max-h-52 overflow-y-auto">
                                        {organizationOptions.map((item) => (
                                            <DropdownMenuItem
                                                key={item.id}
                                                className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]"
                                                onClick={() => void switchOrganization(item.id)}
                                            >
                                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary text-[9px] font-semibold">
                                                    {item.name.slice(0, 1).toUpperCase()}
                                                </span>
                                                <span className="truncate">{item.name}</span>
                                                {item.id === currentOrganization.id && <Check className="ml-auto h-3.5 w-3.5" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                    <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                                    {organizationSettingsHref && (
                                        <DropdownMenuItem
                                            className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                router.push(organizationSettingsHref);
                                            }}
                                        >
                                            <span className="min-w-0 flex-1 truncate">Organization settings</span>
                                            <Settings className="ml-auto size-4 shrink-0" />
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            router.push("/onboarding");
                                        }}
                                    >
                                        <span className="min-w-0 flex-1 truncate">New organization</span>
                                        <PlusCircle className="ml-auto size-4 shrink-0" />
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                        </>
                    )}
                    <p className="px-3 pb-1 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Account</p>
                    <DropdownMenuItem className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]" onClick={() => router.push("/account/profile")}>
                        <span className="min-w-0 flex-1 truncate">Profile</span>
                        <CircleUserRound className="ml-auto size-4 shrink-0" />
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]" onClick={() => router.push("/account/settings")}>
                        <span className="min-w-0 flex-1 truncate">Settings</span>
                        <Settings className="ml-auto size-4 shrink-0" />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                    {canUpgrade && (
                        <>
                            <div className="px-3 py-1">
                                <button
                                    type="button"
                                    onClick={openUpgrade}
                                    onPointerEnter={() => setUpgradePreload(true)}
                                    onFocus={() => setUpgradePreload(true)}
                                    disabled={!organization}
                                    className="flex h-7 w-full items-center justify-center rounded-md bg-foreground px-3 text-[11px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {upgradeLabel}
                                </button>
                            </div>
                            <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                        </>
                    )}
                    <div className="flex min-h-8 items-center justify-between px-3 py-1">
                        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Theme</p>
                        <ThemeSwitcher />
                    </div>
                    <DropdownMenuSeparator className="-mx-1 my-1 bg-border/35" />
                    <DropdownMenuItem className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px]" onClick={() => router.push("/")}>
                        <span className="min-w-0 flex-1 truncate">Homepage</span>
                        <span className="size-3.5 shrink-0">
                            <Logo variant="mark" className="h-full w-full" />
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-[13px] text-red-500 focus:text-red-500"
                        onClick={async () => {
                            // Flag it first: SessionProvider watches for the
                            // session disappearing and would otherwise raise the
                            // "you were signed out" screen over a log-out the
                            // user just asked for.
                            beginIntentionalSignOut();
                            clearClientSessionCaches();
                            await supabase.auth.signOut({ scope: "local" });
                            posthog.reset();
                            router.push("/login");
                        }}
                    >
                        <span className="min-w-0 flex-1 truncate">Log out</span>
                        <LogOut className="ml-auto size-4 shrink-0" />
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {organization && canUpgrade && (upgradePreload || upgradeOpen) && (
                <UpgradeDialog
                    open={upgradeOpen}
                    onOpenChange={setUpgradeOpen}
                    orgId={organization.id}
                    orgSlug={organization.slug}
                    orgName={organization.name}
                    currentTier={currentTier}
                    recommendedTier="pro"
                    checkoutMode="direct"
                    preload={upgradePreload || upgradeOpen}
                />
            )}
        </>
    );
}
