import React from "react";

const logos = [
    { name: "Acme Corp" },
    { name: "Quantum" },
    { name: "Echo Valley" },
    { name: "Nebula" },
    { name: "Vertex" },
    { name: "Horizon" },
];

export const SocialProof = () => {
    return (
        <section className="py-24 border-b border-border/40 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <p className="text-center text-sm font-medium text-muted-foreground mb-12 uppercase tracking-widest">
                    Trusted by Intelligent Teams
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center justify-items-center opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                    {logos.map((logo, index) => (
                        <div 
                            key={index} 
                            className="h-8 flex items-center justify-center w-full hover:opacity-100 transition-opacity duration-300 cursor-default"
                        >
                            {/* Placeholder Logo */}
                            <div className="flex items-center gap-2 font-bold text-xl text-foreground">
                                <div className="w-6 h-6 rounded bg-foreground/20" />
                                <span>{logo.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
