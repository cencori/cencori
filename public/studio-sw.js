/*
 * Cencori Studio's service worker: shows push notifications ("Tolu needs
 * you", "New booking", "Paid ₦20,000") and opens the right screen when one is
 * tapped, reusing an open Studio window when there is one.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
