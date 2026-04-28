"use client";

import React, { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import { partners } from "@/config/partners";
import { PartnerTemplate } from "@/components/partners/PartnerTemplate";
import { supabase } from "@/lib/supabaseClient";

export default function PartnerPage() {
    const params = useParams();
    const slug = params.slug as string;
    const config = partners[slug];

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });

    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
                setIsAuthenticated(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const m = user.user_metadata ?? {};
                    setUserProfile({
                        name: (m.name ?? user.email?.split("@")[0] ?? null) as string | null,
                        avatar: (m.avatar_url ?? m.picture ?? null) as string | null,
                    });
                }
            }
        };
        checkAuth();

        const { data: listener } = supabase.auth.onAuthStateChange((_ev: any, session: any) => {
            if (session) {
                setIsAuthenticated(true);
                const m = session.user.user_metadata ?? {};
                setUserProfile({
                    name: (m.name ?? session.user.email?.split("@")[0] ?? null) as string | null,
                    avatar: (m.avatar_url ?? m.picture ?? null) as string | null,
                });
            } else {
                setIsAuthenticated(false);
                setUserProfile({ name: null, avatar: null });
            }
        });

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    if (!config) {
        notFound();
    }

    return (
        <PartnerTemplate 
            config={config} 
            isAuthenticated={isAuthenticated} 
            userProfile={userProfile} 
        />
    );
}
