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
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Billing Records
                    </p>
                    <Button
                        className="h-6 px-3 bg-foreground text-background hover:bg-foreground/90 transition-colors text-[10px] font-medium uppercase rounded shadow-none"
                        onClick={() => setIsEditSidebarOpen(true)}
                    >
                        Edit Details
                    </Button>
                </div>
                <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                        <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">Notification Email</div>
                        <div className="flex items-center gap-2 bg-secondary/10 border border-border/40 rounded px-2.5 py-1.5">
                            <span className="text-[11px] font-medium truncate">{email}</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">Billing Address</div>
                        <div className="text-[11px] text-muted-foreground leading-relaxed font-normal">
                            <p className="font-medium text-foreground">{address.name}</p>
                            <p>{address.line1}</p>
                            {address.line2 && <p>{address.line2}</p>}
                            <p>{address.city}, {address.state} {address.zip}</p>
                            <p className="text-muted-foreground">{address.country}</p>
                            {address.taxId && <p className="mt-1 text-xs">Tax ID: {address.taxId}</p>}
                        </div>
                    </div>

                    <Button className="w-full h-7 bg-foreground text-background hover:bg-foreground/90 transition-colors text-[10px] font-medium uppercase rounded shadow-none">
                        Tax Information
                    </Button>
                </div>
            </div>

            <BillingEditSidebar
                isOpen={isEditSidebarOpen}
                onClose={() => setIsEditSidebarOpen(false)}
                initialData={address}
                orgSlug={orgSlug}
            />
        </>
    );
}
