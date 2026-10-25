"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Meta's Embedded Signup in the browser: the Facebook SDK opens Meta's popup,
 * where the business logs in, picks its business and verifies its number.
 * The popup reports the number and WhatsApp account by postMessage; FB.login
 * returns a code the server swaps for the business's token.
 */

export type SignupConfig = { app_id: string; config_id: string; graph_version: string };
export type SignupResult = { code: string; phoneNumberId: string; wabaId: string; coexistence: boolean };

type FacebookSdk = {
    init(options: Record<string, unknown>): void;
    login(callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void, options: Record<string, unknown>): void;
};
declare global {
    interface Window {
        FB?: FacebookSdk;
        fbAsyncInit?: () => void;
    }
}

let sdkLoading: Promise<FacebookSdk> | null = null;

function loadSdk(config: SignupConfig): Promise<FacebookSdk> {
    if (window.FB) return Promise.resolve(window.FB);
    sdkLoading ??= new Promise<FacebookSdk>((resolve, reject) => {
        window.fbAsyncInit = () => {
            window.FB!.init({ appId: config.app_id, autoLogAppEvents: true, xfbml: false, version: config.graph_version });
            resolve(window.FB!);
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onerror = () => {
            sdkLoading = null;
            reject(new Error("Couldn't load Meta's sign-in. Check your connection or ad blocker and try again."));
        };
        document.body.appendChild(script);
    });
    return sdkLoading;
}

/** The popup's report: the number and account chosen, or where it was left. */
type SessionEvent = { type?: string; event?: string; data?: { phone_number_id?: string; waba_id?: string; current_step?: string; error_message?: string } };

export function useWhatsAppSignup(config: SignupConfig | null) {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pending = useRef<{ resolve: (result: SignupResult) => void; reject: (error: Error) => void; code?: string; session?: { phoneNumberId: string; wabaId: string }; coexistence: boolean } | null>(null);

    // Loaded ahead of the click: the popup must open straight from it, or browsers block it.
    useEffect(() => {
        if (!config) return;
        loadSdk(config).then(() => setReady(true), (cause: Error) => setError(cause.message));
    }, [config?.app_id, config?.config_id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            let host = "";
            try {
                host = new URL(event.origin).hostname;
            } catch {
                return;
            }
            if (!/(^|\.)facebook\.com$/.test(host)) return;
            let data: SessionEvent;
            try {
                data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
            } catch {
                return;
            }
            const current = pending.current;
            if (data?.type !== "WA_EMBEDDED_SIGNUP" || !current) return;
            if (data.event === "CANCEL") {
                pending.current = null;
                current.reject(new Error(data.data?.current_step ? "Connecting WhatsApp was cancelled before it finished." : "Connecting WhatsApp was cancelled."));
            } else if (data.event === "ERROR") {
                pending.current = null;
                current.reject(new Error(data.data?.error_message || "Meta couldn't finish connecting the number."));
            } else if (data.data?.phone_number_id && data.data.waba_id) {
                current.session = { phoneNumberId: data.data.phone_number_id, wabaId: data.data.waba_id };
                settle();
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    /** Both halves arrive separately (the code from FB.login, the number by message); finish once both have. */
    const settle = () => {
        const current = pending.current;
        if (!current?.code || !current.session) return;
        pending.current = null;
        current.resolve({ code: current.code, ...current.session, coexistence: current.coexistence });
    };

    /** Open Meta's popup. Call straight from a click. */
    const start = useCallback((opts: { coexistence: boolean }) => new Promise<SignupResult>((resolve, reject) => {
        const fb = window.FB;
        if (!config || !fb) {
            reject(new Error("Meta's sign-in is still loading. Try again in a moment."));
            return;
        }
        pending.current = { resolve, reject, coexistence: opts.coexistence };
        fb.login((response) => {
            const code = response.authResponse?.code;
            const current = pending.current;
            if (!current) return;
            if (!code) {
                // Closed without finishing; the message listener may already have said why.
                pending.current = null;
                reject(new Error("Connecting WhatsApp was cancelled."));
                return;
            }
            current.code = code;
            settle();
            // The number's details can trail the code by a moment; give up if they never come.
            window.setTimeout(() => {
                if (pending.current === current) {
                    pending.current = null;
                    reject(new Error("Meta didn't say which number was connected. Try again."));
                }
            }, 15_000);
        }, {
            config_id: config.config_id,
            response_type: "code",
            override_default_response_type: true,
            extras: {
                setup: {},
                sessionInfoVersion: "3",
                // Keep using the WhatsApp Business app on the same number.
                ...(opts.coexistence ? { featureType: "whatsapp_business_app_onboarding" } : {}),
            },
        });
    }), [config]); // eslint-disable-line react-hooks/exhaustive-deps

    return { ready, error, start };
}
