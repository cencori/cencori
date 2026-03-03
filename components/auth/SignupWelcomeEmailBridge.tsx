"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearSignupWelcomeEmailPending, isSignupWelcomeEmailPending } from "@/lib/auth-welcome";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function SignupWelcomeEmailBridge() {
    useEffect(() => {
        let cancelled = false;
        let inFlight = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

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

        const trySessionSendWithRetry = async (attempt = 0) => {
            const { data: { session } }: { data: { session: Session | null } } = await supabase.auth.getSession();
            if (cancelled) return;

            await maybeSendWelcomeEmail(session?.user?.email);

            if (!isSignupWelcomeEmailPending() || attempt >= 5) {
                return;
            }

            retryTimer = setTimeout(() => {
                void trySessionSendWithRetry(attempt + 1);
            }, 1200);
        };

        void trySessionSendWithRetry();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            if (session?.user?.email && event !== "SIGNED_OUT") {
                void maybeSendWelcomeEmail(session?.user?.email);
            }
        });

        return () => {
            cancelled = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
