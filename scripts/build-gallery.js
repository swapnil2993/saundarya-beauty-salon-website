// Scans img/gallery/ and writes img/gallery/manifest.json, which the
// portfolio page reads to render the gallery. Run this after adding or
// removing images from img/gallery/ so the site picks up the change.
//
// On Netlify, this runs automatically on every deploy (see netlify.toml),
// so in practice you just drop new photos into img/gallery/, commit, and
// push - no manual step needed. Run `node scripts/build-gallery.js`
// yourself only if you want to preview the change locally first.
//
// Naming tip: files are listed alphabetically, so prefixing filenames
// with numbers (01-haircut.jpg, 02-facial.jpg, ...) controls the order.

const fs = require('fs');
const path = require('path');

const GALLERY_DIR = path.join(__dirname, '..', 'img', 'gallery');
const MANIFEST_PATH = path.join(GALLERY_DIR, 'manifest.json');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function toAltText(filename) {
    const base = path.parse(filename).name;
    const words = base.replace(/^\d+[-_]*/, '').replace(/[-_]+/g, ' ').trim();
    if (!words) return 'Saundarya Beauty Salon transformation';
    return words.replace(/\b\w/g, c => c.toUpperCase()) + ' - Saundarya Beauty Salon';
}

function main() {
    if (!fs.existsSync(GALLERY_DIR)) {
        console.warn('[gallery] img/gallery/ does not exist, nothing to do.');
        return;
    }

    const files = fs.readdirSync(GALLERY_DIR)
        .filter(name => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const items = files.map(file => ({ file, alt: toAltText(file) }));

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(items, null, 2) + '\n');
    console.log(`[gallery] wrote manifest.json with ${items.length} image(s).`);
}

main();
