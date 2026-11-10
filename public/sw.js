// SPDX-License-Identifier: Apache-2.0
const CACHE_NAME = "schreibatlas-static-dev";
const CACHE_PREFIX = "schreibatlas-static-";
const excludedDynamicPaths = /\/(?:uploads|user-uploads|user-content|reports|user-reports)(?:\/|$)/i;

function cacheableUrl(url) {
  return url.origin === self.location.origin
    && ["http:", "https:"].includes(url.protocol)
    && !url.search
    && !url.pathname.endsWith("/sw.js")
    && !excludedDynamicPaths.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = [...new Set(event.data.urls)];
    let complete = true;
    await Promise.all(urls.map(async (value) => {
      try {
        const url = new URL(value, self.location.origin);
        if (!cacheableUrl(url)) return;
        const request = new Request(url.href, { method: "GET", credentials: "same-origin" });
        if (await cache.match(request)) return;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") await cache.put(request, response);
        else complete = false;
      } catch {
        complete = false;
      }
    }));
    event.ports[0]?.postMessage({ type: "cached", complete });
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || !cacheableUrl(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    } catch {
      const offlineUrl = new URL(request.url);
      offlineUrl.search = "";
      const cached = await cache.match(offlineUrl.href);
      if (cached) return cached;
      return new Response("This resource has not been cached for offline use.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  })());
});
