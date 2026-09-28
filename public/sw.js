// Todoish's service worker. It makes the app installable and quick to
// start, and it stays out of the way of the data:
//
// - Built assets (/build/*) have a hash in their name, so a cached copy is
//   never stale: cache first.
// - The icons and the offline page are cached when the worker installs.
// - Pages and Inertia requests always go to the server. Your tasks are
//   never served from a cache, so you never see yesterday's list. When the
//   network is gone, a page load gets the offline page instead.
const VERSION = 'todoish-v1';
const SHELL = [
  '/offline.html',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // Inertia visits and JSON: the network, always, untouched.
  if (
    request.headers.has('X-Inertia') ||
    request.headers.get('Accept')?.includes('application/json')
  )
    return;

  if (url.pathname.startsWith('/build/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // A page load: the server, or the offline page when there is none.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html')),
    );
  }
});
