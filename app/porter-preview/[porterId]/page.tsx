"use client";

import { use, useEffect, useState } from "react";

/**
 * The Porter as a visitor meets it.
 *
 * This loads porter.js -- the actual widget, the same file the customer pastes into their site --
 * rather than a console component shaped like it. A preview built from a lookalike drifts from the
 * real thing the moment either changes, and the whole point of previewing is to see what ships.
 *
 * The widget normally mints its own session from the publishable key, which would be refused here:
 * that key is locked to the customer's domain and this page is on ours. So the page asks the server
 * for a preview session -- authorised by organization membership rather than by an origin header --
 * and hands it to the widget, which then behaves exactly as it will in production.
 */
export default function PorterPreviewPage({
    params,
}: {
    params: Promise<{ porterId: string }>;
}) {
    const { porterId } = use(params);
    const [state, setState] = useState<"loading" | "ready" | "denied" | "notready">("loading");

    useEffect(() => {
        let cancelled = false;

        fetch(`/api/porter/${porterId}/preview-session`, { method: "POST" })
            .then(async (response) => {
                const body = await response.json();
                if (cancelled) return;

                if (!response.ok) {
                    setState(body?.code === "porter_not_ready" ? "notready" : "denied");
                    return;
                }

                const script = document.createElement("script");
                script.src = "/porter.js";
                script.defer = true;
                script.setAttribute("data-porter", porterId);
                script.setAttribute("data-session", body.token);
                script.setAttribute("data-base", window.location.origin);
                document.body.appendChild(script);
                setState("ready");
            })
            .catch(() => {
                if (!cancelled) setState("denied");
            });

        return () => {
            cancelled = true;
            // The widget mounts a host element on body; leaving it behind would stack another on
            // every remount in development.
            document.querySelectorAll("[data-porter-host]").forEach((node) => node.remove());
        };
    }, [porterId]);

    useEffect(() => {
        document.title = "Porter preview";
    }, []);

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-[#fafafa]">
            <div className="mx-auto max-w-2xl px-6 pt-24">
                <h1 className="text-3xl font-semibold tracking-tight text-black">Your website</h1>
                <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-black/60">
                    This page stands in for the site you are putting the Porter on. The launcher sits where it
                    will sit, opens what it will open, and answers from the pages it has read — it is the same
                    script the snippet installs, not a copy of it.
                </p>

                {state === "loading" && (
                    <p className="mt-10 text-sm text-black/40">Starting your Porter…</p>
                )}

                {state === "notready" && (
                    <div className="mt-10 rounded-lg border border-black/10 bg-white p-5">
                        <p className="text-sm font-medium text-black">It has not read your site yet</p>
                        <p className="mt-1 text-sm text-black/60">
                            Choose what it should read on the Knowledge page, then come back.
                        </p>
                    </div>
                )}

                {state === "denied" && (
                    <div className="mt-10 rounded-lg border border-black/10 bg-white p-5">
                        <p className="text-sm font-medium text-black">This Porter is not yours to preview</p>
                        <p className="mt-1 text-sm text-black/60">
                            Sign in with an account in the organization that owns it.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
