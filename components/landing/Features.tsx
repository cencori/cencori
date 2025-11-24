import React from "react";
import { TechnicalBorder } from "./TechnicalBorder";
import { Shield, Lock, Activity, BarChart3, Zap, Globe } from "lucide-react";

const features = [
    {
        title: "PII Detection",
        description: "Automatically detect and redact sensitive information like emails, phone numbers, and credit cards before they leave your infrastructure.",
        colSpan: "col-span-1",
    },
    {
        title: "Enterprise Compliance",
        description: "Full audit trails, safety scores, and compliance logging for every single AI request. SOC2 and HIPAA ready infrastructure.",

        colSpan: "col-span-1 md:col-span-1 lg:col-span-2",
    },
    {
        title: "Real-time Analytics",
        description: "Monitor usage, costs, and latency in real-time. Get deep insights into how your AI features are performing.",

        colSpan: "col-span-1",
    },
    {
        title: "Rate Limiting",
        description: "Prevent abuse and control costs with granular, database-backed rate limiting per project or user.",

        colSpan: "col-span-1",
    },
    {
        title: "Low Latency",
        description: "Built on the edge for minimal overhead. <50ms added latency to your requests.",

        colSpan: "col-span-1 md:col-span-2 lg:col-span-1",
    },
    {
        title: "Global Edge Network",
        description: "Deploy your AI security layer close to your users for maximum performance and compliance with data sovereignty laws.",
        icon: Globe,
        colSpan: "col-span-1 md:col-span-2 lg:col-span-3",
    },
];

export const Features = () => {
    return (
        <section className="py-24 bg-background border-b border-border/40">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
                        Everything you need to <br />
                        <span className="text-muted-foreground">secure your AI stack</span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        A complete suite of security, compliance, and observability tools built for the modern AI development workflow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, i) => (
                        <div key={i} className={feature.colSpan}>
                            <TechnicalBorder className="h-full">
                                <div className="p-8 h-full flex flex-col bg-background/50 backdrop-blur-sm hover:bg-background transition-colors duration-300">
                                    <h3 className="text-xl font-bold mb-3 tracking-tight">{feature.title}</h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </TechnicalBorder>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
