import { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
    title: "Academy | Cencori",
    description: "Learn to build production AI applications with Cencori through interactive tutorials.",
    openGraph: {
        title: "Cencori Academy",
        description: "Interactive tutorials for building production AI applications",
        images: ["/api/og?title=Cencori Academy&subtitle=Interactive tutorials for AI production&type=docs"],
    },
};

import { createServerClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/site";

export default async function AcademyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isAuthenticated = !!user;
    let userProfile = undefined;

    if (user) {
        const meta = user.user_metadata ?? {};
        const avatar = meta.avatar_url ?? meta.picture ?? null;
        const name = meta.name ?? user.email?.split("@")[0] ?? null;
        userProfile = { name, avatar };
    }

    const unauthenticatedActions = [
        { text: "Sign in", href: siteConfig.links.signInUrl, isButton: false },
        {
            text: "Get Started",
            href: siteConfig.links.getStartedUrl,
            isButton: true,
            variant: "default",
        },
    ];

    const authenticatedActions = [
        {
            text: "Dashboard",
            href: "/dashboard/organizations",
            isButton: true,
            variant: "default",
        },
        {
            text: userProfile?.name || "User",
            href: "#",
            isButton: false,
            isAvatar: true,
            avatarSrc: userProfile?.avatar,
            avatarFallback: (userProfile?.name || "U").slice(0, 2).toUpperCase(),
        },
    ];

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar
                isAuthenticated={isAuthenticated}
                userProfile={userProfile}
                actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
            />
            <main className="flex-1 container mx-auto px-4 md:px-6 py-8 md:py-12">
                {children}
            </main>
            <Footer />
        </div>
    );
}
