"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

type Tier = "free" | "pro" | "team" | "enterprise";
type BillingPeriod = "monthly" | "annual";
type ScanTier = "scan_free" | "scan" | "scan_team";
type PaidScanTier = Exclude<ScanTier, "scan_free">;
type MatrixValue = boolean | string;
const SCAN_APP_ORIGIN = "https://scan.cencori.com";
const SCAN_SIGNUP_URL = `${SCAN_APP_ORIGIN}/signup?redirect=${encodeURIComponent(SCAN_APP_ORIGIN)}`;

const tiers: Array<{
    name: Tier;
    displayName: string;
    description: string;
    price: { monthly: number | string; annual: number | string };
    features: string[];
    highlighted?: boolean;
    cta: string;
    ctaVariant?: "default" | "outline" | "ghost";
}> = [
    {
        name: "free",
        displayName: "Free",
        description: "Perfect for side projects and experimentation.",
        price: { monthly: 0, annual: 0 },
        features: [
            "Unlimited requests",
            "100+ AI models",
            "Streaming & tool calling",
            "Bring your own keys (BYOK)",
            "API keys & playground",
            "Community support",
        ],
        cta: "Start Free",
        ctaVariant: "outline",
    },
    {
        name: "pro",
        displayName: "Pro",
        description: "For professional developers and small teams.",
        price: { monthly: 49, annual: 490 },
        features: [
            "Up to 3 team members",
            "Security scanning",
            "Failover & routing",
            "Semantic cache",
            "Request logs & analytics",
            "Prompt registry",
            "Priority support (email)",
        ],
        highlighted: true,
        cta: "Get Started",
    },
    {
        name: "team",
        displayName: "Team",
        description: "For growing teams needing collaboration.",
        price: { monthly: 149, annual: 1490 },
        features: [
            "Everything in Pro",
            "Up to 10 team members",
            "Custom providers",
            "Webhooks",
            "Geo analytics",
            "Failover analytics",
            "Priority support (chat)",
        ],
        cta: "Get Started",
        ctaVariant: "outline",
    },
    {
        name: "enterprise",
        displayName: "Enterprise",
        description: "For large organizations with custom needs.",
        price: { monthly: "Custom", annual: "Custom" },
        features: [
            "Everything in Team",
            "SSO & SAML",
            "Unlimited members",
            "Dedicated support",
            "SLA guarantees",
            "Custom integrations",
        ],
        cta: "Contact Sales",
        ctaVariant: "outline",
    },
];

const scanAddons: Array<{
    name: ScanTier;
    displayName: string;
    price: number;
    description: string;
    features: string[];
    cta: string;
}> = [
    {
        name: "scan_free",
        displayName: "Scan Free",
        price: 0,
        description: "Start scanning at no cost with limited usage.",
        features: [
            "Up to 5 imported projects",
            "2 scans per project",
            "Scan dashboard access",
            "Upgrade anytime to unlimited",
        ],
        cta: "Start Free",
    },
    {
        name: "scan",
        displayName: "Scan",
        price: 9,
        description: "Unlimited standalone scan access for individual engineers.",
        features: [
            "Unlimited repository imports",
            "Unlimited scans per project",
            "AI fix generation",
            "Fix PR workflow",
        ],
        cta: "Start Scan",
    },
    {
        name: "scan_team",
        displayName: "Scan Teams",
        price: 29,
        description: "Unlimited standalone scan access for teams.",
        features: [
            "Everything in Scan",
            "Team-oriented scan workflows",
            "Changelog and remediation pipeline",
            "Priority scan support",
        ],
        cta: "Start Scan Teams",
    },
];

const matrixSections: Array<{
    title: string;
    description: string;
    rows: Array<{
        feature: string;
        values: Record<Tier, MatrixValue>;
    }>;
}> = [
    {
        title: "AI Gateway",
        description: "inference capabilities.",
        rows: [
            {
                feature: "100+ AI models (chat, image, audio, embeddings)",
                values: { free: true, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Streaming & tool calling",
                values: { free: true, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Structured output",
                values: { free: true, pro: true, team: true, enterprise: true },
            },
        ],
    },
    {
        title: "Infrastructure",
        description: "Provider routing and reliability.",
        rows: [
            {
                feature: "Bring your own provider keys (BYOK)",
                values: { free: true, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Multi-provider routing",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Failover & circuit breaker",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Custom providers",
                values: { free: false, pro: false, team: true, enterprise: true },
            },
            {
                feature: "Semantic cache",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
        ],
    },
    {
        title: "Security",
        description: "Content safety and data protection.",
        rows: [
            {
                feature: "Jailbreak detection",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "PII masking & redaction",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Custom data rules",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Output scanning",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Security incidents & audit trails",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
        ],
    },
    {
        title: "Observability",
        description: "Monitoring and analytics.",
        rows: [
            {
                feature: "Request logs",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Analytics dashboard",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Cost tracking",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Geo analytics",
                values: { free: false, pro: false, team: true, enterprise: true },
            },
            {
                feature: "Failover analytics",
                values: { free: false, pro: false, team: true, enterprise: true },
            },
        ],
    },
    {
        title: "Developer Tools",
        description: "APIs and integrations.",
        rows: [
            {
                feature: "API keys (scoped)",
                values: { free: true, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Playground",
                values: { free: true, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Prompt registry",
                values: { free: false, pro: true, team: true, enterprise: true },
            },
            {
                feature: "Webhooks",
                values: { free: false, pro: false, team: true, enterprise: true },
            },
        ],
    },
    {
        title: "Platform",
        description: "Collaboration and support.",
        rows: [
            {
                feature: "Projects",
                values: { free: "1", pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" },
            },
            {
                feature: "Team members",
                values: { free: "1", pro: "Up to 3", team: "Up to 10", enterprise: "Unlimited" },
            },
            {
                feature: "Support",
                values: {
                    free: "Community",
                    pro: "Priority (email)",
                    team: "Priority (4hr)",
                    enterprise: "Dedicated",
                },
            },
            {
                feature: "SSO & SAML",
                values: { free: false, pro: false, team: false, enterprise: true },
            },
            {
                feature: "SLA guarantees",
                values: { free: false, pro: false, team: false, enterprise: true },
            },
        ],
    },
];

function renderMatrixValue(value: MatrixValue) {
    if (value === true) {
        return <Check className="mx-auto h-4 w-4 text-foreground" aria-hidden="true" />;
    }
    if (value === false) {
        return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    }
    return <span className="text-xs md:text-sm text-foreground/90">{value}</span>;
}

function getDisplayPrice(tier: (typeof tiers)[number], billingPeriod: BillingPeriod) {
    if (typeof tier.price.monthly !== "number") {
        return tier.price.monthly;
    }
    if (billingPeriod === "annual" && tier.price.monthly > 0) {
        return Math.round(Number(tier.price.annual) / 12);
    }
    return tier.price.monthly;
}

function getSubPriceLabel(tier: (typeof tiers)[number], billingPeriod: BillingPeriod) {
    if (typeof tier.price.monthly !== "number") {
        return "Talk to sales";
    }
    if (tier.price.monthly === 0) {
        return "Free + you pay for AI usage";
    }
    if (billingPeriod === "annual") {
        return `Billed ${tier.price.annual}/year`;
    }
    return "Platform subscription";
}

function isPaidScanTier(tier: ScanTier): tier is PaidScanTier {
    return tier === "scan" || tier === "scan_team";
}

export function Pricing() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
    const [orgId, setOrgId] = useState<string | null>(null);
    const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
    const [loadingScanTier, setLoadingScanTier] = useState<ScanTier | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
            if (session?.user) {
                const { data: membership } = await supabase
                    .from("organization_members")
                    .select("organization_id")
                    .eq("user_id", session.user.id)
                    .limit(1)
                    .single();
                if (membership) {
                    setOrgId(membership.organization_id);
                }
            }
        };
        checkAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (_event: string, session: { user: { user_metadata?: Record<string, unknown>; email?: string; id?: string } } | null) => {
                setIsAuthenticated(!!session);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleCTA = async (tier: Tier) => {
        if (tier === "enterprise") {
            window.location.href = "/contact";
            return;
        }
        if (!isAuthenticated) {
            window.location.href = "/signup";
            return;
        }
        if (tier === "free") {
            window.location.href = "/dashboard/organizations";
            return;
        }
        if (!orgId) {
            window.location.href = "/dashboard/organizations";
            return;
        }
        setLoadingTier(tier);
        try {
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tier, cycle: billingPeriod, orgId }),
            });
            const data = await res.json();
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                window.location.href = "/dashboard/organizations";
            }
        } catch {
            window.location.href = "/dashboard/organizations";
        } finally {
            setLoadingTier(null);
        }
    };

    const handleScanCTA = async (tier: ScanTier) => {
        if (!isAuthenticated) {
            window.location.href = SCAN_SIGNUP_URL;
            return;
        }

        if (tier === "scan_free") {
            window.location.href = SCAN_APP_ORIGIN;
            return;
        }

        setLoadingScanTier(tier);
        try {
            const res = await fetch("/api/billing/scan/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tier: isPaidScanTier(tier) ? tier : "scan" }),
            });
            const data = await res.json().catch(() => ({}));
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                window.location.href = SCAN_APP_ORIGIN;
            }
        } catch {
            window.location.href = SCAN_APP_ORIGIN;
        } finally {
            setLoadingScanTier(null);
        }
    };

    return (
        <section className="relative overflow-hidden bg-background">
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)",
                    backgroundSize: "68px 68px",
                }}
            />

            <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-24">
                <div className="mx-auto mb-12 max-w-3xl text-center">
                    <Badge variant="outline" className="mb-4 rounded-full border-border/60 px-4 py-1 text-xs">
                        Pricing
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                        Pick a plan to power your AI applications.
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
                        Free tier includes unlimited requests. Pro unlocks security scanning,
                        failover, caching, and observability. You pay providers directly for AI usage.
                    </p>
                </div>

                <div className="mb-10 flex justify-center">
                    <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/90 p-1 backdrop-blur-sm">
                        <button
                            type="button"
                            onClick={() => setBillingPeriod("monthly")}
                            className={cn(
                                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                                billingPeriod === "monthly"
                                    ? "bg-foreground text-background"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            onClick={() => setBillingPeriod("annual")}
                            className={cn(
                                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                                billingPeriod === "annual"
                                    ? "bg-foreground text-background"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Annual
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border/50 bg-background/95 backdrop-blur-sm">
                    <div className="grid border-b border-border/50 md:grid-cols-2 xl:grid-cols-4">
                        {tiers.map((tier, index) => {
                            const displayPrice = getDisplayPrice(tier, billingPeriod);
                            return (
                                <article
                                    key={tier.name}
                                    className={cn(
                                        "relative flex flex-col gap-4 p-6",
                                        index < tiers.length - 1 && "border-b border-border/50 xl:border-b-0 xl:border-r",
                                        index === 1 && "bg-muted/20"
                                    )}
                                >
                                    {tier.highlighted && (
                                        <Badge className="w-fit rounded-full border-0 bg-foreground px-2 py-0.5 text-[10px] text-background">
                                            Popular
                                        </Badge>
                                    )}
                                    <div>
                                        <p className="text-xl font-semibold">{tier.displayName}</p>
                                        <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                                    </div>

                                    <div>
                                        <p className="text-3xl font-semibold tracking-tight">
                                            {typeof displayPrice === "number" ? `$${displayPrice}` : displayPrice}
                                            {typeof displayPrice === "number" && <span className="text-base text-muted-foreground"> /mo</span>}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">{getSubPriceLabel(tier, billingPeriod)}</p>
                                    </div>

                                    <ul className="space-y-2">
                                        {tier.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        className="mt-auto w-full rounded-full text-xs"
                                        variant={tier.ctaVariant || "default"}
                                        onClick={() => handleCTA(tier.name)}
                                        disabled={loadingTier === tier.name}
                                    >
                                        {loadingTier === tier.name ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                                Redirecting...
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5">
                                                {tier.cta}
                                                <ArrowRight className="h-3 w-3" />
                                            </span>
                                        )}
                                    </Button>
                                </article>
                            );
                        })}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/15">
                                    <th className="w-[30%] px-5 py-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Features
                                    </th>
                                    {tiers.map((tier) => (
                                        <th key={tier.name} className="w-[17.5%] px-5 py-4 align-top">
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold">{tier.displayName}</p>
                                                <p className="text-xs text-muted-foreground">Platform subscription</p>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrixSections.map((section) => (
                                    <React.Fragment key={section.title}>
                                        <tr className="border-y border-border/50 bg-muted/10">
                                            <td colSpan={5} className="px-5 py-4">
                                                <p className="text-sm font-semibold">{section.title}</p>
                                                <p className="text-xs text-muted-foreground">{section.description}</p>
                                            </td>
                                        </tr>
                                        {section.rows.map((row) => (
                                            <tr key={row.feature} className="border-b border-border/40">
                                                <td className="px-5 py-3 text-sm text-foreground">{row.feature}</td>
                                                {tiers.map((tier) => (
                                                    <td key={tier.name} className="px-5 py-3 text-center">
                                                        {renderMatrixValue(row.values[tier.name])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-8 overflow-hidden rounded-2xl border border-border/50 bg-background/95">
                    <div className="border-b border-border/50 px-5 py-4">
                        <p className="text-sm font-semibold">Scan Add-on</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Standalone scan plans for users who only need scan workflows. Platform Pro, Team, and Enterprise
                            plans include full scan access automatically. Free scan usage includes 5 imported projects and 2 scans per project.
                        </p>
                    </div>
                    <div className="grid gap-0 border-border/50 md:grid-cols-3">
                        {scanAddons.map((addon, index) => (
                            <article
                                key={addon.name}
                                className={cn(
                                    "flex flex-col gap-4 p-5",
                                    index < scanAddons.length - 1 && "border-b border-border/50 md:border-b-0 md:border-r"
                                )}
                            >
                                <div>
                                    <p className="text-base font-semibold">{addon.displayName}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{addon.description}</p>
                                </div>

                                <p className="text-3xl font-semibold tracking-tight">
                                    {addon.price === 0 ? "Free" : `$${addon.price}`}
                                    <span className="text-base text-muted-foreground">{addon.price === 0 ? "" : " /mo"}</span>
                                </p>

                                <ul className="space-y-2">
                                    {addon.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className="mt-auto w-full rounded-full text-xs"
                                    variant={addon.name === "scan_team" ? "default" : "outline"}
                                    onClick={() => handleScanCTA(addon.name)}
                                    disabled={loadingScanTier === addon.name}
                                >
                                    {loadingScanTier === addon.name ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                            Redirecting...
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5">
                                            {addon.cta}
                                            <ArrowRight className="h-3 w-3" />
                                        </span>
                                    )}
                                </Button>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="mt-8 rounded-xl border border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground">
                    <p>
                        Cencori charges a platform subscription (not per-request). You pay the provider directly
                        for AI usage through your own API keys. Free tier includes unlimited requests with basic features.
                        Pro, Team, and Enterprise unlock security scanning, failover, caching, observability, and more.
                        Scan add-on available separately ($9/mo individual / $29/mo teams).
                    </p>
                </div>
            </div>
        </section>
    );
}
