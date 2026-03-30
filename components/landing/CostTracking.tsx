"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const providerRows = [
    { name: "OpenAI", model: "gpt-4o", requests: "12,847", tokens: "4.2M", cost: "$48.32", color: "text-emerald-500", barWidth: "w-[85%]", barColor: "bg-emerald-500/20" },
    { name: "Anthropic", model: "claude-sonnet", requests: "8,291", tokens: "3.1M", cost: "$31.05", color: "text-orange-500", barWidth: "w-[62%]", barColor: "bg-orange-500/20" },
    { name: "Google", model: "gemini-pro", requests: "5,103", tokens: "1.8M", cost: "$12.40", color: "text-blue-500", barWidth: "w-[38%]", barColor: "bg-blue-500/20" },
    { name: "DeepSeek", model: "deepseek-v3", requests: "3,422", tokens: "1.1M", cost: "$2.18", color: "text-violet-500", barWidth: "w-[15%]", barColor: "bg-violet-500/20" },
];

const statCells = [
    { label: "Total Spend", value: "$93.95", sub: "this month" },
    { label: "Cost / Request", value: "$0.003", sub: "avg across providers" },
    { label: "Cache Savings", value: "$18.40", sub: "19.6% saved" },
    { label: "Total Requests", value: "29.6K", sub: "98.7% success" },
];

export const CostTracking = () => {
    return (
        <section className="py-32 bg-background overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
                        Know what you&apos;re spending.{" "}
                        <span className="text-muted-foreground">Everywhere.</span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Real-time cost visibility across every provider, model, and project.
                        No more surprise bills.
                    </p>
                </div>

                {/* Dashboard Mockup */}
                <div className="max-w-4xl mx-auto">
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
                                    cencori.com/dashboard/usage
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Stats + Provider Breakdown — single dense card */}
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

                                {/* Provider Breakdown */}
                                <div className="border-t border-border/30">
                                    <div className="px-5 py-3 border-b border-border/20">
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Cost by Provider</span>
                                    </div>
                                    <div className="divide-y divide-border/10">
                                        {providerRows.map((row, i) => (
                                            <motion.div
                                                key={row.name}
                                                initial={{ opacity: 0, x: -10 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.3, delay: 0.3 + i * 0.08 }}
                                                className="flex items-center gap-4 px-5 py-2.5 hover:bg-muted/10 transition-colors"
                                            >
                                                <div className="w-24 md:w-28 flex-shrink-0">
                                                    <div className={cn("text-xs font-medium", row.color)}>{row.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{row.model}</div>
                                                </div>
                                                <div className="flex-1 hidden md:block">
                                                    <div className="w-full h-1 rounded-full bg-muted-foreground/10 overflow-hidden">
                                                        <motion.div
                                                            className={cn("h-full rounded-full", row.barColor)}
                                                            initial={{ width: 0 }}
                                                            whileInView={{ width: "100%" }}
                                                            viewport={{ once: true }}
                                                            transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                                                        >
                                                            <div className={cn("h-full rounded-full", row.barWidth, row.barColor.replace("/20", "/40"))} />
                                                        </motion.div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 md:gap-6 text-right flex-shrink-0">
                                                    <div className="hidden md:block">
                                                        <div className="text-[10px] text-muted-foreground">Requests</div>
                                                        <div className="text-xs font-medium text-foreground">{row.requests}</div>
                                                    </div>
                                                    <div className="hidden md:block">
                                                        <div className="text-[10px] text-muted-foreground">Tokens</div>
                                                        <div className="text-xs font-medium text-foreground">{row.tokens}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-muted-foreground">Cost</div>
                                                        <div className="text-xs font-bold text-foreground">{row.cost}</div>
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
            </div>
        </section>
    );
};
