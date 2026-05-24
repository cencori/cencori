import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CTAProps {
    isAuthenticated?: boolean;
}

import { useAuth } from "@/lib/hooks/useAuth";

export const CTA = ({ isAuthenticated: providedIsAuthenticated }: CTAProps) => {
    const { isAuthenticated: hookIsAuthenticated } = useAuth();
    const isAuthenticated = providedIsAuthenticated ?? hookIsAuthenticated;

    return (
        <section className="py-16 bg-background relative overflow-hidden">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                <div className="px-6 py-12 md:px-10 text-center">
                    <div className="flex flex-col items-center max-w-2xl mx-auto">
                        <h2 className="text-3xl md:text-5xl font-heading font-black tracking-[-0.03em] mb-4 text-foreground">
                            Build Different.
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-lg leading-relaxed">
                            The intelligence era is here. The infrastructure is Cencori.
                        </p>

                        <div className="flex flex-row gap-2 justify-center">
                            <Link href={isAuthenticated ? "/dashboard/organizations" : "/login"}>
                                <Button size="default" className="h-8 px-4 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-all">
                                    {isAuthenticated ? "Go to Dashboard" : "Get Started Free"}
                                </Button>
                            </Link>
                            <Link href="/contact/sales">
                                <Button variant="outline" size="default" className="h-8 px-4 text-xs font-medium rounded-md border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                  Request a Demo
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
