import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const CTA = () => {
    return (
        <section className="py-32 bg-background relative overflow-hidden">
            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/5 px-6 py-24 md:px-12 text-center">
                    
                    {/* Background Effects */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-foreground/10 via-transparent to-transparent opacity-50" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto">
                        <div className="mb-6 inline-flex items-center justify-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 backdrop-blur-sm">
                            <span>Start building today</span>
                        </div>

                        <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                            Ready to secure your AI?
                        </h2>
                        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                            Join engineers building safe, compliant, and production-ready AI applications with Cencori.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                            <Link href="/login">
                                <Button size="lg" className="h-14 px-8 text-base rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] w-full sm:w-auto">
                                    Get Started for Free
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="outline" size="lg" className="h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5 hover:text-foreground transition-all w-full sm:w-auto bg-transparent backdrop-blur-sm">
                                    View Documentation
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
