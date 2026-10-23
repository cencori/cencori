"use client";

import type { AuthChangeEvent, AuthError, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { authClient } from "@/lib/auth/auth-client";
import { toSupabaseUser, type BetterAuthUser } from "@/lib/auth/to-supabase-user";

// Browser components ask about the session through this instead of
// supabase.auth, with the same method names and result shapes. Supabase until
// the RFC-0001 cutover; Better Auth after it (isBetterAuthEnabled). Under
// Better Auth a session carries only `user` (Supabase-shaped) — that's all the
// components read.

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;

function toSession(user: BetterAuthUser | null | undefined): Session | null {
    return user ? ({ user: toSupabaseUser(user) } as unknown as Session) : null;
}

export const browserAuth = {
    async getSession(): Promise<{ data: { session: Session | null }; error: AuthError | null }> {
        if (!isBetterAuthEnabled()) {
            return supabase.auth.getSession();
        }
        const { data } = await authClient.getSession();
        return { data: { session: toSession(data?.user as BetterAuthUser | undefined) }, error: null };
    },

    // Better Auth has no event stream; its session store (refetched on focus
    // and broadcast across tabs) is watched instead, and a change of user is
    // reported as SIGNED_IN / SIGNED_OUT — the events the app reacts to.
    onAuthStateChange(callback: AuthCallback): { data: { subscription: { unsubscribe: () => void } } } {
        if (!isBetterAuthEnabled()) {
            return supabase.auth.onAuthStateChange(callback);
        }
        let lastUserId: string | null | undefined;
        const unsubscribe = authClient.$store.atoms.session.subscribe(
            (value: { data: { user: BetterAuthUser } | null; isPending: boolean }) => {
                if (value.isPending) return;
                const user = value.data?.user ?? null;
                const userId = user?.id ?? null;
                if (lastUserId === undefined) {
                    lastUserId = userId;
                    callback("INITIAL_SESSION", toSession(user));
                    return;
                }
                if (userId === lastUserId) return;
                lastUserId = userId;
                callback(userId ? "SIGNED_IN" : "SIGNED_OUT", toSession(user));
            },
        );
        return { data: { subscription: { unsubscribe } } };
    },

    async signOut(options?: { scope?: "global" | "local" | "others" }): Promise<{ error: Error | null }> {
        if (!isBetterAuthEnabled()) return supabase.auth.signOut(options);
        const { error } = await authClient.signOut();
        return { error: error ? new Error(error.message ?? "Sign out failed") : null };
    },
};
