import React from "react";
import { cn } from "@/lib/utils";

const features = [
    {
        title: "PII Detection",
        description: "Automatically detect and redact sensitive information like emails and credit cards.",
        className: "md:col-span-2 md:row-span-2",
        visual: "bg-red-500/10",
        image: "/feature-screenshot.png",
    },
    {
        title: "Real-time Analytics",
        description: "Monitor latency in real-time.",
        className: "md:col-span-2 md:row-span-1",
        visual: "bg-green-500/10",
        image: "/analytics.png",
    },
    {
        title: "Rate Limiting",
        description: "Granular, database-backed rate limiting per project or user.",
        className: "md:col-span-1 md:row-span-2",
        visual: "bg-orange-500/10",
        images: ["/development.png", "/production.png"],
    },
    {
        title: "Enterprise Compliance",
        description: "SOC2 and HIPAA ready infrastructure with full audit trails.",
        className: "md:col-span-1 md:row-span-1",
        visual: "bg-blue-500/10",
    },
    {
        title: "Low Latency",
        description: "<50ms added latency to your requests.",
        className: "md:col-span-2 md:row-span-1",
        visual: "bg-yellow-500/10",
    },
    {
        title: "Global Edge Network",
        description: "Deploy close to your users for maximum performance.",
        className: "md:col-span-1 md:row-span-1",
        visual: "bg-purple-500/10",
    },
];

export const Features = () => {
    return (
        <section className="py-32 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center text-center mb-20">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-6">
                        Everything you need to <br />
                        <span className="text-muted-foreground">secure your AI stack</span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        A complete suite of security, compliance, and observability tools built for the modern AI development workflow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[180px] gap-4 max-w-6xl mx-auto">
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className={cn(
                                "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/50 bg-background/50 p-6 hover:border-foreground/20 transition-all duration-300",
                                feature.className
                            )}
                        >
                            <div className={cn(
                                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                                "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-foreground/5 via-transparent to-transparent"
                            )} />

                            <div className="relative z-10">
                                <h3 className="text-xl font-semibold tracking-tight mb-2">{feature.title}</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed max-w-[80%]">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Image with blur effect */}
                            {feature.image && (
                                <div className="absolute inset-0 z-0">
                                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent z-10" />
                                    <img
                                        src={feature.image}
                                        alt={feature.title}
                                        className="absolute right-0 bottom-0 w-[80%] h-auto object-cover rounded-tl-xl opacity-80 group-hover:scale-105 transition-transform duration-500"
                                        style={{
                                            maskImage: "linear-gradient(to top left, black 30%, transparent 100%)",
                                            WebkitMaskImage: "linear-gradient(to top left, black 30%, transparent 100%)"
                                        }}
                                    />
                                </div>
                            )}

                            {/* Multiple Images (Stacked) */}
                            {feature.images && (
                                <div className="absolute inset-0 z-0 flex flex-col items-end justify-end p-6 gap-4">
                                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
                                    {feature.images.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={img}
                                            alt={`${feature.title} ${idx}`}
                                            className={cn(
                                                "w-[70%] h-auto object-contain rounded-lg opacity-80 group-hover:scale-105 transition-transform duration-500 relative z-0",
                                                idx === 0 ? "translate-x-4" : "translate-x-0"
                                            )}
                                            style={{
                                                maskImage: "linear-gradient(to left, black 50%, transparent 100%)",
                                                WebkitMaskImage: "linear-gradient(to left, black 50%, transparent 100%)"
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Placeholder for visual element (fallback) */}
                            {!feature.image && !feature.images && (
                                <div className={cn(
                                    "absolute bottom-0 right-0 w-1/2 h-1/2 rounded-tl-3xl opacity-20 group-hover:opacity-30 transition-opacity",
                                    feature.visual
                                )} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
