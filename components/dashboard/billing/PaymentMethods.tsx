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
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium tracking-tight">Payment Methods</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Manage your credit cards and billing preferences.
                    </p>
                </div>
                <Button
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setIsAddSidebarOpen(true)}
                >
                    <Plus size={12} className="mr-1.5" />
                    Add Method
                </Button>
            </div>

            <div className="p-0">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-border/40 bg-muted/30">
                            <th className="px-6 py-3 font-medium text-muted-foreground uppercase tracking-wider w-[20%]">Brand</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground uppercase tracking-wider">Number</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground uppercase tracking-wider">Expiry</th>
                            <th className="px-6 py-3 font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 w-[50px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                        {methods.map((method) => (
                            <tr key={method.id} className="group hover:bg-muted/20 transition-colors">
                                <td className="px-6 py-4 font-medium uppercase text-muted-foreground text-[10px] tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={14} />
                                        {method.brand}
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-muted-foreground">
                                    •••• {method.last4}
                                </td>
                                <td className="px-6 py-4 tabular-nums">
                                    {method.expMonth.toString().padStart(2, '0')} / {method.expYear}
                                </td>
                                <td className="px-6 py-4">
                                    {method.isDefault && (
                                        <Badge variant="secondary" className="text-[9px] h-4 rounded-sm px-1.5 font-normal text-muted-foreground">
                                            Default
                                        </Badge>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                                        <Trash2 size={12} />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {methods.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                            <CreditCard size={14} className="opacity-50" />
                                        </div>
                                        <p>No payment methods on file.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-3 border-t border-border/40 bg-muted/10">
                {portalUrl ? (
                    <Button
                        variant="link"
                        className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => window.open(portalUrl, '_blank')}
                    >
                        Open Secure Payment Portal →
                    </Button>
                ) : (
                    <Button variant="link" className="h-auto p-0 text-[10px] text-muted-foreground opacity-50 cursor-not-allowed" disabled>
                        Secure Payment Portal Unavailable
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
