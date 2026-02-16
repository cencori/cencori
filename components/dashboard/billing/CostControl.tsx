"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface Project {
    id: string;
    name: string;
    monthlyBudget: number | null;
    spendCap: number | null;
    enforceSpendCap: boolean;
    currentSpend: number;
}

interface CostControlProps {
    projects: Project[];
}

export function CostControl({ projects }: CostControlProps) {
    return (
        <div className="rounded-md border border-border/40 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <div>
                    <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Cost Control
                    </h3>
                    <p className="text-[10px] mt-0.5 text-muted-foreground font-medium">
                        Set budgets and hard caps per project.
                    </p>
                </div>
                <Button className="h-7 px-3 bg-foreground text-background hover:bg-foreground/90 transition-colors text-[10px] font-medium uppercase rounded shadow-none">
                    CONFIGURE ALERTS
                </Button>
            </div>
            <div className="divide-y divide-border/10">
                {projects.map((project) => (
                    <div key={project.id} className="p-4 flex items-center justify-between gap-6 hover:bg-secondary/20 transition-colors">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-xs font-medium truncate">{project.name}</h4>
                                {project.enforceSpendCap && (
                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-destructive/30 text-destructive/60 font-mono">
                                        HARD CAP
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-medium">
                                <span className="flex items-center gap-1">
                                    Budget: <span className="text-foreground font-medium tabular-nums">${project.monthlyBudget || 0}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    Spend: <span className="text-foreground font-medium tabular-nums">${project.currentSpend}</span>
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="text-right sr-only sm:not-sr-only">
                                <div className="text-[10px] font-medium tracking-tight tabular-nums">
                                    {project.spendCap ? `$${project.spendCap}` : 'No Cap'}
                                </div>
                                <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                                    Limit
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/40 hover:text-foreground">
                                <ChevronRight size={14} />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="px-4 py-2.5 bg-secondary/5 border-t border-border/20 flex justify-between items-center">
                <p className="text-[9px] text-muted-foreground font-medium flex items-center gap-1.5 uppercase tracking-wide">
                    Updates may take up to 15 minutes.
                </p>
                <Button variant="link" className="h-auto p-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wider hover:no-underline hover:text-foreground">
                    Detailed View →
                </Button>
            </div>
        </div>
    );
}
