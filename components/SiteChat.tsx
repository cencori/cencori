"use client";

import { useEffect } from "react";

/** The Cencori Support agent's website widget (embedded agents, dogfooded). */
const WIDGET_KEY = "cwk_vytf2M6QlWanwfmgWLDbVg01";
/** Only the public site: the console has Copilot, and other hosts aren't on the widget's site list. */
const HOSTS = new Set(["cencori.com", "www.cencori.com"]);
/** Pages that are a chat themselves, or not for visitors. */
const SKIP = /^\/(chat|pitch|og|widget)(\/|$)/;

/**
 * Loads the support chat on cencori.com, the way any customer would: the
 * one script tag. Added once; it stays as the visitor moves between pages.
 */
export function SiteChat() {
    useEffect(() => {
        if (!HOSTS.has(window.location.hostname) || SKIP.test(window.location.pathname)) return;
        if (document.querySelector(`script[data-key="${WIDGET_KEY}"]`)) return;
        const script = document.createElement("script");
        script.src = "https://cencori.com/widget.js";
        script.async = true;
        script.dataset.key = WIDGET_KEY;
        document.body.appendChild(script);
    }, []);
    return null;
}
