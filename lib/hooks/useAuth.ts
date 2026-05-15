"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setIsAuthenticated(true);
                const { user } = session;
                const meta = user.user_metadata ?? {};
                const avatar = meta.avatar_url ?? meta.picture ?? null;
                const name = meta.name ?? user.email?.split("@")[0] ?? null;
                setUserProfile({ name: name as string | null, avatar: avatar as string | null });
            }
            setLoading(false);
        };
        checkUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            if (session?.user) {
                setIsAuthenticated(true);
                const { user } = session;
                const meta = user.user_metadata ?? {};
                const avatar = meta.avatar_url ?? meta.picture ?? null;
                const name = meta.name ?? user.email?.split("@")[0] ?? null;
                setUserProfile({ name: name as string | null, avatar: avatar as string | null });
            } else {
                setIsAuthenticated(false);
                setUserProfile({ name: null, avatar: null });
            }
            setLoading(false);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return { isAuthenticated, userProfile, loading };
}
