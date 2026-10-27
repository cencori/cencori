/*
 * Cencori Studio's service worker.
 *
 * Opening fast, and offline: Studio's code (/_next/static, hashed so it never
 * changes) and icons come from this device once they've been fetched. Pages
 * come from the network, kept here as they load; when the network is slow
 * (no answer in 2.5 s) or gone, the kept page is shown instead and the data on
 * it loads, or says it's offline, by itself. Moving between Studio's screens
 * never asks the server at all (components/studio/studio-nav.tsx). Sign-in,
 * the API and everything else always go to the network.
 *
 * Notifications: shows push notifications ("Tolu needs you", "New booking",
 * "Paid ₦20,000") and opens the right screen when one is tapped, reusing an
 * open Studio window when there is one.
 */

const STATIC_CACHE = "studio-static-v1";
const PAGES_CACHE = "studio-pages";
const SLOW_NETWORK_MS = 2500;
const NOT_PAGES = /^\/(api|login|signup|auth|forgot|reset-password|__maintenance)(\/|$)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, PAGES_CACHE]);
    for (const name of await caches.keys()) if (name.startsWith("studio-") && !keep.has(name)) await caches.delete(name);
    await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/studio/")) {
        event.respondWith(fromCacheFirst(request));
    } else if (request.mode === "navigate" && !NOT_PAGES.test(url.pathname)) {
        event.respondWith(page(request, url));
    }
});

/** Hashed code and icons: this device's copy, else the network (and keep it). */
async function fromCacheFirst(request) {
    const cache = await caches.open(STATIC_CACHE);
    const kept = await cache.match(request);
    if (kept) return kept;
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => undefined);
    return response;
}

/** A Studio page: the network when it answers in time, else the copy kept here. */
async function page(request, url) {
    const cache = await caches.open(PAGES_CACHE);
    const key = url.pathname;
    const fresh = fetch(request).then((response) => {
        // Only real pages: not a redirect to sign-in, not an error.
        if (response.ok && !response.redirected && (response.headers.get("content-type") || "").includes("text/html")) {
            cache.put(key, response.clone()).catch(() => undefined);
        }
        return response;
    });
    const kept = (await cache.match(key)) || (await cache.match("/"));
    if (!kept) return fresh.catch(() => offlinePage());
    // Whichever comes first: the network in time, or the kept copy (the network still refreshes it).
    const slow = new Promise((resolve) => setTimeout(() => resolve(kept), SLOW_NETWORK_MS));
    return Promise.race([fresh.catch(() => kept), slow]);
}

function offlinePage() {
    return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio</title>' +
        '<body style="font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;color:#666">' +
        "<div><p style=\"font-weight:600;color:#111\">You're offline</p><p>Open Studio again once you're connected.</p></div></body>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
}

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: "Cencori Studio", body: event.data ? event.data.text() : "" };
    }
    event.waitUntil(self.registration.showNotification(data.title || "Cencori Studio", {
        body: data.body || "",
        icon: "/studio/icon-192.png",
        badge: "/studio/icon-192.png",
        tag: data.tag,
        renotify: !!data.tag,
        data: { url: data.url || "/" },
    }));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of windows) {
            if (new URL(client.url).origin === self.location.origin && "navigate" in client) {
                await client.focus();
                return client.navigate(url);
            }
        }
        return self.clients.openWindow(url);
    })());
});
