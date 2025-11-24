import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { TechnicalBorder } from "./TechnicalBorder";

export const CTA = () => {
    return (
        <section className="py-24 bg-background border-b border-border/40">
            <div className="container mx-auto px-4 md:px-6">
                <TechnicalBorder className="w-full" cornerSize={40} borderWidth={2}>
                    <div className="relative overflow-hidden bg-foreground text-background py-24 px-6 md:px-12 text-center">

                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:24px_24px]"></div>

                        <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6">
                                Ready to secure your AI?
                            </h2>
                            <p className="text-lg md:text-xl text-background/80 mb-10 max-w-2xl">
                                Join thousands of developers building safe, compliant, and production-ready AI applications with Cencori.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                                <Link href="/login">
                                    <Button size="lg" className="h-14 px-8 text-base rounded-none border-2 border-background bg-background text-foreground hover:bg-background/90 transition-all duration-300 w-full sm:w-auto">
                                        Get Started for Free
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </Link>
                                <Link href="/docs">
                                    <Button variant="outline" size="lg" className="h-14 px-8 text-base rounded-none border-2 border-background text-background hover:bg-background hover:text-foreground transition-all duration-300 w-full sm:w-auto bg-transparent">
                                        View Documentation
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </TechnicalBorder>
            </div>
        </section>
    );
};
