// The service worker owns the image cache. Only cache known local recipe images.
export function cacheDishImages(dishes) {
  if (!("serviceWorker" in navigator)) return;
  const urls = [
    ...new Set(
      dishes
        .filter((d) => d.image?.startsWith("/"))
        .map(
          (d) =>
            new URL(import.meta.env.BASE_URL + d.image.slice(1), location.href)
              .href,
        ),
    ),
  ];
  if (!urls.length) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({
        type: "CACHE_URLS",
        payload: { urlsToCache: urls },
      });
    })
    .catch(() => {});
}
