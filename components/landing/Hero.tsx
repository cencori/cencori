import React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { TechnicalBorder } from "./TechnicalBorder";
import { Button } from "@/components/ui/button";

export const Hero = () => {
    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-32">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-foreground/5 via-background to-background pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                
                {/* Announcement Badge */}
                <div className="mb-8 animate-appear">
                    <Link href="/changelog" className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                        <span className="mr-2">Coming Soon.</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 max-w-5xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                    The Secure Layer for <br className="hidden md:block" />
                    AI Development
                </h1>

                {/* Subheadline */}
                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-12 animate-appear [animation-delay:200ms] leading-relaxed">
                    Build, deploy, and scale your AI applications with enterprise-grade security and compliance built-in.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 animate-appear [animation-delay:300ms] mb-20">
                    <Link href="/login">
                        <Button size="lg" className="h-12 px-8 text-base rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]">
                            Start Building <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/docs">
                        <Button variant="outline" size="lg" className="h-12 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                            Read Documentation
                        </Button>
                    </Link>
                </div>

                {/* Hero Image Placeholder */}
                <div className="w-full max-w-6xl animate-appear [animation-delay:500ms] relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-foreground/20 to-foreground/5 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                    <div className="relative rounded-xl border border-foreground/10 bg-background/50 backdrop-blur-sm overflow-hidden aspect-[16/9] flex items-center justify-center">
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
                        <div className="text-muted-foreground/50 font-mono text-sm uppercase tracking-widest z-10">
                            [ Application Dashboard Placeholder ]
                        </div>
                        {/* Inner glow */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-50" />
                    </div>
                </div>
            </div>
        </section>
    );
};
