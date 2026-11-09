import { messages, type Locale } from "../lib/i18n";

const language = document.documentElement.lang as Locale;
const copy = messages[language];
const status = document.querySelector<HTMLElement>("[data-offline-status]");

if (!("serviceWorker" in navigator)) {
  if (status) status.textContent = copy.offlineStatusUnavailable;
} else {
  const basePath = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  const serviceWorkerUrl = new URL(`${basePath}sw.js`, location.origin);
  let cacheInFlight = false;
  let cacheFinished = false;


  const cacheCurrentPage = () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller || cacheInFlight || cacheFinished) return;
    cacheInFlight = true;
    const pageUrl = new URL(location.href);
    pageUrl.search = "";
    pageUrl.hash = "";
    const urls = [pageUrl.href, ...performance.getEntriesByType("resource").map((entry) => entry.name)];
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }: MessageEvent<{ type: string; complete: boolean }>) => {
      if (data.type !== "cached") return;
      cacheInFlight = false;
      channel.port1.close();
      if (!data.complete) {
        if (status) status.textContent = copy.offlineStatusIncomplete;
        return;
      }
      cacheFinished = true;
      document.documentElement.dataset.offlineAssetsCached = "true";
      if (status) status.textContent = copy.offlineStatusAssetsCached;
      window.dispatchEvent(new Event("schreibatlas-offline-assets-cached"));
    };
    controller.postMessage({ type: "CACHE_URLS", urls }, [channel.port2]);
  };

  navigator.serviceWorker.addEventListener("controllerchange", cacheCurrentPage);
  navigator.serviceWorker.register(serviceWorkerUrl, { scope: basePath }).then(async () => {
    await navigator.serviceWorker.ready;
    cacheCurrentPage();
  }).catch(() => {
    if (status) status.textContent = copy.offlineStatusUnavailable;
  });
}
