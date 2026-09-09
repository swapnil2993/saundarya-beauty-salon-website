// ============================================================
// DYNAMIC RATES LOADER
//
// The price list in rates.html can be edited from a Google Sheet
// instead of touching code. To activate:
//   1. Create a Google Sheet with these column headers in row 1:
//        Category | Service | Price | Note
//      (Note is optional - leave the cell blank if you don't need one.
//       Every row under the same Category becomes one price box.)
//   2. File > Share > Publish to web > choose the sheet > format "CSV" > Publish
//   3. Copy the published link (looks like
//      https://docs.google.com/spreadsheets/d/e/XXXXXXXX/pub?output=csv)
//   4. Paste it below as CSV_URL
//
// Until CSV_URL is filled in, this script does nothing and the page
// just shows the prices written directly in rates.html - nothing breaks
// either way, and the same is true if the sheet is ever unreachable.
// ============================================================
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVQO8BqUbY1BonqPPHFM2ZFfs-GzePCFL0IVxoG6V0dxlkoAt5l4abVPSZkE0NB1su-0d0HlErAwBX/pub?output=csv";

async function loadRatesFromSheet() {
    if (!CSV_URL) return;

    const container = document.getElementById('ratesContainer');
    const syncNote = document.getElementById('ratesSyncNote');
    if (!container) return;

    try {
        const separator = CSV_URL.includes('?') ? '&' : '?';
        const res = await fetch(CSV_URL + separator + 'cachebust=' + Date.now());
        if (!res.ok) throw new Error('Sheet request failed: ' + res.status);

        const text = await res.text();
        const rows = parseCsv(text);
        if (!rows.length) throw new Error('Sheet returned no usable rows');

        const grouped = groupByCategory(rows);
        if (!Object.keys(grouped).length) throw new Error('No valid rows to render');

        container.innerHTML = renderCategories(grouped);
        if (window.initScrollReveal) window.initScrollReveal();
        initRatesCarouselDots();
        if (syncNote) {
            syncNote.textContent = 'Prices live-synced from our price sheet on ' + new Date().toLocaleString();
        }
    } catch (err) {
        console.warn('[rates] Could not load live prices from the sheet, showing the prices saved on the page instead.', err);
    }
}

// ============================================================
// Mobile swipe-carousel dot indicators. The carousel behaviour itself is
// pure CSS (scroll-snap, see MediaQuery.css) - this just keeps a row of
// dots in sync with which card is currently in view, and lets tapping a
// dot jump to that card. Harmless no-op on desktop, where the dots are
// hidden and #ratesContainer isn't a horizontal scroller.
// ============================================================
function initRatesCarouselDots() {
    const container = document.getElementById('ratesContainer');
    const dotsWrap = document.getElementById('ratesCarouselDots');
    if (!container || !dotsWrap) return;

    const cards = [...container.querySelectorAll('.BeautySolutions')];
    if (!cards.length) return;

    dotsWrap.innerHTML = cards.map((_, i) =>
        `<button type="button" aria-label="Go to price card ${i + 1}"></button>`
    ).join('');
    const dots = [...dotsWrap.querySelectorAll('button')];
    dots[0].classList.add('is-active');

    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            cards[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
    });

    // Avoid stacking multiple scroll listeners across repeated live-data reloads.
    if (container.__dotScrollHandler) {
        container.removeEventListener('scroll', container.__dotScrollHandler);
    }

    const handler = () => {
        const containerCenter = container.scrollLeft + container.clientWidth / 2;
        let closestIndex = 0;
        let closestDistance = Infinity;
        cards.forEach((card, i) => {
            const cardCenter = card.offsetLeft + card.offsetWidth / 2;
            const distance = Math.abs(cardCenter - containerCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        });
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === closestIndex));
    };

    container.__dotScrollHandler = handler;
    container.addEventListener('scroll', handler, { passive: true });
}

function parseCsv(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim().length);
    if (!lines.length) return [];

    const header = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const categoryIdx = header.indexOf('category');
    const serviceIdx = header.indexOf('service');
    const priceIdx = header.indexOf('price');
    const noteIdx = header.indexOf('note');

    if (categoryIdx === -1 || serviceIdx === -1 || priceIdx === -1) {
        console.warn('[rates] Sheet is missing required columns: Category, Service, Price');
        return [];
    }

    return lines.slice(1).map(line => {
        const cols = splitCsvLine(line);
        return {
            category: (cols[categoryIdx] || '').trim(),
            service: (cols[serviceIdx] || '').trim(),
            price: (cols[priceIdx] || '').trim(),
            note: noteIdx !== -1 ? (cols[noteIdx] || '').trim() : ''
        };
    }).filter(row => row.category && row.service);
}

// Minimal CSV line splitter that respects quoted fields containing commas
function splitCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function groupByCategory(rows) {
    const grouped = {};
    rows.forEach(row => {
        if (!grouped[row.category]) grouped[row.category] = { services: [], notes: new Set() };
        grouped[row.category].services.push({ service: row.service, price: row.price });
        if (row.note) grouped[row.category].notes.add(row.note);
    });
    return grouped;
}

// Keeps the page's engaging copy consistent even after prices refresh live
// from the Google Sheet. Falls back to no tagline for any category not
// listed here (e.g. a brand new category added straight to the sheet).
const CATEGORY_TAGLINES = {
    'Brow & Face Threading': 'Clean, precise shaping for brows and face — quick and virtually painless.',
    'Classic Facials': 'Everyday facials for a quick refresh — clean, bright, even-toned skin.',
    'Premium Facials': 'Indulgent, ingredient-rich facials for deep rejuvenation and a lasting glow.',
    'Body Waxing': 'Smooth, salon-fresh skin that lasts — choose regular wax or gentle rica wax.',
    'Hair Cuts & Treatments': 'Fresh cuts and treatments styled to match your face shape and personality.',
    'Hair Styling & Saree Draping': 'Perfectly styled for every occasion, from everyday elegance to special events.',
    'Hair Color & Highlights': 'Vibrant, long-lasting color — expertly applied and matched to you.',
    'Makeup & Nail Art': 'From everyday glam to your bridal debut — complete looks for every occasion.'
};

// Same idea as CATEGORY_TAGLINES, keyed by exact service name.
const SERVICE_BADGES = {
    'Korean Facial': '✨ POPULAR',
    'Kanpeki Korean Facial': '🌟 ONCE-A-YEAR MUST-HAVE',
    'Bridal (starts from)': '💍 BRIDAL FAVORITE'
};

function renderCategories(grouped) {
    return Object.entries(grouped).map(([category, data]) => {
        const items = data.services.map(s => {
            const badge = SERVICE_BADGES[s.service]
                ? `<span class="li-badge">${escapeHtml(SERVICE_BADGES[s.service])}</span>`
                : '';
            return `<li><span class="li-name">${escapeHtml(s.service)}${badge}</span><span>${escapeHtml(s.price)}</span></li>`;
        }).join('');
        const notes = [...data.notes].map(n => `<p class="condition">${escapeHtml(n)}</p>`).join('');
        const tagline = CATEGORY_TAGLINES[category]
            ? `<p class="categoryTagline">${escapeHtml(CATEGORY_TAGLINES[category])}</p>`
            : '';
        return `
        <div class="BeautySolutions reveal-on-scroll">
            <h2>${escapeHtml(category)}</h2>
            <span></span>
            ${tagline}
            <ul>
                ${items}
                ${notes}
            </ul>
        </div>`;
    }).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

initRatesCarouselDots();
loadRatesFromSheet();
