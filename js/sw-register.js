// Registers the service worker (sw.js) that powers offline support and
// PWA installability. Silently does nothing in browsers without support.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function (err) {
            console.warn('[sw] registration failed', err);
        });
    });
}
