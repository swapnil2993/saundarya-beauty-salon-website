// Renders the portfolio gallery from img/gallery/manifest.json, which lists
// whatever image files currently sit in img/gallery/. To add a new photo:
// drop the file into img/gallery/ and push - manifest.json regenerates
// automatically on Netlify (see scripts/build-gallery.js + netlify.toml).
(function () {
    const MANIFEST_URL = './img/gallery/manifest.json';

    async function loadGallery() {
        const grid = document.getElementById('galleryGrid');
        if (!grid) return;

        try {
            const res = await fetch(MANIFEST_URL + '?cachebust=' + Date.now());
            if (!res.ok) throw new Error('Gallery manifest request failed: ' + res.status);

            const items = await res.json();
            if (!Array.isArray(items) || !items.length) throw new Error('Gallery manifest is empty');

            grid.innerHTML = items.map(item => (
                '<div class="item reveal-on-scroll">' +
                    '<img src="./img/gallery/' + encodeURIComponent(item.file) + '" ' +
                    'alt="' + escapeHtml(item.alt || 'Saundarya Beauty Salon') + '" loading="lazy">' +
                '</div>'
            )).join('');

            if (window.initScrollReveal) window.initScrollReveal();
        } catch (err) {
            console.warn('[gallery] Could not load gallery images.', err);
            grid.innerHTML = '<p class="gallery-empty">Gallery photos coming soon.</p>';
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    loadGallery();
})();
