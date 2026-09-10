// Service worker for offline support. Bump CACHE_VERSION whenever the
// precached file list below changes, so old caches get cleaned up and
// visitors pick up the new set on their next visit.
const CACHE_VERSION = 'saundarya-v1';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/about.html',
    '/services.html',
    '/portfolio.html',
    '/contact.html',
    '/rates.html',
    '/offline.html',
    '/manifest.webmanifest',
    '/css/style.css',
    '/css/about.css',
    '/css/services.css',
    '/css/porfolio.css',
    '/css/contact.css',
    '/css/rates.css',
    '/css/MediaQuery.css',
    '/js/script.js',
    '/js/analytics-events.js',
    '/js/animations.js',
    '/js/gallery.js',
    '/js/games.js',
    '/js/music.js',
    '/js/rates.js',
    '/img/logo-icon.png',
    '/img/logo-transparent.png',
    '/img/favicon-32.png',
    '/img/favicon-180.png',
    '/img/pwa-icon-192.png',
    '/img/pwa-icon-512.png',
    '/img/background180.svg',
    '/animations/sparkle.json',
    '/animations/rose.json'
];

// Home and Rates are the two pages visitors rely on most - their own
// content images/audio are runtime-cached the first time they're
// fetched (see the fetch handler below), so they don't bloat every
// visitor's initial install, but are just as available offline once
// either page has been opened while online.

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(
                    keys.filter(function (key) { return key !== CACHE_VERSION; })
                        .map(function (key) { return caches.delete(key); })
                );
            })
            .then(function () { return self.clients.claim(); })
    );
});

// Same-origin GET requests: try the network first (so visitors online
// always get the latest content), falling back to whatever's cached when
// offline. Navigation requests additionally fall back to offline.html if
// nothing cached matches.
self.addEventListener('fetch', function (event) {
    const request = event.request;
    if (request.method !== 'GET') return;
    if (new URL(request.url).origin !== self.location.origin) return;

    const isNavigation = request.mode === 'navigate';

    event.respondWith(
        fetch(request)
            .then(function (response) {
                const copy = response.clone();
                caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
                return response;
            })
            .catch(function () {
                return caches.match(request).then(function (cached) {
                    if (cached) return cached;
                    if (isNavigation) return caches.match('/offline.html');
                    return undefined;
                });
            })
    );
});
