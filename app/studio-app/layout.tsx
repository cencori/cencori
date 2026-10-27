import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getStudioWorkspace } from "@/lib/studio/workspace";
import { StudioShell } from "@/components/studio/StudioShell";
import { getMainSiteUrl } from "@/lib/main-site-url";

export const metadata: Metadata = {
    title: { default: "Cencori Studio", template: "%s · Studio" },
    description: "Your business assistant on WhatsApp, your website and your link.",
    manifest: "/studio/manifest.webmanifest",
    applicationName: "Cencori Studio",
    appleWebApp: { capable: true, title: "Studio", statusBarStyle: "default" },
    icons: { apple: "/studio/apple-touch-icon.png", icon: "/studio/icon-192.png" },
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ],
    colorScheme: "light dark",
    viewportFit: "cover",
};

// Every page reads the signed-in user's business; none of it is static.
export const dynamic = "force-dynamic";

/** Studio: signed in (the proxy sends everyone else to /login on this host). */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
    const workspace = await getStudioWorkspace();
    if (!workspace) {
        // No business yet: setup is next. It lives on the main site for now.
        const host = (await headers()).get("host") ?? "studio.cencori.com";
        const origin = `${host.includes("localhost") ? "http" : "https"}://${host.replace(/^studio\./, "")}`;
        return (
            <div className="dashboard-theme flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center font-sans text-foreground">
                <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your business</h1>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Tell us what you do and your assistant will be ready to answer customers in a few minutes.</p>
                <a href={getMainSiteUrl("/onboarding?for=business", origin)} className="mt-6 inline-flex h-12 items-center rounded-full bg-foreground px-6 text-[15px] font-medium text-background">
                    Get started
                </a>
            </div>
        );
    }
    return <StudioShell workspace={workspace}>{children}</StudioShell>;
}
