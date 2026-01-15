import React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { TechnicalBorder } from "./TechnicalBorder";
import { Button } from "@/components/ui/button";

export const Hero = () => {
    return (
        <section className="relative flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-foreground/5 via-background to-background pointer-events-none" />

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">

                {/* Announcement Badge */}
                <div className="mb-8 animate-appear">
                    <Link href="/changelog" className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                        <span className="mr-2">Try AI Gateway for free.</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                </div>

                {/* Headline */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                    The Infrastructure <span className="italic">for</span> AI Production
                </h1>

                {/* Subheadline */}
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 animate-appear [animation-delay:200ms] leading-relaxed">
                    Ship AI with built-in security, observability, and scale. One platform for everything.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 animate-appear [animation-delay:300ms]">
                    <Link href="/login">
                        <Button size="default" className="h-10 px-6 text-sm rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]">
                            Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/docs">
                        <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                            Documentation
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
};
