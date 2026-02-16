"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PaymentMethodSidebar } from "./PaymentMethodSidebar";

interface PaymentMethod {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
}

interface PaymentMethodsProps {
    methods: PaymentMethod[];
    portalUrl?: string | null;
}

export function PaymentMethods({ methods, portalUrl }: PaymentMethodsProps) {
    const [isAddSidebarOpen, setIsAddSidebarOpen] = useState(false);

    return (
        <div className="rounded-md border border-border/40 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Payment Methods
                </p>
                <Button
                    className="h-6 px-3 bg-foreground text-background hover:bg-foreground/90 transition-colors text-[10px] font-medium uppercase rounded shadow-none"
                    onClick={() => setIsAddSidebarOpen(true)}
                >
                    ADD
                </Button>
            </div>
            <div className="divide-y divide-border/10">
                {methods.map((method) => (
                    <div key={method.id} className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="h-7 w-10 rounded border border-border/40 bg-secondary/10 flex items-center justify-center text-[8px] font-medium uppercase tracking-tighter text-muted-foreground/60">
                                {method.brand}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-[11px] font-medium tabular-nums tracking-wider">
                                        •••• {method.last4}
                                    </p>
                                    {method.isDefault && (
                                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-border/50 text-muted-foreground/40 uppercase tracking-tighter">
                                            Default
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-[9px] text-muted-foreground font-medium tabular-nums">
                                    Exp: {method.expMonth}/{method.expYear}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/60 hover:text-red-500/60">
                            <Trash2 size={12} />
                        </Button>
                    </div>
                ))}
                {methods.length === 0 && (
                    <div className="p-8 text-center">
                        <p className="text-[11px] text-muted-foreground font-medium">No payment methods stored.</p>
                    </div>
                )}
            </div>
            <div className="px-4 py-2 border-t border-border/20">
                {portalUrl ? (
                    <Button
                        variant="link"
                        className="w-full h-auto p-0 text-[10px] font-medium text-muted-foreground uppercase tracking-widest hover:text-foreground hover:no-underline transition-colors"
                        onClick={() => window.open(portalUrl, '_blank')}
                    >
                        Secure Payment Portal
                    </Button>
                ) : (
                    <Button variant="link" className="w-full h-auto p-0 text-[10px] font-medium text-muted-foreground uppercase tracking-widest hover:text-foreground hover:no-underline transition-colors" disabled>
                        Secure Payment Portal
                    </Button>
                )}
            </div>

            <PaymentMethodSidebar
                isOpen={isAddSidebarOpen}
                onClose={() => setIsAddSidebarOpen(false)}
                portalUrl={portalUrl}
            />
        </div>
    );
}
