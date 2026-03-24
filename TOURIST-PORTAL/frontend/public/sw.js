/* eslint-disable no-restricted-globals */

const SHELL_CACHE = "guardianid-shell-v2"
const TILE_CACHE = "guardianid-tiles-v2"
const IS_LOCAL =
  self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1"

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop older cache versions to avoid serving stale HTML/assets.
      const keys = await caches.keys()
      await Promise.all(
        keys.map((k) => {
          if (k !== SHELL_CACHE && k !== TILE_CACHE) return caches.delete(k)
          return Promise.resolve(false)
        }),
      )
      await self.clients.claim()
    })(),
  )
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  // Cross-origin tiles are usually opaque; cache them anyway.
  if (res && (res.ok || res.type === "opaque")) {
    cache.put(request, res.clone())
  }
  return res
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    // Never cache error responses (4xx/5xx) so the browser can recover
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch (e) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw e
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)

  // Cache OSM tiles (auto-cache)
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirst(req, TILE_CACHE))
    return
  }

  // Cache Next static assets (helps with offline reloads)
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/public/")) {
      event.respondWith(cacheFirst(req, SHELL_CACHE))
      return
    }
    if (req.mode === "navigate") {
      // In local dev, don't cache HTML navigations (prevents hydration mismatch with HMR).
      if (IS_LOCAL) return
      event.respondWith(networkFirst(req, SHELL_CACHE))
      return
    }
  }
})

