import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getStudioWorkspace } from "@/lib/studio/workspace";
import { StudioShell } from "@/components/studio/StudioShell";
import { getMainSiteUrl } from "@/lib/main-site-url";
import { STUDIO_STARTUP_IMAGES } from "@/lib/studio/splash";

export const metadata: Metadata = {
    title: { default: "Cencori Studio", template: "%s · Studio" },
    description: "Your business assistant on WhatsApp, your website and your link.",
    manifest: "/studio/manifest.webmanifest",
    applicationName: "Cencori Studio",
    appleWebApp: { capable: true, title: "Studio", statusBarStyle: "default", startupImage: STUDIO_STARTUP_IMAGES },
    // Next writes only the generic "mobile-web-app-capable"; iOS shows launch
    // screens (startupImage above) only with its own tag.
    other: { "apple-mobile-web-app-capable": "yes" },
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

/**
 * Studio opens light: the site-wide default is dark, and Studio's origin has
 * its own stored theme, so a first visit stores "light" before anything
 * paints (next-themes then reads it like any saved choice).
 */
const LIGHT_BY_DEFAULT = `try{if(!localStorage.getItem("theme")){localStorage.setItem("theme","light");var d=document.documentElement;d.classList.remove("dark");d.classList.add("light");d.style.colorScheme="light"}}catch(e){}`;

function LightByDefault() {
    return <script dangerouslySetInnerHTML={{ __html: LIGHT_BY_DEFAULT }} />;
}

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
            <>
            <LightByDefault />
            <div className="dashboard-theme flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center font-sans text-foreground">
                <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your business</h1>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Tell us what you do and your assistant will be ready to answer customers in a few minutes.</p>
                <a href={getMainSiteUrl("/onboarding?for=business", origin)} className="mt-6 inline-flex h-12 items-center rounded-full bg-foreground px-6 text-[15px] font-medium text-background">
                    Get started
                </a>
            </div>
            </>
        );
    }
    return (
        <>
            <LightByDefault />
            <StudioShell workspace={workspace}>{children}</StudioShell>
        </>
    );
}
