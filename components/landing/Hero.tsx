import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
    isAuthenticated?: boolean;
}

export const Hero = ({ isAuthenticated = false }: HeroProps) => {
    return (
        <section className="bg-background pt-28 sm:pt-40 pb-16 sm:pb-20">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="mx-auto flex max-w-4xl flex-col items-center pt-2 text-center">
                        <Link
                            href="/changelog/ai-gateway-launch"
                            className="group mb-8 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-foreground animate-appear"
                        >
                            <span>Introducing AI Gateway</span>
                            <ArrowRight className="size-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                        </Link>

                        <h1 className="mb-8 max-w-3xl text-[2.75rem] font-semibold leading-[1.03] tracking-[-0.04em] animate-appear sm:text-[3.5rem] lg:text-[4.25rem]">
                            The backbone of
                            <br />
                            <span className="text-muted-foreground">Intelligence.</span>
                        </h1>

                        <p className="mb-10 max-w-[38rem] text-base leading-[1.7] text-muted-foreground animate-appear [animation-delay:200ms]">
                            The Infrastructure the next generation of intelligent products is built on. Everything you need to build intelligent products, in one place.
                        </p>

                        <div className="mb-10 flex flex-wrap items-center justify-center gap-3 animate-appear [animation-delay:300ms]">
                            <Link href={isAuthenticated ? "/dashboard/organizations" : "/login"}>
                                <Button size="default" className="h-8 px-4 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-all">
                                    {isAuthenticated ? "Go to Dashboard" : "Get Started Free"}
                                </Button>
                            </Link>
                            <Link href="/contact/sales">
                                <Button variant="outline" size="default" className="h-8 px-4 text-xs font-medium rounded-md border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                    Book a Demo
                                </Button>
                            </Link>
                        </div>
                </div>
            </div>
        </section>
    );
};
