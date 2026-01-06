import React from "react";
import { InfrastructureTabs } from "./InfrastructureTabs";

export const Features = () => {
    return (
        <section className="py-20 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center text-center mb-12">
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                        Everything you need to{" "}
                        <span className="text-muted-foreground">ship AI</span>
                    </h2>
                    <p className="text-base text-muted-foreground max-w-xl">
                        A complete platform to build, secure, and scale AI features.
                        Connect once, use any provider.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto">
                    <InfrastructureTabs />
                </div>
            </div>
        </section>
    );
};
