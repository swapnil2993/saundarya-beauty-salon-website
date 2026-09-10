// Sends GA4 events for the actions that actually matter to the business -
// WhatsApp/phone/Instagram/Google-review clicks - via one delegated click
// listener, so any link added later (anywhere on the site) is tracked
// automatically without editing this file again. No-ops silently if GA
// hasn't loaded (e.g. ad blockers), since window.gtag then doesn't exist.
(function () {
    function track(eventName, params) {
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params);
        }
    }

    document.addEventListener('click', function (e) {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href') || '';
        const linkText = (link.textContent || '').trim().slice(0, 100);
        const params = { link_url: href, link_text: linkText, page_path: location.pathname };

        if (href.startsWith('tel:')) {
            track('phone_click', params);
        } else if (href.includes('wa.me') || href.includes('api.whatsapp.com')) {
            track('whatsapp_click', params);
        } else if (href.includes('instagram.com')) {
            track('instagram_click', params);
        } else if (href.includes('g.page') || href.includes('google.com/maps')) {
            track('google_review_click', params);
        }
    });
})();
