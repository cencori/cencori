"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearSignupWelcomeEmailPending, isSignupWelcomeEmailPending } from "@/lib/auth-welcome";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function SignupWelcomeEmailBridge() {
    useEffect(() => {
        let cancelled = false;
        let inFlight = false;

        const maybeSendWelcomeEmail = async (email: string | null | undefined) => {
            if (!email || cancelled || inFlight || !isSignupWelcomeEmailPending()) {
                return;
            }

            inFlight = true;
            try {
                const response = await fetch("/api/email/welcome", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });

                if (response.ok || response.status === 403) {
                    clearSignupWelcomeEmailPending();
                }
            } catch {
                // Best-effort flow: leave pending flag so the next authenticated page load can retry.
            } finally {
                inFlight = false;
            }
        };

        void supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
            if (cancelled) return;
            void maybeSendWelcomeEmail(session?.user?.email);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            if (event === "SIGNED_IN") {
                void maybeSendWelcomeEmail(session?.user?.email);
            }
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
