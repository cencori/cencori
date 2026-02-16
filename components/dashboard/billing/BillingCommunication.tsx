import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillingEditSidebar } from './BillingEditSidebar';

interface BillingCommunicationProps {
    orgSlug: string;
    email: string;
    address: {
        name: string;
        line1: string;
        line2?: string;
        city: string;
        state: string;
        zip: string;
        country: string;
        taxId?: string;
    };
}

export function BillingCommunication({ orgSlug, email, address }: BillingCommunicationProps) {
    const [isEditSidebarOpen, setIsEditSidebarOpen] = useState(false);

    return (
        <>
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium tracking-tight">Billing Records</h3>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Your contact details and invoice address.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setIsEditSidebarOpen(true)}
                    >
                        Edit Details
                    </Button>
                </div>

                <div className="p-6 grid gap-8 md:grid-cols-2">
                    <div className="space-y-3">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">Notification Email</div>
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-secondary/30 flex items-center justify-center text-muted-foreground">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                            </div>
                            <span className="text-sm font-medium">{email}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">Billing Address</div>
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-secondary/30 flex items-center justify-center text-muted-foreground mt-0.5 shrink-0">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                            </div>
                            <div className="text-sm leading-relaxed">
                                <p className="font-semibold text-foreground mb-1">{address.name}</p>
                                <div className="text-muted-foreground space-y-0.5">
                                    <p>{address.line1}</p>
                                    {address.line2 && <p>{address.line2}</p>}
                                    <p>{address.city}, {address.state} {address.zip}</p>
                                    <p>{address.country}</p>
                                    {address.taxId && (
                                        <div className="mt-2 pt-2 border-t border-border/40 inline-flex items-center gap-1.5 text-xs font-mono">
                                            <span className="text-[9px] uppercase tracking-wider opacity-70">Tax ID</span>
                                            <span>{address.taxId}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <BillingEditSidebar
                isOpen={isEditSidebarOpen}
                onClose={() => setIsEditSidebarOpen(false)}
                initialData={{ ...address, email }}
                orgSlug={orgSlug}
            />
        </>
    );
}
