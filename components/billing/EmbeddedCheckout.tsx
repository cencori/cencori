"use client";

import React, { useEffect, useRef, useState } from "react";
import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import { Loader2 } from "lucide-react";

interface EmbeddedCheckoutProps {
    checkoutUrl: string;
    onSuccess?: () => void;
    onClose?: () => void;
}

export function EmbeddedCheckout({ checkoutUrl, onSuccess, onClose }: EmbeddedCheckoutProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const checkoutRef = useRef<InstanceType<typeof PolarEmbedCheckout> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current || !checkoutUrl) return;

        const initCheckout = async () => {
            try {
                // Create the embed checkout
                const embed = await PolarEmbedCheckout.create(checkoutUrl, 'dark');
                checkoutRef.current = embed;

                // Listen for events
                embed.addEventListener('success', () => {
                    console.log('[EmbeddedCheckout] Success!');
                    onSuccess?.();
                });

                embed.addEventListener('close', () => {
                    console.log('[EmbeddedCheckout] Closed');
                    onClose?.();
                });

                embed.addEventListener('loaded', () => {
                    console.log('[EmbeddedCheckout] Loaded');
                    setLoading(false);
                });

            } catch (err) {
                console.error('[EmbeddedCheckout] Error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load checkout');
                setLoading(false);
            }
        };

        initCheckout();

        return () => {
            // Cleanup - close the checkout if it exists
            if (checkoutRef.current) {
                try {
                    checkoutRef.current.close();
                } catch {
                    // Ignore errors during cleanup
                }
            }
        };
    }, [checkoutUrl, onSuccess, onClose]);

    if (error) {
        return (
            <div className="flex items-center justify-center p-8 text-sm text-red-500">
                {error}
            </div>
        );
    }

    return (
        <div className="relative min-h-[600px]">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Loading checkout...</span>
                    </div>
                </div>
            )}
            <div ref={containerRef} className="w-full" />
        </div>
    );
}
