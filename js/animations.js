// Loads decorative Lottie animations. Each call is a safe no-op if the
// target container isn't present on the current page, so this same file
// can be included on every page.
function loadLottie(id, path, loop) {
    const el = document.getElementById(id);
    if (!el || typeof lottie === 'undefined') return;
    lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: loop !== false,
        autoplay: true,
        path: path
    });
}

loadLottie('lottie-sparkle-hero', './animations/sparkle.json');
loadLottie('lottie-rose', './animations/rose.json');

// Scroll-reveal: fade + rise elements into view as the visitor scrolls.
// Exposed on window so pages that re-render content after load (like the
// live rates sheet) can re-scan for newly added .reveal-on-scroll elements.
window.initScrollReveal = function () {
    const targets = document.querySelectorAll('.reveal-on-scroll:not(.reveal-bound)');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('is-visible', 'reveal-bound'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    targets.forEach(el => {
        el.classList.add('reveal-bound');
        observer.observe(el);
    });
};

window.initScrollReveal();
