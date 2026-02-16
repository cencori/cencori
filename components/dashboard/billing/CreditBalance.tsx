"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
}

interface CreditProps {
    balance: number;
    transactions: Transaction[];
}

export function CreditBalance({ balance, transactions }: CreditProps) {
    return (
        <div className="rounded-md border border-border/40 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Credit Balance
                </p>
            </div>
            <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="text-2xl font-medium tabular-nums">${balance.toFixed(2)}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Available for on-demand generation
                        </p>
                    </div>
                    <Button className="h-7 px-4 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-none rounded">
                        Recharge
                    </Button>
                </div>

                <div className="space-y-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Recent Transactions
                    </div>
                    <div className="space-y-1">
                        {transactions.map((t) => (
                            <div key={t.id} className="flex items-center justify-between py-2 text-xs border-b border-border/40 last:border-0">
                                <span className={cn(
                                    "font-medium",
                                    t.type === 'credit' ? "text-emerald-500" : "text-foreground"
                                )}>
                                    {t.type === 'credit' ? '+' : '-'}${t.amount.toFixed(2)}
                                </span>
                                <span className="text-muted-foreground">{t.description}</span>
                                <span className="text-muted-foreground/50 tabular-nums">
                                    {new Date(t.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                        {transactions.length === 0 && (
                            <div className="text-center py-4 text-xs text-muted-foreground">
                                No recent transactions
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="px-4 py-2 border-t border-border/20">
                <Button variant="link" className="w-full h-auto p-0 text-[10px] font-medium text-muted-foreground uppercase tracking-widest hover:text-foreground hover:no-underline transition-colors">
                    View Full History
                </Button>
            </div>
        </div>
    );
}
