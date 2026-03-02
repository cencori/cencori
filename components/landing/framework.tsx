"use client";

import React from "react";
import { LangChain } from "@lobehub/icons";
import {
    NextjsLogo,
    ViteLogo,
    PythonLogo,
    ReactLogo,
    SvelteLogo,
    VueLogo
} from "@/components/icons/BrandIcons";

const frameworkIcons = [
    { name: "Next.js", icon: <NextjsLogo className="h-7 w-7 text-foreground" /> },
    { name: "Vite", icon: <ViteLogo className="h-7 w-7" /> },
    { name: "React", icon: <ReactLogo className="h-7 w-7" /> },
    { name: "Svelte", icon: <SvelteLogo className="h-7 w-7" /> },
    { name: "Vue", icon: <VueLogo className="h-7 w-7" /> },
    { name: "Python", icon: <PythonLogo className="h-7 w-7" /> },
    { name: "LangChain", icon: <LangChain.Combine size={28} /> },
];

export function Framework() {
    return (
        <section className="py-14 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center text-center mb-8">
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                        Works with your{" "}
                        <span className="text-muted-foreground">stack</span>
                    </h2>
                    <p className="text-base text-muted-foreground max-w-xl">
                        Drop in Cencori without changing your framework.
                    </p>
                </div>

                <ul className="flex flex-wrap items-center justify-center gap-7 md:gap-10">
                    {frameworkIcons.map((framework) => (
                        <li
                            key={framework.name}
                            className="text-muted-foreground/70 hover:text-foreground transition-colors"
                            title={framework.name}
                            aria-label={framework.name}
                        >
                            {framework.icon}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
