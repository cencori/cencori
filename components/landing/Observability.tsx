"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const statCells = [
    { label: "Requests", value: "29.6K", sub: "98.7% success" },
    { label: "Avg Latency", value: "142ms", sub: "p50 response" },
    { label: "Tokens", value: "10.2M", sub: "~345 per req" },
    { label: "Incidents", value: "3", sub: "1 critical" },
];

const logRows = [
    { time: "14:32:07", status: "success", model: "gpt-4o", latency: "128ms", tokens: "342", statusColor: "text-emerald-500", dotColor: "bg-emerald-500" },
    { time: "14:32:05", status: "success", model: "claude-sonnet", latency: "203ms", tokens: "518", statusColor: "text-emerald-500", dotColor: "bg-emerald-500" },
    { time: "14:32:03", status: "filtered", model: "gpt-4o", latency: "12ms", tokens: "0", statusColor: "text-amber-500", dotColor: "bg-amber-500" },
    { time: "14:32:01", status: "success", model: "gemini-pro", latency: "95ms", tokens: "271", statusColor: "text-emerald-500", dotColor: "bg-emerald-500" },
    { time: "14:31:58", status: "error", model: "deepseek-v3", latency: "—", tokens: "0", statusColor: "text-red-500", dotColor: "bg-red-500" },
    { time: "14:31:55", status: "fallback", model: "gpt-4o-mini", latency: "187ms", tokens: "405", statusColor: "text-blue-500", dotColor: "bg-blue-500" },
];

const features = [
    {
        title: "Real-Time Request Stream",
        description: "Every AI request, streamed live via SSE. See status, model, latency, and tokens as they happen.",
    },
    {
        title: "Latency Percentiles",
        description: "P50, P75, P90, P95, P99 — broken down by model and provider. Find bottlenecks before users do.",
    },
    {
        title: "Anomaly Detection",
        description: "Automatic baseline comparison against 14-day history. Get alerted when cost, latency, or error rates spike.",
    },
    {
        title: "Provider Failover Tracking",
        description: "See which requests failed over to backup providers, why, and how long the failover took.",
    },
    {
        title: "Multi-Layer Filtering",
        description: "Filter by status, model, provider, API key, environment, and time range. Export to CSV or JSON.",
    },
];

export const Observability = () => {
    return (
        <section className="py-32 bg-background overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
                        See everything.{" "}
                        <span className="text-muted-foreground">Miss nothing.</span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Real-time logs, latency percentiles, anomaly detection, and provider health — all in one dashboard.
                    </p>
                </div>

                {/* Dashboard Mockup */}
                <div className="max-w-4xl mx-auto mb-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.5 }}
                        className="rounded-xl border border-border/50 bg-background shadow-[0_0_50px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_50px_-20px_rgba(255,255,255,0.05)] overflow-hidden"
                    >
                        {/* Mock Window Bar */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                                <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                                <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="px-3 py-0.5 rounded-md bg-foreground/5 text-[10px] text-muted-foreground font-mono">
                                    cencori.com/dashboard/observability
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                                {/* Top row: key metrics */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border/30">
                                    {statCells.map((stat, i) => (
                                        <motion.div
                                            key={stat.label}
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
                                            className="px-5 py-4"
                                        >
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</span>
                                            <p className="text-xl font-semibold font-mono tracking-tight mt-1">{stat.value}</p>
                                            <span className="text-[10px] text-muted-foreground">{stat.sub}</span>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Live Request Log */}
                                <div className="border-t border-border/30">
                                    <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Live Requests</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] text-muted-foreground font-mono">streaming</span>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-border/10">
                                        {logRows.map((row, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
                                                className="flex items-center gap-4 px-5 py-2 hover:bg-muted/10 transition-colors"
                                            >
                                                <span className="text-[10px] font-mono text-muted-foreground w-14 flex-shrink-0">{row.time}</span>
                                                <div className="flex items-center gap-1.5 w-16 flex-shrink-0">
                                                    <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", row.dotColor)} />
                                                    <span className={cn("text-[10px] font-medium", row.statusColor)}>{row.status}</span>
                                                </div>
                                                <span className="text-xs font-medium text-foreground flex-1 truncate">{row.model}</span>
                                                <div className="flex gap-5 text-right flex-shrink-0">
                                                    <div className="hidden md:block">
                                                        <span className="text-[10px] tabular-nums text-muted-foreground">{row.latency}</span>
                                                    </div>
                                                    <div className="hidden md:block">
                                                        <span className="text-[10px] tabular-nums text-muted-foreground w-8 inline-block text-right">{row.tokens}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Features — single dense card */}
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="rounded-md border border-border/40 bg-card overflow-hidden"
                    >
                        <div className="grid md:grid-cols-2 divide-x divide-border/30">
                            {/* Left column */}
                            <div>
                                <div className="px-5 py-3 border-b border-border/20">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Real-Time</span>
                                </div>
                                <div className="divide-y divide-border/10">
                                    {features.slice(0, 2).map((feature, i) => (
                                        <div key={feature.title} className="px-5 py-4 hover:bg-muted/10 transition-colors">
                                            <span className="text-xs font-medium text-foreground">{feature.title}</span>
                                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{feature.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Right column */}
                            <div>
                                <div className="px-5 py-3 border-b border-border/20">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Intelligence</span>
                                </div>
                                <div className="divide-y divide-border/10">
                                    {features.slice(2, 4).map((feature, i) => (
                                        <div key={feature.title} className="px-5 py-4 hover:bg-muted/10 transition-colors">
                                            <span className="text-xs font-medium text-foreground">{feature.title}</span>
                                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{feature.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Full-width bottom row */}
                        <div className="border-t border-border/30">
                            <div className="px-5 py-4 hover:bg-muted/10 transition-colors">
                                <span className="text-xs font-medium text-foreground">{features[4].title}</span>
                                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{features[4].description}</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};
