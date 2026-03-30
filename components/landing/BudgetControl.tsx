"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const features = [
    {
        title: "Hard Spend Caps",
        description: "Set per-project budget limits that actually stop requests when hit. No more runaway costs from a single misconfigured prompt loop.",
    },
    {
        title: "Budget Alerts",
        description: "Get notified at 50%, 80%, and 100% of your budget. Know before you hit the wall, not after.",
    },
    {
        title: "End-User Billing",
        description: "Pass AI costs to your customers with custom markups. Generate invoices per end-user automatically.",
    },
    {
        title: "Per-Project Budgets",
        description: "Different budgets for different projects. Staging gets $50/mo, production gets $5K. You decide.",
    },
];

const budgetRows = [
    { project: "prod-api", budget: "$5,000", spent: "$3,247", percent: 65, status: "on-track", color: "bg-emerald-500" },
    { project: "staging", budget: "$50", spent: "$38", percent: 76, status: "warning", color: "bg-amber-500" },
    { project: "internal-tools", budget: "$200", spent: "$182", percent: 91, status: "critical", color: "bg-red-500" },
];

export const BudgetControl = () => {
    return (
        <section className="py-32 bg-background overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
                        Set limits.{" "}
                        <span className="text-muted-foreground">Sleep better.</span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Per-project budgets, hard spend caps, and automatic alerts.
                        AI costs under control before they become a problem.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 items-start">
                    {/* Left: Features — single dense card with rows */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.5 }}
                        className="rounded-md border border-border/40 bg-card overflow-hidden"
                    >
                        <div className="px-5 py-3 border-b border-border/20">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">What you get</span>
                        </div>
                        <div className="divide-y divide-border/10">
                            {features.map((feature, i) => (
                                <motion.div
                                    key={feature.title}
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
                                    className="px-5 py-4 hover:bg-muted/10 transition-colors"
                                >
                                    <span className="text-xs font-medium text-foreground">{feature.title}</span>
                                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{feature.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Right: Budget Dashboard Mock */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="rounded-md border border-border/40 bg-card overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Project Budgets</span>
                            <span className="text-[10px] text-muted-foreground font-mono">March 2026</span>
                        </div>

                        <div className="divide-y divide-border/10">
                            {budgetRows.map((row, i) => (
                                <motion.div
                                    key={row.project}
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
                                    className="px-5 py-4 space-y-2.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-medium text-foreground">{row.project}</span>
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider",
                                                row.status === "on-track" && "bg-emerald-500/10 text-emerald-500",
                                                row.status === "warning" && "bg-amber-500/10 text-amber-500",
                                                row.status === "critical" && "bg-red-500/10 text-red-500",
                                            )}>
                                                {row.status === "on-track" ? "On Track" : row.status === "warning" ? "Warning" : "Near Limit"}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">{row.spent}</span>
                                            {" / "}
                                            {row.budget}
                                        </div>
                                    </div>
                                    <div className="w-full h-1 rounded-full bg-muted-foreground/10 overflow-hidden">
                                        <motion.div
                                            className={cn("h-full rounded-full", row.color)}
                                            initial={{ width: 0 }}
                                            whileInView={{ width: `${row.percent}%` }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.6, delay: 0.4 + i * 0.12 }}
                                        />
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Alert row */}
                        <div className="px-5 py-3 border-t border-border/20 bg-amber-500/5">
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                Alert: internal-tools has reached 91% of its $200 budget
                            </span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};
