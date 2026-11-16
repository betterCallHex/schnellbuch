/// <reference lib="webworker" />
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import {
  NavigationRoute,
  registerRoute,
  setCatchHandler,
} from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { PAGES_CACHE } from "../lib/pages-cache";

declare const self: ServiceWorkerGlobalScope;

const NETWORK_TIMEOUT_SECONDS = 4;
const HOME = "/";

// The app's JavaScript, CSS, fonts and icons, so it opens without a network.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Pages come from the network while online; the last copy of each is kept
// so the app can start offline. The data itself comes from the IndexedDB
// mirror, not from these pages.
const pages = new NetworkFirst({
  cacheName: PAGES_CACHE,
  networkTimeoutSeconds: NETWORK_TIMEOUT_SECONDS,
  plugins: [new CacheableResponsePlugin({ statuses: [200] })],
});
registerRoute(
  new NavigationRoute(pages, {
    // Auth endpoints, agent approval and the save popup need the network.
    denylist: [/^\/api\//u, /^\/connect/u, /^\/add/u, /^\/sign-in/u],
  })
);

// Offline on a page never visited: open the library home instead.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cache = await caches.open(PAGES_CACHE);
    const home = await cache.match(HOME, { ignoreSearch: true });
    if (home) {
      return home;
    }
  }
  return Response.error();
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);
