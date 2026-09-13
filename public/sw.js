// Minimal service worker so the app can be installed on phones.
// Family photos are private, so nothing is cached here.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
