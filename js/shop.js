// Renders the Shop page live from the affiliate spreadsheet - nothing is
// baked into the site, so editing the sheet updates the page on the next
// visit with no deploy.
//
// The sheet must be shared as "Anyone with the link: Viewer" so visitors'
// browsers can read it (otherwise Google returns 401 and the shop is empty).
// Columns (row 1 = headers): category, title, image, link
// (No price column: Amazon doesn't allow showing prices that aren't pulled
// live from its API, so cards link out for the current price instead.)
//   category - Beauty Products | Electronics | Fashion | Miscellaneous
//   image    - full https:// image URL
//   link     - the affiliate link the card opens in a new tab
// Rows with an unknown category or a missing title/image/link are skipped.
(function () {
    const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1XxHUVj1PgzcIphlNj2YcEYKP0TjmrwtdnkIIXYfo5bo/gviz/tq?tqx=out:csv&gid=1242513158';
    // Amazon rejects sites whose Amazon links lack the Associates tracking ID,
    // so every amazon.* link in the sheet gets this tag, replacing any other tag=
    // (e.g. one left over from the old rejected account).
    const AMAZON_TAG = 'saundaryare09-21';
    const CACHE_KEY = 'saundarya-shop-csv';
    const CATEGORIES = [
        { id: 'beauty', label: 'Beauty Products', aliases: ['beauty products', 'beauty'] },
        { id: 'electronics', label: 'Electronics', aliases: ['electronics'] },
        { id: 'fashion', label: 'Fashion', aliases: ['fashion'] },
        { id: 'miscellaneous', label: 'Miscellaneous', aliases: ['miscellaneous', 'misc'] }
    ];

    const grid = document.getElementById('shopGrid');
    const tabs = document.getElementById('shopTabs');
    if (!grid || !tabs) return;

    let products = [];
    let active = CATEGORIES[0].id;

    function esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    function renderTabs() {
        tabs.innerHTML = CATEGORIES.map(c => {
            const count = products.filter(p => p.category === c.id).length;
            return '<button type="button" role="tab" class="shopTab' + (c.id === active ? ' active' : '') +
                '" data-cat="' + c.id + '" aria-selected="' + (c.id === active) + '">' +
                esc(c.label) + ' <span class="shopTab-count">' + count + '</span></button>';
        }).join('');
    }

    function renderGrid() {
        const items = products.filter(p => p.category === active);
        if (!items.length) {
            grid.innerHTML = '<p class="shop-empty">Products coming soon in this category.</p>';
            return;
        }
        grid.innerHTML = items.map(p => (
            '<a class="productCard" href="' + esc(p.link) + '" target="_blank" rel="sponsored nofollow noopener" ' +
            'data-product="' + esc(p.title) + '" data-category="' + esc(p.category) + '">' +
                '<div class="productCard-img"><img src="' + esc(p.image) + '" alt="' + esc(p.title) +
                '" loading="lazy" referrerpolicy="no-referrer"></div>' +
                '<div class="productCard-body">' +
                    '<h3>' + esc(p.title) + '</h3>' +
                    '<span class="productCard-btn">View &amp; Buy &rarr;</span>' +
                '</div>' +
            '</a>'
        )).join('');
    }

    tabs.addEventListener('click', function (e) {
        const btn = e.target.closest('.shopTab');
        if (!btn) return;
        active = btn.dataset.cat;
        renderTabs();
        renderGrid();
    });

    grid.addEventListener('click', function (e) {
        const card = e.target.closest('.productCard');
        if (card && typeof window.gtag === 'function') {
            window.gtag('event', 'affiliate_click', {
                product_name: card.dataset.product,
                product_category: card.dataset.category,
                link_url: card.getAttribute('href')
            });
        }
    });

    // Minimal CSV parser: quoted fields, escaped quotes, commas/newlines in quotes.
    function parseCsv(text) {
        const rows = [];
        let row = [], field = '', inQuotes = false;
        text = text.replace(/^\uFEFF/, '');
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
                else if (c === '"') inQuotes = false;
                else field += c;
            } else if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                rows.push(row); row = [];
            } else field += c;
        }
        if (field || row.length) { row.push(field); rows.push(row); }
        return rows.filter(r => r.some(cell => cell.trim()));
    }

    function withAmazonTag(url) {
        try {
            const u = new URL(url);
            if (/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname) && u.searchParams.get('tag') !== AMAZON_TAG) {
                u.searchParams.set('tag', AMAZON_TAG);
                return u.toString();
            }
        } catch (e) { /* leave the link untouched */ }
        return url;
    }

    function toProducts(csv) {
        const [header, ...rows] = parseCsv(csv);
        if (!header) return [];
        const col = name => header.findIndex(h => h.trim().toLowerCase() === name);
        const idx = { category: col('category'), title: col('title'), image: col('image'), link: col('link'), price: col('price') };
        const get = (r, k) => (idx[k] === -1 ? '' : (r[idx[k]] || '').trim());
        const out = [];
        rows.forEach(r => {
            const label = get(r, 'category').toLowerCase();
            const cat = CATEGORIES.find(c => c.aliases.includes(label));
            const p = { category: cat && cat.id, title: get(r, 'title'), image: get(r, 'image'), link: withAmazonTag(get(r, 'link')) };
            // Only http(s) URLs: the sheet is editable by others, so never render javascript: links.
            if (p.category && p.title && /^https?:\/\//i.test(p.image) && /^https?:\/\//i.test(p.link)) out.push(p);
        });
        return out;
    }

    async function fetchCsv() {
        if (!SHEET_CSV_URL) throw new Error('SHEET_CSV_URL not configured');
        try {
            const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error('Request failed: ' + res.status);
            const text = await res.text();
            try { localStorage.setItem(CACHE_KEY, text); } catch (e) { /* storage unavailable */ }
            return text;
        } catch (err) {
            // Offline / sheet unreachable: fall back to the last successful copy.
            let cached = null;
            try { cached = localStorage.getItem(CACHE_KEY); } catch (e) { /* ignore */ }
            if (cached) return cached;
            throw err;
        }
    }

    async function load() {
        try {
            products = toProducts(await fetchCsv());
            const first = CATEGORIES.find(c => products.some(p => p.category === c.id));
            if (first) active = first.id;
        } catch (err) {
            console.warn('[shop] Could not load products.', err);
            products = [];
        }
        renderTabs();
        renderGrid();
    }

    load();
})();
