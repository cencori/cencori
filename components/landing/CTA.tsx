import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CTAProps {
    isAuthenticated?: boolean;
}

export const CTA = ({ isAuthenticated = false }: CTAProps) => {
    return (
        <section className="py-16 bg-background relative overflow-hidden">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                <div className="px-6 py-12 md:px-10 text-center">
                    <div className="flex flex-col items-center max-w-2xl mx-auto">
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-foreground">
                            Your AI is live. Do you know what&apos;s happening inside it?
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-lg leading-relaxed">
                            Add Cencori to your first project in minutes. Security, visibility, and cost control from your very first request.
                        </p>

                        <div className="flex flex-row gap-2 justify-center">
                            <Link href={isAuthenticated ? "/dashboard/organizations" : "/login"}>
                                <Button size="default" className="h-8 px-4 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-all">
                                    {isAuthenticated ? "Go to Dashboard" : "Get Started Free"}
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="outline" size="default" className="h-8 px-4 text-xs font-medium rounded-md border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                    Documentation
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
