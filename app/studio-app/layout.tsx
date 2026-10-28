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
    // The keyboard covers the page instead of squashing it (Android; iOS always does), and
    // Studio moves what's being typed in above it (useKeyboardInset), as a native app does.
    interactiveWidget: "overlays-content",
};

/**
 * Marks the page as Studio (no scrollbars anywhere: globals.css), and
 * Studio follows the phone's light or dark setting: the site-wide default is
 * dark, and Studio's origin has its own stored theme, so a first visit stores
 * "system" before anything paints (next-themes then reads it like any saved
 * choice). Studio used to store "light" here; that one-time default goes back
 * to "system" once (studio-theme-v2), so only a choice made since stays.
 */
const SYSTEM_BY_DEFAULT = `document.documentElement.setAttribute("data-studio","");try{var s=localStorage,t=s.getItem("theme");if(!s.getItem("studio-theme-v2")){s.setItem("studio-theme-v2","1");if(t==="light")t=null}if(!t){s.setItem("theme","system");var k=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",d=document.documentElement;d.classList.remove("dark","light");d.classList.add(k);d.style.colorScheme=k}}catch(e){}`;

function SystemByDefault() {
    return <script dangerouslySetInnerHTML={{ __html: SYSTEM_BY_DEFAULT }} />;
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
            <SystemByDefault />
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
            <SystemByDefault />
            <StudioShell workspace={workspace}>{children}</StudioShell>
        </>
    );
}
