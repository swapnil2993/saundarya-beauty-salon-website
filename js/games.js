// ============================================================
// PLAY & WIN — salon-themed mini-games
//
// Scoring: every game normalizes its result to a 0-100 point scale.
// The customer's best score across ALL games (stored in localStorage,
// per-browser) determines their reward tier. Update TIERS below to
// change the discount thresholds.
//
// Redemption is manual: the "Claim on WhatsApp" button opens a
// pre-filled WhatsApp message with the customer's score and unlocked
// tier — the salon owner confirms and honors it by hand. There is no
// server, so this is an honor-system flow, not a verified voucher.
// ============================================================

(function () {
    const WHATSAPP_NUMBER = '918087137894';
    const STORAGE_PREFIX = 'saundarya_game_';

    // ---------------- sound effects (Web Audio API, no audio files) ----------------

    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audioCtx = new Ctx();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    // Plays a short tone. notes: array of {freq, start, duration} in seconds from now.
    function playNotes(notes, opts) {
        const ctx = getAudioContext();
        if (!ctx) return;
        const type = (opts && opts.type) || 'sine';
        const volume = (opts && opts.volume) || 0.12;
        const now = ctx.currentTime;

        notes.forEach(function (note) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(note.freq, now + note.start);
            gain.gain.setValueAtTime(0, now + note.start);
            gain.gain.linearRampToValueAtTime(volume, now + note.start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + note.start);
            osc.stop(now + note.start + note.duration + 0.02);
        });
    }

    const SFX = {
        catch: function () { playNotes([{ freq: 880, start: 0, duration: 0.1 }], { type: 'triangle', volume: 0.1 }); },
        click: function () { playNotes([{ freq: 440, start: 0, duration: 0.06 }], { type: 'sine', volume: 0.08 }); },
        match: function () {
            playNotes([
                { freq: 523.25, start: 0, duration: 0.14 },
                { freq: 659.25, start: 0.1, duration: 0.18 }
            ], { type: 'triangle', volume: 0.12 });
        },
        mismatch: function () { playNotes([{ freq: 180, start: 0, duration: 0.18 }], { type: 'sawtooth', volume: 0.07 }); },
        correct: function () {
            playNotes([
                { freq: 523.25, start: 0, duration: 0.12 },
                { freq: 659.25, start: 0.09, duration: 0.12 },
                { freq: 783.99, start: 0.18, duration: 0.2 }
            ], { type: 'triangle', volume: 0.12 });
        },
        wrong: function () {
            playNotes([
                { freq: 300, start: 0, duration: 0.15 },
                { freq: 200, start: 0.12, duration: 0.2 }
            ], { type: 'sawtooth', volume: 0.08 });
        },
        spin: function () { playNotes([{ freq: 600, start: 0, duration: 0.05 }], { type: 'square', volume: 0.05 }); },

        // Each game gets its own distinct victory fanfare so the games feel
        // musically different from one another, not just visually.
        winReaction: function () {
            // bright, bouncy, quick pops
            playNotes([
                { freq: 880, start: 0, duration: 0.09 },
                { freq: 988, start: 0.08, duration: 0.09 },
                { freq: 1175, start: 0.16, duration: 0.22 }
            ], { type: 'triangle', volume: 0.13 });
        },
        winMemory: function () {
            // warm, gentle bell-like chime
            playNotes([
                { freq: 392, start: 0, duration: 0.25 },
                { freq: 523.25, start: 0.14, duration: 0.25 },
                { freq: 659.25, start: 0.28, duration: 0.4 }
            ], { type: 'sine', volume: 0.13 });
        },
        winQuiz: function () {
            // cheerful schoolbell-style ding-ding-ding
            playNotes([
                { freq: 1046.5, start: 0, duration: 0.1 },
                { freq: 1046.5, start: 0.15, duration: 0.1 },
                { freq: 1318.5, start: 0.3, duration: 0.3 }
            ], { type: 'square', volume: 0.09 });
        },
        winWheel: function () {
            // playful carnival glissando
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.4);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.6);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.13, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.7);
        }
    };

    const WIN_SFX = {
        reaction: SFX.winReaction,
        memory: SFX.winMemory,
        quiz: SFX.winQuiz,
        wheel: SFX.winWheel
    };

    const GAMES = {
        reaction: 'Catch the Essentials',
        memory: 'Memory Match',
        quiz: 'Beauty Quiz',
        wheel: 'Spin the Wheel'
    };

    // Highest min first. Max discount is capped at 10%.
    const TIERS = [
        { min: 80, discount: 10 },
        { min: 40, discount: 5 },
        { min: 0, discount: 0 }
    ];

    // ---------------- claim code ----------------
    // Not a substitute for a real backend: WhatsApp's pre-filled message text
    // can still be edited by the customer before sending. This code exists so
    // a casually-edited message is easy to spot — the owner can recompute it
    // (or just eyeball that it "looks right" for the stated tier) rather than
    // trusting free-text alone. Codes are stamped to the day, so the same
    // score/tier produces a fresh code tomorrow.
    function generateClaimCode(discount, score) {
        const day = new Date().toISOString().slice(0, 10);
        const raw = 'SBS-' + discount + '-' + score + '-' + day;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
        }
        const code = (hash % 9000 + 1000);
        return 'SBS' + discount + '-' + code;
    }

    function getTier(score) {
        return TIERS.find(t => score >= t.min);
    }

    function getBest(game) {
        return Number(localStorage.getItem(STORAGE_PREFIX + game + '_best') || 0);
    }

    function setBest(game, score) {
        const current = getBest(game);
        const best = Math.max(current, score);
        localStorage.setItem(STORAGE_PREFIX + game + '_best', String(best));
        return best;
    }

    function getOverallBest() {
        return Math.max(0, ...Object.keys(GAMES).map(getBest));
    }

    function getBestGameName() {
        let bestName = null;
        let bestScore = -1;
        for (const key of Object.keys(GAMES)) {
            const score = getBest(key);
            if (score > bestScore) {
                bestScore = score;
                bestName = GAMES[key];
            }
        }
        return bestName;
    }

    function refreshRewardStatus() {
        const best = getOverallBest();
        const tier = getTier(best);
        const scoreEl = document.getElementById('rewardBestScore');
        const tierEl = document.getElementById('rewardTierLabel');
        const claimBtn = document.getElementById('claimOfferBtn');

        if (scoreEl) scoreEl.textContent = best;
        if (tierEl) tierEl.textContent = tier.discount > 0 ? tier.discount + '% OFF' : 'Play to unlock!';

        if (claimBtn) {
            if (tier.discount > 0) {
                const gameName = getBestGameName();
                const code = generateClaimCode(tier.discount, best);
                const msg = 'Hi! I scored ' + best + ' points playing "' + gameName +
                    '" on your Rates page and unlocked ' + tier.discount + '% OFF! My claim code is ' + code + '.';
                claimBtn.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
                claimBtn.style.display = 'inline-block';
            } else {
                claimBtn.style.display = 'none';
                claimBtn.removeAttribute('href');
            }
        }

        Object.keys(GAMES).forEach(function (key) {
            const el = document.getElementById('best-' + key);
            if (el) {
                const b = getBest(key);
                el.textContent = b > 0 ? b : '—';
            }
        });
    }

    function recordScore(game, rawScore) {
        const points = Math.max(0, Math.min(100, Math.round(rawScore)));
        setBest(game, points);
        refreshRewardStatus();
        return points;
    }

    // ---------------- modal management ----------------

    const modal = document.getElementById('gameModal');
    const modalBody = document.getElementById('gameModalBody');
    let currentGameKey = null;

    function stopActiveGame() {
        if (typeof window.__activeGameCleanup === 'function') {
            window.__activeGameCleanup();
        }
        window.__activeGameCleanup = null;
    }

    function setWhatsAppFloatVisible(visible) {
        const btn = document.querySelector('.whatsapp-float');
        if (btn) btn.style.display = visible ? '' : 'none';
    }

    function openModal(html) {
        modalBody.innerHTML = html;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        setWhatsAppFloatVisible(false);
    }

    function closeModal() {
        stopActiveGame();
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        modalBody.innerHTML = '';
        setWhatsAppFloatVisible(true);
    }

    if (modal) {
        modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
            el.addEventListener('click', closeModal);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
        });
    }

    function showResult(gameName, rawResultText, points) {
        stopActiveGame();
        const fanfare = WIN_SFX[currentGameKey];
        if (fanfare) fanfare();

        // The claimable reward is always based on the customer's overall best
        // across every game (unlimited plays, best score counts) — not just
        // this single round.
        const overallBest = getOverallBest();
        const tier = getTier(overallBest);
        const isNewBest = overallBest === points && points > 0;

        let tierHtml;
        if (tier.discount > 0) {
            const code = generateClaimCode(tier.discount, overallBest);
            tierHtml =
                '<p class="game-result-tier">Your reward tier: <b>' + tier.discount + '% OFF</b></p>' +
                '<p class="game-claim-code">Claim code: <b>' + code + '</b></p>' +
                '<a class="btn claimOfferBtn game-result-claim" target="_blank" rel="noopener" ' +
                'href="https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
                    'Hi! I scored ' + overallBest + ' points playing "' + getBestGameName() +
                    '" on your Rates page and unlocked ' + tier.discount + '% OFF! My claim code is ' + code + '.'
                ) + '">Claim on WhatsApp</a>';
        } else {
            tierHtml = '<p class="game-result-tier">Score 40+ points (in any game) to unlock a reward!</p>';
        }

        modalBody.innerHTML =
            '<h2 class="game-title">Nice One! 🎉</h2>' +
            '<p class="game-result-line">' + gameName + ': <b>' + rawResultText + '</b></p>' +
            '<p class="game-result-points">You earned <b>' + points + '</b> points' +
            (isNewBest ? ' — new personal best!' : '') + '</p>' +
            tierHtml +
            '<div class="game-result-actions">' +
            '<button class="btn" data-play-again>Play Again</button>' +
            '<button class="btn btn-outline" data-close-modal>Close</button>' +
            '</div>';

        modalBody.querySelector('[data-play-again]').addEventListener('click', function () {
            GAME_STARTERS[currentGameKey]();
        });
        modalBody.querySelector('[data-close-modal]').addEventListener('click', closeModal);
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }

    // ================================================================
    // GAME 1: Catch the Essentials (reaction / timing)
    // ================================================================

    function startReactionGame() {
        openModal(
            '<h2 class="game-title">Catch the Essentials</h2>' +
            '<p class="game-instructions">Click the falling items before they hit the bottom! 20 seconds on the clock.</p>' +
            '<div class="game-hud"><span>Score: <b id="reactionScore">0</b></span><span>Time: <b id="reactionTime">20</b>s</span></div>' +
            '<div class="reactionArena" id="reactionArena"></div>'
        );

        const arena = document.getElementById('reactionArena');
        const scoreEl = document.getElementById('reactionScore');
        const timeEl = document.getElementById('reactionTime');
        const items = ['💄', '💅', '🌸', '🧴', '✂️', '💇'];
        let score = 0;
        let timeLeft = 20;

        function spawnItem() {
            const el = document.createElement('button');
            el.className = 'fallingItem';
            el.type = 'button';
            el.textContent = items[Math.floor(Math.random() * items.length)];
            el.style.left = Math.random() * 85 + '%';
            const duration = 2 + Math.random() * 1.5;
            el.style.animationDuration = duration + 's';
            el.addEventListener('animationend', function () {
                if (el.parentNode) el.remove();
            });
            el.addEventListener('click', function () {
                score++;
                scoreEl.textContent = score;
                SFX.catch();
                el.remove();
            });
            arena.appendChild(el);
        }

        const spawnInterval = setInterval(spawnItem, 700);
        const timerInterval = setInterval(function () {
            timeLeft--;
            timeEl.textContent = timeLeft;
            if (timeLeft <= 0) endGame();
        }, 1000);

        function endGame() {
            clearInterval(spawnInterval);
            clearInterval(timerInterval);
            arena.querySelectorAll('.fallingItem').forEach(function (el) { el.remove(); });
            const points = recordScore('reaction', score * 100 / 15);
            showResult(GAMES.reaction, score + ' caught', points);
        }

        window.__activeGameCleanup = function () {
            clearInterval(spawnInterval);
            clearInterval(timerInterval);
        };
    }

    // ================================================================
    // GAME 2: Memory Match
    // ================================================================

    function startMemoryGame() {
        const symbols = ['💄', '✂️', '💅', '🌸', '🧴', '💇', '🧖', '👄'];
        const cards = shuffle(symbols.concat(symbols));

        openModal(
            '<h2 class="game-title">Memory Match</h2>' +
            '<p class="game-instructions">Flip two cards at a time and find all 8 matching pairs in as few moves as possible.</p>' +
            '<div class="game-hud"><span>Moves: <b id="memoryMoves">0</b></span></div>' +
            '<div class="memoryGrid" id="memoryGrid"></div>'
        );

        const grid = document.getElementById('memoryGrid');
        const movesEl = document.getElementById('memoryMoves');
        let moves = 0;
        let flipped = [];
        let matched = 0;
        let lock = false;

        cards.forEach(function (symbol) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'memoryCard';
            card.dataset.symbol = symbol;
            card.innerHTML =
                '<span class="memoryCard-back">✨</span>' +
                '<span class="memoryCard-front">' + symbol + '</span>';
            card.addEventListener('click', function () { flipCard(card); });
            grid.appendChild(card);
        });

        function flipCard(card) {
            if (lock || card.classList.contains('is-flipped') || card.classList.contains('is-matched')) return;
            card.classList.add('is-flipped');
            SFX.click();
            flipped.push(card);
            if (flipped.length === 2) {
                moves++;
                movesEl.textContent = moves;
                lock = true;
                const a = flipped[0];
                const b = flipped[1];
                if (a.dataset.symbol === b.dataset.symbol) {
                    a.classList.add('is-matched');
                    b.classList.add('is-matched');
                    flipped = [];
                    lock = false;
                    matched++;
                    SFX.match();
                    if (matched === symbols.length) endGame();
                } else {
                    SFX.mismatch();
                    setTimeout(function () {
                        a.classList.remove('is-flipped');
                        b.classList.remove('is-flipped');
                        flipped = [];
                        lock = false;
                    }, 800);
                }
            }
        }

        function endGame() {
            const points = recordScore('memory', Math.max(20, 100 - (moves - 8) * 6));
            showResult(GAMES.memory, moves + ' moves', points);
        }

        window.__activeGameCleanup = function () {};
    }

    // ================================================================
    // GAME 3: Beauty Quiz
    // ================================================================

    const QUIZ_QUESTIONS = [
        {
            q: 'How often is it generally recommended to replace your makeup sponge or beauty blender?',
            options: ['Every 3-4 months', 'Once a year', 'Every 3 years', "They don't need replacing"],
            answer: 0
        },
        {
            q: 'Which of these is usually the first step in a skincare routine?',
            options: ['Applying sunscreen', 'Cleansing', 'Exfoliating', 'Applying lipstick'],
            answer: 1
        },
        {
            q: 'What is a "patch test" used for before a new hair color or skincare product?',
            options: ['Checking the exact shade', 'Checking for allergic reactions', 'Checking the scent', 'Checking the price'],
            answer: 1
        },
        {
            q: 'Which of these best helps protect skin from daily sun damage?',
            options: ['Moisturizer only', 'Sunscreen (SPF)', 'Perfume', 'Hair oil'],
            answer: 1
        },
        {
            q: 'For healthy, shiny hair, how often is a deep-conditioning hair spa commonly recommended?',
            options: ['Every day', 'Every 2-4 weeks', 'Once a year', "It's never needed"],
            answer: 1
        }
    ];

    function startQuizGame() {
        let current = 0;
        let correct = 0;
        renderQuestion();

        function renderQuestion() {
            const q = QUIZ_QUESTIONS[current];
            openModal(
                '<h2 class="game-title">Beauty Quiz</h2>' +
                '<p class="game-instructions">Question ' + (current + 1) + ' of ' + QUIZ_QUESTIONS.length + '</p>' +
                '<p class="quiz-question">' + q.q + '</p>' +
                '<div class="quiz-options">' +
                q.options.map(function (opt, i) {
                    return '<button type="button" class="quiz-option" data-index="' + i + '">' + opt + '</button>';
                }).join('') +
                '</div>'
            );
            modalBody.querySelectorAll('.quiz-option').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    selectAnswer(Number(btn.dataset.index), btn);
                });
            });
        }

        function selectAnswer(index, btn) {
            const q = QUIZ_QUESTIONS[current];
            const allBtns = modalBody.querySelectorAll('.quiz-option');
            allBtns.forEach(function (b) { b.disabled = true; });
            if (index === q.answer) {
                btn.classList.add('is-correct');
                correct++;
                SFX.correct();
            } else {
                btn.classList.add('is-wrong');
                allBtns[q.answer].classList.add('is-correct');
                SFX.wrong();
            }
            setTimeout(function () {
                current++;
                if (current < QUIZ_QUESTIONS.length) {
                    renderQuestion();
                } else {
                    endGame();
                }
            }, 1000);
        }

        function endGame() {
            const points = recordScore('quiz', correct * 100 / QUIZ_QUESTIONS.length);
            showResult(GAMES.quiz, correct + '/' + QUIZ_QUESTIONS.length + ' correct', points);
        }

        window.__activeGameCleanup = function () {};
    }

    // ================================================================
    // GAME 4: Spin the Wheel
    // ================================================================

    const WHEEL_SEGMENTS = [20, 40, 60, 20, 80, 40, 100, 60];
    const WHEEL_COLORS = ['#1a1a1a', '#B8860B'];
    const WHEEL_LABEL_COLORS = ['#F8D856', '#1a1a1a'];

    function polarToCartesian(cx, cy, r, angleDeg) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function describeSlice(cx, cy, r, startAngle, endAngle) {
        const start = polarToCartesian(cx, cy, r, endAngle);
        const end = polarToCartesian(cx, cy, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y, 'Z'].join(' ');
    }

    function buildWheelSvg(segments) {
        const cx = 100, cy = 100, r = 95;
        const segCount = segments.length;
        const segAngle = 360 / segCount;
        let paths = '';
        let labels = '';

        segments.forEach(function (value, i) {
            const startAngle = i * segAngle;
            const endAngle = (i + 1) * segAngle;
            paths += '<path d="' + describeSlice(cx, cy, r, startAngle, endAngle) +
                '" fill="' + WHEEL_COLORS[i % WHEEL_COLORS.length] + '" stroke="#fff" stroke-width="2"></path>';
            const mid = startAngle + segAngle / 2;
            const pos = polarToCartesian(cx, cy, r * 0.62, mid);
            const labelColor = WHEEL_LABEL_COLORS[i % WHEEL_COLORS.length];
            labels += '<text x="' + pos.x + '" y="' + pos.y +
                '" fill="' + labelColor + '" font-size="15" font-weight="700" text-anchor="middle" dominant-baseline="middle">' +
                value + '</text>';
        });

        return '<svg viewBox="0 0 200 200" class="wheelSvg" id="wheelEl">' +
            '<circle cx="100" cy="100" r="96" fill="none" stroke="#B8860B" stroke-width="7"></circle>' +
            paths + labels + '</svg>';
    }

    function startWheelGame() {
        const segCount = WHEEL_SEGMENTS.length;
        const segAngle = 360 / segCount;

        openModal(
            '<h2 class="game-title">Spin the Wheel</h2>' +
            '<p class="game-instructions">Tap spin for a random points reward!</p>' +
            '<div class="wheelWrap">' +
            '<div class="wheelPointer">▼</div>' +
            buildWheelSvg(WHEEL_SEGMENTS) +
            '</div>' +
            '<button type="button" class="btn" id="spinBtn">Spin the Wheel</button>'
        );

        const wheel = document.getElementById('wheelEl');
        const spinBtn = document.getElementById('spinBtn');
        let spinning = false;
        let currentRotation = 0;
        let spinTimeout = null;
        let tickInterval = null;

        spinBtn.addEventListener('click', function () {
            if (spinning) return;
            spinning = true;
            spinBtn.disabled = true;

            let tickCount = 0;
            tickInterval = setInterval(function () {
                SFX.spin();
                tickCount++;
                if (tickCount >= 14) clearInterval(tickInterval);
            }, 280);

            const targetIndex = Math.floor(Math.random() * segCount);
            const targetValue = WHEEL_SEGMENTS[targetIndex];
            const targetAngle = 360 - (targetIndex * segAngle + segAngle / 2);
            const spins = 5 * 360;
            const delta = ((targetAngle - (currentRotation % 360)) + 360) % 360;
            currentRotation += spins + delta;
            wheel.style.transform = 'rotate(' + currentRotation + 'deg)';

            spinTimeout = setTimeout(function () {
                const points = recordScore('wheel', targetValue);
                showResult(GAMES.wheel, targetValue + ' points spun', points);
                spinning = false;
                spinBtn.disabled = false;
            }, 4200);
        });

        window.__activeGameCleanup = function () {
            if (spinTimeout) clearTimeout(spinTimeout);
            if (tickInterval) clearInterval(tickInterval);
        };
    }

    // ---------------- wire up ----------------

    const GAME_STARTERS = {
        reaction: startReactionGame,
        memory: startMemoryGame,
        quiz: startQuizGame,
        wheel: startWheelGame
    };

    document.querySelectorAll('[data-open-game]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            SFX.click();
            currentGameKey = btn.dataset.openGame;
            GAME_STARTERS[currentGameKey]();
        });
    });

    refreshRewardStatus();

    // ---------------- collapsible Play & Win section ----------------

    const playWinToggle = document.getElementById('playWinToggle');
    const playWinCollapsible = document.getElementById('playWinCollapsible');
    const playWinCollapseBtn = document.getElementById('playWinCollapseBtn');

    if (playWinToggle && playWinCollapsible) {
        playWinToggle.addEventListener('click', function () {
            SFX.click();
            playWinCollapsible.classList.add('is-open');
            playWinToggle.setAttribute('aria-expanded', 'true');
            playWinToggle.style.display = 'none';
            setTimeout(function () {
                playWinCollapsible.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        });
    }

    if (playWinCollapseBtn && playWinCollapsible && playWinToggle) {
        playWinCollapseBtn.addEventListener('click', function () {
            playWinCollapsible.classList.remove('is-open');
            playWinToggle.setAttribute('aria-expanded', 'false');
            playWinToggle.style.display = '';
            playWinToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }
})();
