// Minimal service worker — no-op so /sw.js returns 200
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => {});
