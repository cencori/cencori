"use client";

import React, { useState } from "react";
import { useTheme } from "next-themes";

// Provider domains for Brandfetch CDN
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
            className="h-5 max-w-[80px] w-auto object-contain opacity-40 hover:opacity-100 transition-opacity"
            onError={() => setHasError(true)}
        />
    );
};

export const SocialProof = () => {
    const { resolvedTheme } = useTheme();
    const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "";
    const theme = resolvedTheme || "dark";

    return (
        <section className="py-8 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <p className="text-center text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mb-6">
                    Works with your favorite AI providers
                </p>

                {/* Static logo row - no animation, no loop issues */}
                <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap">
                    {providers.map((provider, index) => (
                        <div key={index} className="flex-shrink-0">
                            <ProviderLogo provider={provider} clientId={clientId} theme={theme} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
