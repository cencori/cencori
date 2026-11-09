"use client";
import { browserAuth } from "@/lib/auth/browser-auth";

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { CENCORI_PAID_PLANS } from "@/lib/billing/plans";
import { CurrencyToggle } from "@/components/dashboard/CurrencyToggle";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import BotIcon from "@hugeicons/core-free-icons/BotIcon";
import BrainIcon from "@hugeicons/core-free-icons/BrainIcon";
import SecurityCheckIcon from "@hugeicons/core-free-icons/SecurityCheckIcon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Tier = "free" | "pro" | "enterprise";
type Currency = "USD" | "NGN";
type MatrixValue = boolean | string;

const tiers: Array<{
    name: Tier;
    displayName: string;
    description: string;
    price: Record<Currency, { monthly: number | string; annual: number | string }>;
    features: string[];
    highlighted?: boolean;
    cta: string;
    ctaVariant?: "default" | "outline" | "ghost";
}> = [
    {
        name: "free",
        displayName: "Free",
        description: "Use every model and start building agents. Pay only for what you use.",
        price: {
            USD: { monthly: 0, annual: 0 },
            NGN: { monthly: 0, annual: 0 }
        },
        features: [
            "100+ AI models, pay as you go",
            "Bring your own provider keys",
            "1 agent",
            "5 knowledge bases",
            "1,000 memories per project",
            "1 project",
            "Just you (no team members)",
            "Community support",
        ],
        cta: "Start building",
        ctaVariant: "outline",
    },
    {
        name: "pro",
        displayName: "Pro",
        description: "For teams and businesses running agents in production.",
        price: {
            USD: {
                monthly: CENCORI_PAID_PLANS.pro.prices.month / 100,
                annual: CENCORI_PAID_PLANS.pro.prices.year / 100,
            },
            NGN: {
                monthly: CENCORI_PAID_PLANS.pro.ngnPrices!.month,
                annual: CENCORI_PAID_PLANS.pro.ngnPrices!.year,
            },
        },
        features: [
            "Everything in Free",
            ...CENCORI_PAID_PLANS.pro.features,
        ],
        highlighted: true,
        cta: "Get Pro",
    },
    {
        name: "enterprise",
        displayName: "Enterprise",
        description: "For organizations that need custom limits, security and support.",
        price: {
            USD: { monthly: "Custom", annual: "Custom" },
            NGN: { monthly: "Custom", annual: "Custom" }
        },
        features: [
            "Everything in Pro",
            "Custom agent and memory limits",
            "Unlimited memory",
            "Enforced SSO (SAML)",
            "Governance controls & audit exports",
            "Volume pricing on usage",
            "Dedicated support & SLAs",
        ],
        cta: "Contact sales",
        ctaVariant: "outline",
    },
];

// Every value here mirrors lib/entitlements.ts (TIER_FEATURES,
// EMBEDDED_LIMITS, MEMORY_QUOTA, MEMORY_OPS_QUOTA, LOG_RETENTION_RANGE).
// Change both together.
const matrixSections: Array<{
    title: string;
    description: string;
    icon: IconSvgElement;
    rows: Array<{
        feature: string;
        values: Record<Tier, MatrixValue>;
    }>;
}> = [
    {
        title: "Agents",
        icon: BotIcon,
        description: "Build agents, and embed them in your own product.",
        rows: [
            {
                feature: "Agents",
                values: { free: "1", pro: "10", enterprise: "Custom" },
            },
            {
                feature: "Agents running at once",
                values: { free: "1", pro: "10", enterprise: "Custom" },
            },
            {
                feature: "Skills",
                values: { free: "20", pro: "200", enterprise: "Custom" },
            },
            {
                feature: "Knowledge bases",
                values: { free: "5", pro: "100", enterprise: "Custom" },
            },
            {
                feature: "Customers (per project)",
                values: { free: "5", pro: "100", enterprise: "Custom" },
            },
        ],
    },
    {
        title: "Memory",
        icon: BrainIcon,
        description: "Long-term memory for agents and apps.",
        rows: [
            {
                feature: "Memories per project",
                values: { free: "1,000", pro: "50,000", enterprise: "Unlimited" },
            },
            {
                feature: "Memory lookups per month",
                values: { free: "2,000", pro: "50,000", enterprise: "Unlimited" },
            },
            {
                feature: "Memory saves per month",
                values: { free: "1,000", pro: "5,000", enterprise: "Unlimited" },
            },
        ],
    },
    {
        title: "Security",
        icon: SecurityCheckIcon,
        description: "Protect your users and data.",
        rows: [
            {
                feature: "PII masking & redaction",
                values: { free: false, pro: true, enterprise: true },
            },
            {
                feature: "Jailbreak detection",
                values: { free: false, pro: true, enterprise: true },
            },
            {
                feature: "Output scanning",
                values: { free: false, pro: true, enterprise: true },
            },
            {
                feature: "Audit log",
                values: { free: false, pro: true, enterprise: true },
            },
            {
                feature: "Governance controls",
                values: { free: false, pro: false, enterprise: true },
            },
            {
                feature: "Audit exports",
                values: { free: false, pro: false, enterprise: true },
            },
        ],
    },
    {
        title: "Platform",
        icon: Layers01Icon,
        description: "Logs, projects and support.",
        rows: [
            {
                feature: "Request log history",
                values: { free: "7 days", pro: "30 days", enterprise: "All time" },
            },
            {
                feature: "Log export",
                values: { free: "Last 7 days", pro: "Last 30 days", enterprise: "All time" },
            },
            {
                feature: "Usage history",
                values: { free: "7 days", pro: "30 days", enterprise: "All time" },
            },
            {
                feature: "Organizations",
                values: { free: "1 per person", pro: "Unlimited", enterprise: "Unlimited" },
            },
            {
                feature: "Projects",
                values: { free: "1", pro: "Unlimited", enterprise: "Unlimited" },
            },
            {
                feature: "Team members",
                values: { free: "Just you", pro: "Unlimited", enterprise: "Unlimited" },
            },
            {
                feature: "Enforced SSO (SAML)",
                values: { free: false, pro: false, enterprise: true },
            },
            {
                feature: "Support",
                values: { free: "Community", pro: "Priority", enterprise: "Dedicated + SLA" },
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

function getDisplayPrice(tier: (typeof tiers)[number], currency: Currency) {
    return tier.price[currency].monthly;
}

function getSubPriceLabel(tier: (typeof tiers)[number], currency: Currency) {
    const monthly = tier.price[currency].monthly;
    if (typeof monthly !== "number") return "Talk to sales";
    if (monthly === 0) return "Free forever. AI usage from credits";
    return "Billed monthly. AI usage from credits";
}

export function Pricing() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    // Same USD/NGN choice as the dashboard: remembered per browser, naira
    // by default in Nigeria (country read in app/pricing/layout.tsx).
    const { currency } = useDisplayCurrency();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
    // Phones show one plan column at a time.
    const [mobilePlan, setMobilePlan] = useState<Tier>("pro");

    useEffect(() => {
        const checkAuth = async () => {
            const {
                data: { session },
            } = await browserAuth.getSession();
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

        const { data: authListener } = browserAuth.onAuthStateChange(
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
            window.location.href = "/dashboard";
            return;
        }
        if (!orgId) {
            window.location.href = "/dashboard";
            return;
        }
        setLoadingTier(tier);
        try {
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tier, interval: 'month', orgId }),
            });
            const data = await res.json();
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                window.location.href = "/dashboard";
            }
        } catch {
            window.location.href = "/dashboard";
        } finally {
            setLoadingTier(null);
        }
    };

    return (
        <section className="relative overflow-x-clip bg-background">
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)",
                    backgroundSize: "68px 68px",
                }}
            />

            <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-24">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                        Build. Scale. Deploy.
                    </h1>
                    <CurrencyToggle />
                </div>

                <div className="overflow-clip border border-border/50 bg-background/95 backdrop-blur-sm xl:overflow-visible">
                    <div className="grid md:grid-cols-3">
                        {tiers.map((tier, index) => {
                            const displayPrice = getDisplayPrice(tier, currency);
                            return (
                                <article
                                    key={tier.name}
                                    className={cn(
                                        "relative flex flex-col gap-4 p-6",
                                        index < tiers.length - 1 && "border-b border-border/50 md:border-b-0 md:border-r",
                                        index === 1 && "bg-muted/20"
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xl font-semibold">{tier.displayName}</p>
                                            {tier.highlighted && (
                                                <Badge className="rounded-[4px] border-0 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                                                    Popular
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                                    </div>

                                    <div>
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                            <p className="text-3xl font-semibold tracking-tight">
                                                {typeof displayPrice === "number" ? formatCurrency(displayPrice, currency, { maximumFractionDigits: 0 }) : displayPrice}
                                                {typeof displayPrice === "number" && <span className="text-base text-muted-foreground"> /mo</span>}
                                            </p>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">{getSubPriceLabel(tier, currency)}</p>
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
                                                <Spinner className="h-3 w-3" />
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

                    {/* The table always fits the screen, so the plan header sticks
                        under the site nav (72px up to 900px wide, 80px above) at every width. On phones it
                        shows one plan at a time, picked from a dropdown. */}
                    <div>
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-muted/15">
                                    <th className="w-[55%] px-4 py-4 text-xs font-medium uppercase tracking-wide text-muted-foreground sticky top-[72px] z-30 min-[901px]:top-20 bg-background md:w-[30%] md:px-5 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border/50 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/50">
                                        Features
                                    </th>
                                    {tiers.map((tier) => (
                                        <th key={tier.name} className={cn("px-4 py-3 align-middle text-center sticky top-[72px] z-30 min-[901px]:top-20 bg-background md:table-cell md:w-[17.5%] md:px-5 md:py-4 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border/50 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/50", tier.name !== mobilePlan && "hidden")}>
                                            <p className="hidden text-sm font-bold md:block">{tier.displayName}</p>
                                            {tier.name === mobilePlan && (
                                            <div className="flex justify-center md:hidden">
                                                <Select value={mobilePlan} onValueChange={(value) => setMobilePlan(value as Tier)}>
                                                    <SelectTrigger aria-label="Plan" className="h-8 w-auto gap-1.5 rounded-full border-0 bg-muted/60 pl-3.5 pr-2.5 text-sm font-bold shadow-none">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent align="end">
                                                        {tiers.map((option) => (
                                                            <SelectItem key={option.name} value={option.name}>{option.displayName}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrixSections.map((section) => (
                                    <React.Fragment key={section.title}>
                                        <tr className="border-b border-border/50 bg-muted/40">
                                            <td colSpan={tiers.length + 1} className="px-4 py-4 md:px-5">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background">
                                                        <HugeiconsIcon icon={section.icon} size={20} strokeWidth={1.6} className="text-foreground" />
                                                    </span>
                                                    <div>
                                                        <p className="text-base font-bold">{section.title}</p>
                                                        <p className="text-xs text-muted-foreground">{section.description}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {section.rows.map((row) => (
                                            <tr key={row.feature} className="border-b border-border/40">
                                                <td className="px-4 py-3 text-sm text-foreground md:px-5">{row.feature}</td>
                                                {tiers.map((tier) => (
                                                    <td key={tier.name} className={cn("px-4 py-3 text-center md:table-cell md:px-5", tier.name !== mobilePlan && "hidden")}>
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

            </div>
        </section>
    );
}
