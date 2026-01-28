import React from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

const pricingTiers = [
    {
        name: "Free",
        price: "$0",
        description: "Get started with AI",
        features: [
            { text: "Gemini models only", included: true },
            { text: "1K requests/month", included: true },
            { text: "Basic analytics", included: true },
            { text: "Community support", included: true },
            { text: "Multi-provider", included: false },
            { text: "Advanced security", included: false },
        ],
    },
    {
        name: "Pro",
        price: "$49",
        period: "/month",
        description: "For growing teams",
        popular: true,
        features: [
            { text: "All providers", included: true },
            { text: "100K requests/month", included: true },
            { text: "Advanced analytics", included: true },
            { text: "Email support", included: true },
            { text: "PII detection", included: true },
            { text: "Prompt injection protection", included: true },
        ],
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "For scale",
        features: [
            { text: "Unlimited requests", included: true },
            { text: "Custom integrations", included: true },
            { text: "Dedicated support", included: true },
            { text: "SLA guarantees", included: true },
            { text: "SOC2 compliance", included: true },
            { text: "Custom security rules", included: true },
        ],
    },
];

const unitEconomics = [
    { label: "Avg Revenue/Customer", value: "$127/mo" },
    { label: "Gross Margin", value: "85%" },
    { label: "CAC Payback", value: "3 months" },
    { label: "Net Revenue Retention", value: "125%" },
];

export function BusinessModelSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    Business Model
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    Simple pricing.{" "}
                    <span className="text-muted-foreground">Transparent costs.</span>
                </h2>
            </div>

            {/* Pricing Grid */}
            <div className="flex-1 grid grid-cols-3 gap-3">
                {pricingTiers.map((tier, index) => (
                    <div
                        key={index}
                        className={`p-4 rounded-xl border ${tier.popular
                                ? "border-emerald-500/50 bg-emerald-500/5 relative"
                                : "border-border/50 bg-card"
                            }`}
                    >
                        {tier.popular && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-medium bg-emerald-500 text-white rounded-full">
                                Most Popular
                            </span>
                        )}
                        <div className="mb-3">
                            <h3 className="font-semibold text-sm">{tier.name}</h3>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-bold">{tier.price}</span>
                                {tier.period && (
                                    <span className="text-xs text-muted-foreground">
                                        {tier.period}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {tier.description}
                            </p>
                        </div>
                        <ul className="space-y-1.5">
                            {tier.features.map((feature, fIndex) => (
                                <li
                                    key={fIndex}
                                    className="flex items-center gap-1.5 text-[10px]"
                                >
                                    {feature.included ? (
                                        <CheckIcon className="h-3 w-3 text-emerald-500" />
                                    ) : (
                                        <XMarkIcon className="h-3 w-3 text-muted-foreground/50" />
                                    )}
                                    <span
                                        className={
                                            feature.included ? "" : "text-muted-foreground/50"
                                        }
                                    >
                                        {feature.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Unit Economics */}
            <div className="mt-6 p-4 rounded-xl border border-border/50 bg-card">
                <h3 className="text-xs font-medium text-muted-foreground mb-3">
                    Unit Economics
                </h3>
                <div className="grid grid-cols-4 gap-4">
                    {unitEconomics.map((metric, index) => (
                        <div key={index} className="text-center">
                            <span className="text-lg font-bold text-emerald-500">
                                {metric.value}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {metric.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Revenue Model Note */}
            <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                    Credits-based + subscription hybrid model with transparent provider
                    cost pass-through
                </p>
            </div>
        </div>
    );
}
