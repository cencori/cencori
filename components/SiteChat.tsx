"use client";

import { useEffect } from "react";

/** The Cencori Support agent's website widget (embedded agents, dogfooded). */
const WIDGET_KEY = "cwk_vytf2M6QlWanwfmgWLDbVg01";
/** Only the public site: the console has Copilot, and other hosts aren't on the widget's site list. */
const HOSTS = new Set(["cencori.com", "www.cencori.com", ...(process.env.NODE_ENV === "production" ? [] : ["localhost"])]);

/**
 * Loads the support chat on cencori.com, the way any customer would: the
 * one script tag. Added once; the loader shows it only on the pages the
 * widget's "Pages" setting lists (the landing page by default) and follows
 * client-side navigation, so it never sits on top of the console.
 */
export function SiteChat() {
    useEffect(() => {
        if (!HOSTS.has(window.location.hostname)) return;
        if (document.querySelector(`script[data-key="${WIDGET_KEY}"]`)) return;
        const script = document.createElement("script");
        // Locally, the local widget.js (and the local API behind it).
        script.src = window.location.hostname === "localhost" ? `${window.location.origin}/widget.js` : "https://cencori.com/widget.js";
        script.async = true;
        script.dataset.key = WIDGET_KEY;
        document.body.appendChild(script);
    }, []);
    return null;
}
