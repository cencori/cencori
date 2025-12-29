import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const CTA = () => {
    return (
        <section className="py-16 bg-background relative overflow-hidden">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                <div className="relative overflow-hidden rounded-xl border border-border/30 bg-foreground/[0.02] px-6 py-12 md:px-10 text-center">

                    {/* Background Effects */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-foreground/5 via-transparent to-transparent opacity-50" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
                        <div className="mb-4 inline-flex items-center justify-center rounded-full border border-border/40 bg-muted/30 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            <span>Start building today</span>
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-foreground">
                            Ready to secure your AI?
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-lg leading-relaxed">
                            Join engineers building production-ready AI applications with Cencori.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                            <Link href="/login">
                                <Button size="sm" className="h-8 px-4 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                    Get Started Free
                                    <ArrowRight className="ml-1.5 w-3 h-3" />
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="ghost" size="sm" className="h-8 px-4 text-xs rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
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

