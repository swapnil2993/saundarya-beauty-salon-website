// Background ambient music for the Rates page, with a persistent mute toggle.
// Starts muted (browsers block audible autoplay anyway) - the button is the
// first user gesture that's allowed to turn sound on.
(function () {
    const audio = document.getElementById('bgMusic');
    const toggleBtn = document.getElementById('musicToggle');
    const icon = document.getElementById('musicToggleIcon');
    if (!audio || !toggleBtn || !icon) return;

    const STORAGE_KEY = 'saundarya_music_muted';
    audio.volume = 0.35;

    function getStoredMuted() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === null ? true : stored === 'true';
    }

    function applyState(muted) {
        audio.muted = muted;
        toggleBtn.setAttribute('aria-pressed', String(!muted));
        toggleBtn.setAttribute('aria-label', muted ? 'Play background music' : 'Mute background music');
        toggleBtn.classList.toggle('is-playing', !muted);
        icon.textContent = muted ? '🔇' : '🔊';
    }

    let muted = getStoredMuted();
    applyState(muted);

    // Attempt to start playback (muted autoplay is allowed everywhere).
    audio.play().catch(function () {
        // Autoplay blocked entirely - playback will start on the user's
        // first click on the toggle button instead.
    });

    toggleBtn.addEventListener('click', function () {
        muted = !muted;
        applyState(muted);
        localStorage.setItem(STORAGE_KEY, String(muted));
        if (!muted) {
            audio.play().catch(function () {
                // If this still fails there's nothing more we can do without
                // another user gesture.
            });
        }
    });
})();
