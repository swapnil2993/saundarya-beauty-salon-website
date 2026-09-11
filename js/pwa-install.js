// Shows a custom "Install app" banner instead of relying solely on
// Chrome's own automatic install prompt, since that rarely fires on a
// first visit - e.g. from a Google Business Profile / Maps link, which
// often opens in a Custom Tab that doesn't support it at all, or in
// Chrome itself before enough return-visit "engagement" has built up.
// No-ops entirely in browsers that never fire beforeinstallprompt
// (iOS Safari, desktop-only setups, etc.) since the banner stays hidden.
(function () {
    const DISMISS_KEY = 'pwaInstallDismissedAt';
    const DISMISS_DAYS = 14;

    let deferredPrompt = null;

    const banner = document.getElementById('pwaInstallBanner');
    const installBtn = document.getElementById('pwaInstallBtn');
    const closeBtn = document.getElementById('pwaInstallClose');

    function track(eventName, params) {
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params || {});
        }
    }

    function isDismissedRecently() {
        try {
            const raw = localStorage.getItem(DISMISS_KEY);
            if (!raw) return false;
            return (Date.now() - Number(raw)) / 86400000 < DISMISS_DAYS;
        } catch (e) {
            return false;
        }
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        if (!banner || isStandalone() || isDismissedRecently()) return;
        deferredPrompt = e;
        banner.hidden = false;
    });

    window.addEventListener('appinstalled', function () {
        track('pwa_installed');
        if (banner) banner.hidden = true;
        deferredPrompt = null;
    });

    if (installBtn) {
        installBtn.addEventListener('click', async function () {
            if (!deferredPrompt) return;
            if (banner) banner.hidden = true;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            track('pwa_install_choice', { outcome });
            deferredPrompt = null;
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            try {
                localStorage.setItem(DISMISS_KEY, String(Date.now()));
            } catch (e) { /* ignore (e.g. private browsing) */ }
            if (banner) banner.hidden = true;
            track('pwa_install_dismissed');
        });
    }
})();
