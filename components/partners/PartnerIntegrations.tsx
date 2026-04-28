"use client";

import React from "react";
import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";

interface Integration {
    name: string;
    logo: React.ComponentType<any>;
}

interface PartnerIntegrationsProps {
    editors: Integration[];
    platforms: Integration[];
    frameworks: Integration[];
}

export function PartnerIntegrations({ editors, platforms, frameworks }: PartnerIntegrationsProps) {
    return (
        <div className="space-y-12">
            {/* Editors */}
            <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-6">Editors</p>
                <div className="flex flex-wrap gap-6 items-center">
                    {editors.map((editor) => (
                        <div
                            key={editor.name}
                            title={editor.name}
                            className="text-muted-foreground hover:text-foreground transition-colors duration-300"
                        >
                            <editor.logo className="h-5 w-5" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Platforms */}
            <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-6">Platforms</p>
                <div className="flex flex-wrap gap-6 items-center">
                    {platforms.map((platform) => (
                        <div
                            key={platform.name}
                            title={platform.name}
                            className="text-muted-foreground hover:text-foreground transition-colors duration-300"
                        >
                            <platform.logo className="h-4 w-4" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Frameworks */}
            <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-6">Frameworks</p>
                <div className="flex flex-wrap gap-6 items-center">
                    {frameworks.map((fw) => (
                        <div
                            key={fw.name}
                            title={fw.name}
                            className="text-muted-foreground hover:text-foreground transition-colors duration-300"
                        >
                            <fw.logo className="h-4 w-4" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

