"use client";

import React, { useState } from "react";
import { useTheme } from "next-themes";

// Provider domains for Brandfetch CDN (order matters for visual start position)
const providers = [
    { name: "Cohere", domain: "cohere.com" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "OpenAI", domain: "openai.com" },
    { name: "Google", domain: "google.com" },
    { name: "AWS", domain: "aws.amazon.com" },
    { name: "Perplexity", domain: "perplexity.ai" },
];

const ProviderLogo = ({
    provider,
    clientId,
    theme
}: {
    provider: { name: string; domain: string };
    clientId: string;
    theme: string;
}) => {
    const [hasError, setHasError] = useState(false);

    // Use light logos on dark backgrounds, dark logos on light backgrounds
    const logoTheme = theme === "dark" ? "light" : "dark";

    if (hasError) {
        return (
            <span className="text-sm font-medium text-muted-foreground/60 whitespace-nowrap">
                {provider.name}
            </span>
        );
    }

    return (
        <img
            src={`https://cdn.brandfetch.io/${provider.domain}/w/256/h/48/theme/${logoTheme}/logo?c=${clientId}`}
            alt={provider.name}
            className="h-5 max-w-[100px] w-auto object-contain opacity-50 hover:opacity-100 transition-opacity"
            onError={() => setHasError(true)}
        />
    );
};

export const SocialProof = () => {
    const { resolvedTheme } = useTheme();
    const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "";
    const theme = resolvedTheme || "dark";

    // Create 40 copies - by the time it loops, no one is watching anymore!
    const duplicatedProviders = Array.from({ length: 40 }, () => providers).flat();

    return (
        <section className="py-10 bg-background">
            <div className="container mx-auto px-4 md:px-6 mb-6">
                <p className="text-center text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
                    Works with your favorite AI providers
                </p>
            </div>

            {/* Constrained width container with overflow hidden and fade mask */}
            <div
                className="max-w-xs sm:max-w-xl md:max-w-3xl mx-auto overflow-hidden"
                style={{
                    maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
                    WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
                }}
            >
                {/* Scrolling track */}
                <div className="flex items-center gap-14 animate-marquee">
                    {duplicatedProviders.map((provider, index) => (
                        <div
                            key={index}
                            className="flex-shrink-0"
                        >
                            <ProviderLogo provider={provider} clientId={clientId} theme={theme} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
