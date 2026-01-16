// Clip des Jahres - Display System
(function () {
    'use strict';

    let clipsByMonth = {};
    
    // Queue für sequentielles Laden von Embeds
    const embedLoadQueue = [];
    let embedLoading = false;

    function enqueueEmbed(clip, placeholderEl) {
        embedLoadQueue.push({clip, placeholderEl});
        if (!embedLoading && embedLoadQueue.length === 1) {
            try {
                loadNextEmbed();
            } catch (e) {
                setTimeout(() => loadNextEmbed(), 0);
            }
        }
    }

    function startSequentialEmbedLoading() {
        if (!embedLoading) {
            setTimeout(() => loadNextEmbed(), 50);
        }
    }

    function loadNextEmbed() {
        if (embedLoading) return;
        const item = embedLoadQueue.shift();
        if (!item) return;
        embedLoading = true;

        const {clip, placeholderEl} = item;
        const iframe = createEmbedIframe(clip);
        const parent = placeholderEl.parentNode;
        if (!iframe || !parent) {
            const thumb = document.createElement('img');
            thumb.src = clip.thumbnail_url;
            thumb.alt = clip.title;
            thumb.className = 'clip-thumbnail';
            thumb.style.cursor = 'pointer';
            thumb.addEventListener('click', () => window.open(clip.url, '_blank'));
            if (parent) parent.replaceChild(thumb, placeholderEl);
            embedLoading = false;
            setTimeout(loadNextEmbed, 50);
            return;
        }

        iframe.style.width = '100%';
        iframe.style.height = '100%';

        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            embedLoading = false;
            setTimeout(loadNextEmbed, 100);
        };

        iframe.addEventListener('load', () => settle());
        iframe.addEventListener('error', () => settle());

        const timeoutId = setTimeout(() => {
            settle();
            clearTimeout(timeoutId);
        }, 2500);

        try {
            parent.replaceChild(iframe, placeholderEl);
        } catch (e) {
            try { parent.appendChild(iframe); } catch (e2) { /* ignore */ }
        }
    }

    // Initialize the display system
    async function init() {
        try {
            const currentYear = new Date().getFullYear();
            
            // Fetch clip des jahres from database
            const clips = await fetchClipDesJahres(currentYear);
            
            if (!clips || clips.length === 0) {
                showNoClipsMessage();
                return;
            }
            
            // Organize clips by month
            clipsByMonth = {};
            clips.forEach(clip => {
                const month = clip.month;
                if (!clipsByMonth[month]) {
                    clipsByMonth[month] = [];
                }
                clipsByMonth[month].push(clip);
            });
            
            showClipsByMonth();
        } catch (error) {
            console.error('Error initializing Clip des Jahres:', error);
            showError('Fehler beim Laden der Clip des Jahres Daten. Bitte versuche es später erneut.');
        }
    }

    // Show clips organized by month
    function showClipsByMonth() {
        const container = document.getElementById('cdj-container');
        if (!container) return;

        container.innerHTML = '';

        const monthNames = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];

        // Sort months in descending order (most recent first)
        const months = Object.keys(clipsByMonth).map(m => parseInt(m)).sort((a, b) => b - a);

        months.forEach(month => {
            const monthSection = document.createElement('div');
            monthSection.className = 'cdj-month-section';

            const monthHeader = document.createElement('h2');
            monthHeader.className = 'cdj-month-header';
            monthHeader.textContent = `🏆 ${monthNames[month - 1]} ${new Date().getFullYear()}`;
            monthSection.appendChild(monthHeader);

            const clipsGrid = document.createElement('div');
            clipsGrid.className = 'results-grid';

            const monthClips = clipsByMonth[month];
            
            // Sort clips by votes (descending)
            monthClips.sort((a, b) => b.votes - a.votes);

            monthClips.forEach((clip, index) => {
                const clipCard = createClipCard(clip, index === 0);
                clipsGrid.appendChild(clipCard);
            });

            monthSection.appendChild(clipsGrid);
            container.appendChild(monthSection);
        });

        // Start loading embeds
        startSequentialEmbedLoading();
    }

    // Create clip card
    function createClipCard(clip, isWinner) {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        if (isWinner) {
            card.classList.add('winner-card');
        }

        const embedWrapper = document.createElement('div');
        embedWrapper.className = 'clip-embed-wrapper';
        embedWrapper.style.width = '100%';
        embedWrapper.style.height = '360px';
        embedWrapper.style.marginBottom = '8px';

        if (canEmbedClip()) {
            const placeholder = document.createElement('div');
            placeholder.className = 'clip-embed-placeholder';
            placeholder.style.width = '100%';
            placeholder.style.height = '100%';
            placeholder.innerHTML = '<div class="embed-loading">Lade Clip…</div>';
            embedWrapper.appendChild(placeholder);
            enqueueEmbed(clip, placeholder);
        } else {
            const thumbnail = document.createElement('img');
            thumbnail.src = clip.thumbnail_url;
            thumbnail.alt = clip.title;
            thumbnail.className = 'clip-thumbnail';
            thumbnail.style.cursor = 'pointer';
            thumbnail.addEventListener('click', () => window.open(clip.url, '_blank'));
            embedWrapper.appendChild(thumbnail);
        }

        const info = document.createElement('div');
        info.className = 'clip-info';

        const title = document.createElement('h3');
        title.textContent = clip.title;
        title.className = 'clip-title';

        const votes = document.createElement('div');
        votes.className = 'clip-votes';
        votes.innerHTML = `<strong>🗳️ ${clip.votes || 0} Stimmen</strong>`;

        const meta = document.createElement('div');
        meta.className = 'clip-meta';
        meta.innerHTML = `
            <span>👁️ ${clip.view_count.toLocaleString()} Views</span>
            <span>⏱️ ${Math.floor(clip.duration)}s</span>
            <span>📅 ${formatDate(new Date(clip.created_at))}</span>
        `;

        const creator = document.createElement('div');
        creator.className = 'clip-creator';
        creator.textContent = `Erstellt von: ${clip.creator_name}`;

        info.appendChild(title);
        info.appendChild(votes);
        info.appendChild(meta);
        info.appendChild(creator);

        card.appendChild(embedWrapper);
        card.appendChild(info);

        return card;
    }

    function canEmbedClip() {
        const hostname = window.location.hostname || window.location.host || '';
        if (!hostname) return false;
        const isLocal = hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1';
        return !isLocal;
    }

    function createEmbedIframe(clip) {
        try {
            if (!canEmbedClip()) return null;

            const parent = window.location.host;
            if (!parent) return null;

            const iframe = document.createElement('iframe');
            iframe.allowFullscreen = true;
            iframe.frameBorder = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';

            iframe.src = `https://clips.twitch.tv/embed?clip=${clip.clip_id}&parent=${parent}`;

            return iframe;
        } catch (err) {
            console.error('Embed creation failed', err);
            return null;
        }
    }

    function showNoClipsMessage() {
        const container = document.getElementById('cdj-container');
        if (!container) return;

        container.innerHTML = `
            <div class="no-results-message">
                <h2>ℹ️ Noch keine Clip des Jahres Gewinner</h2>
                <p>Für das aktuelle Jahr wurden noch keine "Clip des Jahres" Gewinner ermittelt.</p>
                <p>Die Gewinner werden nach jeder zweiten Voting-Runde hier angezeigt.</p>
            </div>
        `;
    }

    function showError(message) {
        const container = document.getElementById('cdj-container');
        if (!container) return;

        container.innerHTML = `
            <div class="error-message">
                <h2>⚠️ Fehler</h2>
                <p>${message}</p>
            </div>
        `;
    }

    function formatDate(date) {
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
