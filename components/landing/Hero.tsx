import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Terminal, Activity } from "lucide-react";
import { TechnicalBorder } from "./TechnicalBorder";
import { Button } from "@/components/ui/button";

export const Hero = () => {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden border-b border-border/40 bg-background">
            {/* Technical Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            {/* Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-foreground/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">

                {/* Badge */}
                <div className="mb-8 animate-appear">
                    <TechnicalBorder className="inline-flex" cornerSize={8}>
                        <div className="px-4 py-1.5 text-xs font-mono font-medium tracking-wider uppercase flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            System Operational
                        </div>
                    </TechnicalBorder>
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 max-w-5xl animate-appear [animation-delay:100ms]">
                    The Secure Layer for <br className="hidden md:block" />
                    <span className="relative inline-block">
                        <span className="relative z-10">AI Development</span>
                        <span className="absolute bottom-2 left-0 w-full h-3 bg-foreground/10 -z-0" />
                    </span>
                </h1>

                {/* Subheadline */}
                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-10 animate-appear [animation-delay:200ms] leading-relaxed">
                    Build with AI. Deploy with confidence.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 animate-appear [animation-delay:300ms]">
                    <Link href="/login">
                        <Button size="lg" className="h-14 px-8 text-base rounded-none border-2 border-foreground bg-foreground text-background hover:bg-background hover:text-foreground transition-all cursor-pointer duration-300">
                            Start Building
                        </Button>
                    </Link>
                    <Link href="/docs">
                        <Button variant="outline" size="lg" className="h-14 px-8 text-base rounded-none border-2 hover:bg-foreground/5 transition-all duration-300 cursor-pointer">
                            Read Docs
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
};
