// --- Gemeinsame Utilities ---
// Jahr setzen
(function setYear() {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
})();

// Clipboard fallback & toast
function copyToClipboardFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
}
function showToast(message) {
    const t = document.createElement('div');
    t.textContent = message;
    Object.assign(t.style, {
        position: 'fixed', right: '1rem', bottom: '1rem', padding: '0.5rem 0.75rem',
        background: 'rgba(0,0,0,0.85)', color: '#fff', borderRadius: '6px', zIndex: 9999,
        fontSize: '0.9rem', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', transition: 'opacity 0.3s ease'
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; }, 1400);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 1800);
}

function copyDiscountCode(event) {
    try {
        const link = event.currentTarget || event.target;
        const code = link && link.dataset && link.dataset.code;
        if (!code) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => showToast('Rabattcode kopiert: ' + code)).catch(() => { copyToClipboardFallback(code); showToast('Rabattcode kopiert: ' + code); });
        } else {
            copyToClipboardFallback(code);
            showToast('Rabattcode kopiert: ' + code);
        }
    } catch (e) {
        console.warn('copyDiscountCode failed', e);
    }
}

// Kalender postMessage (weich)
(function tryCalendarMessage() {
    const iframe = document.getElementById('calendar-iframe');
    if (!iframe) return;
    iframe.addEventListener('load', function () {
        try { iframe.contentWindow.postMessage({type: 'setView', view: 'list'}, '*'); } catch (e) { console.warn('postMessage to calendar iframe failed', e); }
    });
})();

// --- Mobile toggle, donations loader + interactions ---
(function mobileToggleAndDonations() {
    const linksBtn = document.getElementById('mobile-links-btn');
    const liveBtn = document.getElementById('mobile-live-btn');
    const donationEmbed = document.getElementById('donation-embed');
    if (!linksBtn || !liveBtn || !donationEmbed) {
        // nothing to wire
        return;
    }

    const mq = window.matchMedia('(max-width:720px)');
    let donationsLoaded = false;

    function setMobileView(mode) {
        if (mode === 'live') {
            document.body.classList.add('mobile-live');
            document.body.classList.remove('mobile-links');
            liveBtn.classList.add('active'); linksBtn.classList.remove('active');
            liveBtn.setAttribute('aria-selected', 'true'); linksBtn.setAttribute('aria-selected', 'false');
            if (!donationsLoaded) loadDonations();
            // ensure embeds and visibility are correct for mobile live
            try { setTwitchEmbeds(); } catch(e) {}
            try { updateEmbedDisplayForMobile(); } catch(e) {}
            // Force live-section visible and chat visible
            try {
                const liveSection = document.getElementById('live-section');
                if (liveSection) liveSection.style.display = 'block';
                const chatWrap = document.querySelector('.responsive-embed.chat');
                if (chatWrap) chatWrap.style.display = 'block';
            } catch (e) { /* ignore */ }
        } else {
            document.body.classList.add('mobile-links');
            document.body.classList.remove('mobile-live');
            linksBtn.classList.add('active'); liveBtn.classList.remove('active');
            liveBtn.setAttribute('aria-selected', 'false'); linksBtn.setAttribute('aria-selected', 'true');
            // update visibility when switching away from live
            try { updateEmbedDisplayForMobile(); } catch(e) {}
            // Force live-section hidden when in links mode on mobile
            try { const liveSection = document.getElementById('live-section'); if (liveSection) liveSection.style.display = 'none'; } catch(e) {}
        }
        try { localStorage.setItem('mobileView', mode); } catch (e) {}
    }

    function applyInitial() {
        if (!mq.matches) { document.body.classList.remove('mobile-live', 'mobile-links'); linksBtn.classList.remove('active'); liveBtn.classList.remove('active'); return; }
        const saved = (function(){ try { return localStorage.getItem('mobileView'); } catch(e){ return null; } })() || 'links';
        setMobileView(saved);
    }

    // Control donation-embed visibility: always hide on desktop; show only in mobile-live
    function updateDonationVisibility() {
        try {
            if (!donationEmbed) return;
            if (!mq.matches) {
                // desktop: ensure hidden
                donationEmbed.style.display = 'none';
            } else {
                // mobile: show only when mobile-live body class present
                if (document.body.classList.contains('mobile-live')) donationEmbed.style.display = 'block'; else donationEmbed.style.display = 'none';
            }
        } catch (e) { console.warn('updateDonationVisibility failed', e); }
    }

    // Ensure chat/player are visible on mobile live and set iframe srcs if missing
    function updateEmbedDisplayForMobile() {
        try {
            const playerWrap = document.querySelector('.responsive-embed.player');
            const chatWrap = document.querySelector('.responsive-embed.chat');
            const playerIframe = document.querySelector('.twitch-player-iframe');
            const chatIframe = document.querySelector('.twitch-chat-iframe');

            if (!mq.matches) {
                // Desktop: keep default layout (chat on right). Ensure chat visible via CSS grid.
                if (chatWrap) chatWrap.style.display = '';
                if (playerWrap) playerWrap.style.flex = '1 1 0';
            } else {
                // Mobile: stack vertically; when mobile-live show both stacked
                if (document.body.classList.contains('mobile-live')) {
                    if (chatWrap) chatWrap.style.display = 'block';
                    if (playerWrap) playerWrap.style.display = 'block';
                    // ensure iframe srcs are set
                    setTwitchEmbeds();
                } else {
                    // links view: hide live area
                    if (chatWrap) chatWrap.style.display = 'none';
                }
            }
        } catch (e) { console.warn('updateEmbedDisplayForMobile failed', e); }
    }

    // Set Twitch iframe srcs using correct parent (current hostname)
    function setTwitchEmbeds() {
        try {
            const host = location.hostname || 'localhost';
            const player = document.querySelector('.twitch-player-iframe');
            const chat = document.querySelector('.twitch-chat-iframe');
            const channel = (player && player.dataset && player.dataset.channel) || (chat && chat.dataset && chat.dataset.channel) || 'hd1920x1080';
            if (player && (!player.src || player.src.indexOf('twitch.tv') === -1)) {
                player.src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}&muted=true`;
            } else if (player) {
                // always ensure parent matches host
                player.src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(host)}&muted=true`;
            }
            if (chat && (!chat.src || chat.src.indexOf('twitch.tv') === -1)) {
                chat.src = `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?parent=${encodeURIComponent(host)}&darkpopout`;
            } else if (chat) {
                chat.src = `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?parent=${encodeURIComponent(host)}&darkpopout`;
            }
            // attach load/error handlers and fallback for chat iframe
            try {
                if (chat) {
                    const chatWrap = document.querySelector('.responsive-embed.chat');
                    let settled = false;
                    const onLoad = () => { settled = true; if (chatWrap) chatWrap.style.display = 'block'; chat.removeEventListener('load', onLoad); chat.removeEventListener('error', onError); };
                    const onError = () => { settled = true; if (chatWrap) { chatWrap.style.display = 'block'; /* fallback link already present in DOM */ } chat.removeEventListener('load', onLoad); chat.removeEventListener('error', onError); };
                    chat.addEventListener('load', onLoad);
                    chat.addEventListener('error', onError);
                    // small timeout: if still not settled, show fallback UI
                    setTimeout(() => { if (!settled) { if (chatWrap) chatWrap.style.display = 'block'; /* show fallback link area (static in HTML) */ } }, 1200);
                }
            } catch (e) { /* ignore */ }
         } catch (e) { console.warn('setTwitchEmbeds failed', e); }
    }

    async function loadDonations() {
        donationsLoaded = true; // avoid repeated calls
        donationEmbed.innerHTML = '<div class="loading">Lade Spenden-Übersicht…</div>';
        try {
            const resp = await fetch('streamelements.html');
            if (!resp.ok) throw new Error('Network error');
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const contentDiv = doc.querySelector('main.container > div');
            if (!contentDiv) throw new Error('Content not found');

            // Build fragment with header, triggers list and tip-link (no intro/description)
            const triggers = contentDiv.querySelector('.triggers-list');
            const header = contentDiv.querySelector('.page-title');
            const fragment = document.createDocumentFragment();
            if (header) { const h = document.createElement('h3'); h.textContent = header.textContent || 'Donations'; fragment.appendChild(h); }
            if (triggers) fragment.appendChild(triggers.cloneNode(true));
            // Also append a direct link to streamelements tip page
            const seLink = document.createElement('a');
            seLink.className = 'link-card';
            seLink.href = 'https://streamelements.com/hd1920x1080-5003/tip';
            seLink.target = '_blank';
            seLink.rel = 'noopener noreferrer';
            seLink.style.display = 'inline-block';
            seLink.style.marginTop = '0.5rem';
            seLink.innerHTML = `
                <img src="img/StreamElements.png" alt="StreamElements" class="icon">
                <div class="card-text">
                    <strong>StreamElements</strong>
                    <span>Donation</span>
                </div>`;
            fragment.appendChild(seLink);

            donationEmbed.innerHTML = '';
            donationEmbed.appendChild(fragment);

            // Bring modal (if present) or create a minimal one
            const fetchedModal = doc.getElementById('donationModal');
            if (fetchedModal) {
                const existing = document.getElementById('donationModal'); if (existing) existing.remove();
                document.body.appendChild(fetchedModal.cloneNode(true));
            } else {
                if (!document.getElementById('donationModal')) {
                    const modalHtml = document.createElement('div');
                    modalHtml.id = 'donationModal'; modalHtml.className = 'modal';
                    modalHtml.innerHTML = '<div class="modal-content">\n<h2 id="modalHeader"></h2>\n<p id="modalText"></p>\n<audio id="modalAudio" controls style="display:none" preload="none"></audio>\n<div class="modal-buttons"><button id="closeModal" class="btn close-btn">Schließen</button></div>\n</div>';
                    document.body.appendChild(modalHtml);
                }
            }

            // Attach interactions
            attachDonationInteractions(donationEmbed);
            // ensure embeds have correct src (in case load happened after initial load)
            setTwitchEmbeds();
            // Update visibility after loading
            updateDonationVisibility();
        } catch (err) {
            console.warn('loadDonations failed', err);
            donationEmbed.innerHTML = '<div>Spenden-Übersicht konnte nicht geladen werden. <a href="streamelements.html">Zur Donation-Seite</a></div>';
        }
    }

    function attachDonationInteractions(root) {
        try {
            const modal = document.getElementById('donationModal');
            const modalAudio = modal ? modal.querySelector('#modalAudio') : null;
            const modalText = modal ? modal.querySelector('#modalText') : null;
            const modalHeader = modal ? modal.querySelector('#modalHeader') : null;
            const closeBtn = modal ? modal.querySelector('#closeModal') : null;

            if (closeBtn) closeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; if (modalAudio) { modalAudio.pause(); try { modalAudio.currentTime = 0; } catch(e){} } });
            if (modal) modal.addEventListener('click', e => { if (e.target === modal) { closeBtn && closeBtn.click(); } });

            const items = (root || document).querySelectorAll('.triggers-list li');
            items.forEach(item => {
                item.style.cursor = 'pointer';
                // remove previous handlers to avoid duplicates by cloning
                const clone = item.cloneNode(true);
                clone.setAttribute('role', 'button');
                clone.setAttribute('tabindex', '0');
                // no preview-toggle button appended (removed as requested)
                item.replaceWith(clone);
            });
            // re-select after cloning
            const freshItems = (root || document).querySelectorAll('.triggers-list li');
            freshItems.forEach(item => {
                item.addEventListener('click', () => {
                     const audioSrc = item.dataset.audio;
                     const text = item.dataset.text || '';
                     const descEl = item.querySelector('.trigger-desc');
                     const headerText = (descEl && descEl.textContent.trim()) || text || '';
                     if (modalHeader) modalHeader.textContent = headerText;
                     if (modalText) modalText.textContent = text;
                     if (audioSrc && modalAudio) {
                         modalAudio.src = audioSrc;
                         modalAudio.style.display = '';
                         modalAudio.load();
                         const p = modalAudio.play(); if (p && p.catch) p.catch(()=>{});
                     } else if (modalAudio) {
                         modalAudio.pause(); modalAudio.removeAttribute('src'); try { modalAudio.currentTime = 0; } catch(e){}
                         modalAudio.style.display = 'none';
                     }

                     if (modal) modal.style.display = 'flex';
                });
            });
        } catch (e) { console.warn('attachDonationInteractions failed', e); }
    }

    // Wire up buttons & media query listener
    linksBtn.addEventListener('click', () => setMobileView('links'));
    liveBtn.addEventListener('click', () => setMobileView('live'));
    // When switching to live, ensure iframes have correct src
    liveBtn.addEventListener('click', () => setTwitchEmbeds());
    // update donation visibility whenever view switches
    linksBtn.addEventListener('click', () => updateDonationVisibility());
    liveBtn.addEventListener('click', () => updateDonationVisibility());

    // Fullscreen helpers
    function requestFullscreenFor(el) {
        if (!el) return Promise.reject('no element');
        if (el.requestFullscreen) return el.requestFullscreen();
        if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
        if (el.msRequestFullscreen) return el.msRequestFullscreen();
        return Promise.reject('Fullscreen not supported');
    }
    function exitFullscreen() {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
        if (document.msExitFullscreen) return document.msExitFullscreen();
        return Promise.reject('Exit fullscreen not supported');
    }

    const fsPlayerBtn = document.getElementById('fs-player-btn');
    const fsChatBtn = document.getElementById('fs-chat-btn');
    const fsCombinedBtn = document.getElementById('fs-combined-btn');
    const playerEmbed = document.querySelector('.responsive-embed.player');
    const chatEmbed = document.querySelector('.responsive-embed.chat');

    function updateFsButtonState() {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        // simple aria-pressed state
        if (fsPlayerBtn) fsPlayerBtn.setAttribute('aria-pressed', String(isFs && (document.fullscreenElement === playerEmbed || document.webkitFullscreenElement === playerEmbed)));
        if (fsChatBtn) fsChatBtn.setAttribute('aria-pressed', String(isFs && (document.fullscreenElement === chatEmbed || document.webkitFullscreenElement === chatEmbed)));
        if (fsCombinedBtn) fsCombinedBtn.setAttribute('aria-pressed', String(isFs && (document.fullscreenElement === playerEmbed || document.fullscreenElement === chatEmbed)));
    }

    if (fsPlayerBtn) fsPlayerBtn.addEventListener('click', () => {
        if (!playerEmbed) return;
        if (document.fullscreenElement === playerEmbed) { exitFullscreen().catch(()=>{}); } else { requestFullscreenFor(playerEmbed).catch(()=>{}); }
    });
    if (fsChatBtn) fsChatBtn.addEventListener('click', () => {
        if (!chatEmbed) return;
        if (document.fullscreenElement === chatEmbed) { exitFullscreen().catch(()=>{}); } else { requestFullscreenFor(chatEmbed).catch(()=>{}); }
    });
    if (fsCombinedBtn) fsCombinedBtn.addEventListener('click', () => {
        // combined: request fullscreen on parent wrapper to show both
        const wrapper = document.querySelector('.embed-card.fullwidth');
        if (!wrapper) return;
        if (document.fullscreenElement === wrapper) { exitFullscreen().catch(()=>{}); } else { requestFullscreenFor(wrapper).catch(()=>{}); }
    });

    document.addEventListener('fullscreenchange', updateFsButtonState);
    document.addEventListener('webkitfullscreenchange', updateFsButtonState);

    // On mobile, enter player fullscreen on landscape orientation (optional, only if user allows)
    function handleOrientation(e) {
        try {
            const gamma = (e && e.gamma) || 0; // left/right tilt
            const beta = (e && e.beta) || 0; // front/back tilt
            // rough: if rotated to landscape (|gamma| > 45) or beta near +/-90
            const isLandscape = Math.abs(gamma) > 45 || Math.abs(beta) > 60;
            if (mq.matches && isLandscape) {
                // only request fullscreen for player
                if (playerEmbed && !document.fullscreenElement) {
                    requestFullscreenFor(playerEmbed).catch(()=>{});
                }
            }
        } catch (e) { /* ignore */ }
    }

    if (window.DeviceOrientationEvent && typeof window.addEventListener === 'function') {
        window.addEventListener('deviceorientation', handleOrientation, true);
    }

    mq.addListener(applyInitial);
    applyInitial();
    // Ensure Twitch iframe srcs are set immediately so chat/player load correctly
    try { setTwitchEmbeds(); } catch (e) { /* ignore */ }
    // Ensure embed display matches current state
    try { updateEmbedDisplayForMobile(); } catch(e) {}
    // Do not auto-load donations on desktop to keep donation-embed hidden on wide screens.
    // Donations will be loaded when the user switches to mobile 'Live' view or via explicit call.
    // Ensure initial donation visibility
    try { updateDonationVisibility(); } catch(e) {}

    // Register service worker for offline support
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                // register success
                console.log('ServiceWorker registered', reg.scope);
                // Listen for updates
                reg.addEventListener && reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            // new content available
                            console.log('ServiceWorker: new content installed');
                        }
                    });
                });
            }).catch(err => console.warn('ServiceWorker registration failed', err));
        }
    } catch (e) { console.warn('ServiceWorker registration not available', e); }
 })();
