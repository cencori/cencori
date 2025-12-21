"use client";

import React from "react";
import {
    Cohere,
    Claude,
    OpenAI,
    Google,
    Aws,
    Perplexity,
    Mistral,
    Meta,
    Ollama,
    HuggingFace,
    DeepSeek,
    Gemini
} from "@lobehub/icons";

// Expanded list of AI providers
const providers = [
    { name: "Cohere", Icon: () => <Cohere.Combine size={22} /> },
    { name: "Claude", Icon: () => <Claude.Combine size={22} /> },
    { name: "OpenAI", Icon: () => <OpenAI.Combine size={22} /> },
    { name: "Google", Icon: () => <Google.Brand size={22} /> },
    { name: "AWS", Icon: () => <Aws.Combine size={22} /> },
    { name: "Perplexity", Icon: () => <Perplexity.Combine size={22} /> },
    { name: "Mistral", Icon: () => <Mistral.Combine size={22} /> },
    { name: "Meta", Icon: () => <Meta.Combine size={22} /> },
    { name: "Ollama", Icon: () => <Ollama.Combine size={22} /> },
    { name: "HuggingFace", Icon: () => <HuggingFace.Combine size={22} /> },
    { name: "DeepSeek", Icon: () => <DeepSeek.Combine size={22} /> },
    { name: "Gemini", Icon: () => <Gemini.Combine size={22} /> },
];

// Marquee component with infinite scroll
const Marquee = ({ children, direction = "left" }: { children: React.ReactNode; direction?: "left" | "right" }) => {
    return (
        <div className="relative flex overflow-hidden select-none">
            <div
                className={`flex shrink-0 items-center gap-8 animate-marquee ${direction === "right" ? "animate-marquee-reverse" : ""}`}
                style={{ animationDuration: "40s" }}
            >
                {children}
            </div>
            <div
                className={`flex shrink-0 items-center gap-8 animate-marquee ${direction === "right" ? "animate-marquee-reverse" : ""}`}
                style={{ animationDuration: "40s" }}
                aria-hidden="true"
            >
                {children}
            </div>
        </div>
    );
};

export const SocialProof = () => {
    return (
        <section className="py-6 bg-background overflow-hidden">
            <div className="max-w-2xl mx-auto px-4 md:px-6">
                <p className="text-center text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-4">
                    Works with your favorite AI providers
                </p>

                {/* Marquee animation */}
                <div className="relative">
                    {/* Gradient masks for fade effect */}
                    <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                    <Marquee>
                        {providers.map((provider, index) => (
                            <div
                                key={index}
                                className="flex-shrink-0 opacity-30 hover:opacity-70 transition-opacity px-4"
                                title={provider.name}
                            >
                                <provider.Icon />
                            </div>
                        ))}
                    </Marquee>
                </div>
            </div>
        </section>
    );
};
