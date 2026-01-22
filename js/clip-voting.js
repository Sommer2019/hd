// Clip des Monats - Voting System
(function () {
    'use strict';

    const CONFIG_URL = './votingData/config.json';
    const CLIPS_URL = './votingData/clips.json';
    const RESULTS_URL = './votingData/results.json';
    const VOTE_STORAGE_KEY = 'cdm_voted_clip';
    const VOTE_STORAGE_KEY_SECOND = 'cdm_voted_clip_second';
    const GITHUB_REPO_OWNER = 'HD1920x1080Media';
    const GITHUB_REPO_NAME = 'Landing-Page';

    let currentConfig = null;
    let currentClips = null;
    let currentResults = null;
    let userIpHash = null;
    let secondVotingConfig = null;
    let isSecondVoting = false;

    // Helper function to get the appropriate storage key
    function getStorageKey() {
        return isSecondVoting ? VOTE_STORAGE_KEY_SECOND : VOTE_STORAGE_KEY;
    }

    // Helper function to get the current voting round
    function getVotingRound() {
        return isSecondVoting ? 'second' : 'monthly';
    }

    // Get user's IP address and hash it
    async function getUserIpHash() {
        if (userIpHash) return userIpHash;
        
        try {
            // Get IP from ipify service
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            const ip = data.ip;
            
            // Hash the IP using SHA-256
            const msgBuffer = new TextEncoder().encode(ip);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            userIpHash = hashHex;
            return userIpHash;
        } catch (error) {
            console.error('Error getting IP hash:', error);
            // Fallback to a session-based ID
            if (!sessionStorage.getItem('session_id')) {
                sessionStorage.setItem('session_id', Math.random().toString(36).substring(2));
            }
            userIpHash = sessionStorage.getItem('session_id');
            return userIpHash;
        }
    }

    // Queue für sequentielles Laden von Embeds (damit nicht alle iframes gleichzeitig geladen werden)
    const embedLoadQueue = [];
    let embedLoading = false;

    function enqueueEmbed(clip, placeholderEl) {
        embedLoadQueue.push({clip, placeholderEl});
        // Wenn gerade nichts geladen wird und dies das erste Element ist,
        // starte sofort den Ladevorgang synchron, damit der erste Clip möglichst schnell lädt.
        if (!embedLoading && embedLoadQueue.length === 1) {
            try {
                loadNextEmbed();
            } catch (e) {
                // Fallback: asynchron starten, falls synchrones Laden Probleme macht
                setTimeout(() => loadNextEmbed(), 0);
            }
        }
    }

    function startSequentialEmbedLoading() {
        // beginne nur, wenn nicht bereits geladen wird
        if (!embedLoading) {
            // starte asynchron, damit DOM-Einfügungen abgeschlossen sind
            setTimeout(() => loadNextEmbed(), 50);
        }
    }

    function loadNextEmbed() {
        if (embedLoading) return;
        const item = embedLoadQueue.shift();
        if (!item) return;
        embedLoading = true;

        const {clip, placeholderEl} = item;
        // Versuche ein iframe zu erzeugen
        const iframe = createEmbedIframe(clip);
        const parent = placeholderEl.parentNode;
        if (!iframe || !parent) {
            // Fallback: ersetze Platzhalter durch Thumbnail, öffnet Clip im neuen Tab
            const thumb = document.createElement('img');
            thumb.src = clip.thumbnail_url;
            thumb.alt = clip.title;
            thumb.className = 'clip-thumbnail';
            thumb.style.cursor = 'pointer';
            thumb.addEventListener('click', () => window.open(clip.url, '_blank'));
            if (parent) parent.replaceChild(thumb, placeholderEl);
            embedLoading = false;
            // Lade als nächstes das nächste Embed (kleine Pause)
            setTimeout(loadNextEmbed, 50);
            return;
        }

        iframe.style.width = '100%';
        iframe.style.height = '100%';

        // Wenn das iframe geladen oder fehlerhaft ist, fahre mit dem nächsten fort
        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            embedLoading = false;
            // kurze Pause vor dem nächsten, um Bandbreite zu schonen
            setTimeout(loadNextEmbed, 100);
        };

        iframe.addEventListener('load', () => settle());
        iframe.addEventListener('error', () => settle());

        // Timeout-Fallback falls kein load/error ausgelöst wird
        const timeoutId = setTimeout(() => {
            settle();
            clearTimeout(timeoutId);
        }, 2500);

        // Ersetze Platzhalter durch iframe (das lädt dann und löst load aus)
        try {
            parent.replaceChild(iframe, placeholderEl);
        } catch (e) {
            // Falls ersetzen fehlschlägt, entferne placeholder und hänge iframe an
            try { parent.appendChild(iframe); } catch (e2) { /* ignore */ }
        }
    }

    // Constants for voting period calculation
    const VOTING_START_DAY = 22; // Voting starts on the 22nd of each month

    // Calculate the voting period for the current month (from 22nd to end of month)
    function getVotingPeriodOfMonth(referenceDate = new Date()) {
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth();

        // Get the last day of the month
        const lastDay = new Date(year, month + 1, 0);
        const lastDayOfMonth = lastDay.getDate();

        // Voting period: 22nd to last day of month
        const votingStart = new Date(year, month, VOTING_START_DAY, 0, 0, 0, 0);
        const votingEnd = new Date(year, month, lastDayOfMonth, 23, 59, 59, 999);

        return {start: votingStart, end: votingEnd};
    }

    // Check if current date is in the voting period (22nd to end of month)
    function isInVotingPeriod(now = new Date()) {
        const votingPeriod = getVotingPeriodOfMonth(now);
        return now >= votingPeriod.start && now <= votingPeriod.end;
    }

    // Initialize the voting system
    async function init() {
        try {
            // Load configuration
            currentConfig = await fetchJSON(CONFIG_URL);

            // Check for second voting round first
            try {
                secondVotingConfig = await getSecondVotingConfig();
                if (secondVotingConfig && secondVotingConfig.is_active) {
                    const now = new Date();
                    const endsAt = new Date(secondVotingConfig.ends_at);
                    
                    // Check if second voting is still valid (not past end date)
                    if (now <= endsAt) {
                        isSecondVoting = true;
                        console.log('Second voting round is active');
                    }
                }
            } catch (error) {
                console.error('Error checking second voting config:', error);
            }

            // Determine if voting is active
            let isVotingActive = false;
            
            if (isSecondVoting) {
                // Second voting is active
                isVotingActive = true;
            } else {
                // Check if regular voting is active (22nd to end of month)
                const now = new Date();
                isVotingActive = isInVotingPeriod(now);
            }

            // Check voting status
            if (isVotingActive) {
                // Load clips and show voting interface
                currentClips = await fetchJSON(CLIPS_URL);
                await showVotingInterface();
            } else {
                // Load results and show results interface
                currentResults = await fetchJSON(RESULTS_URL);
                await showResultsInterface();
            }
        } catch (error) {
            console.error('Error initializing voting system:', error);
            showError('Es stehen aktuell keine Ergebnisse oder Clips zum Voting zur Verfügung. Voting findet immer vom 22. bis zum Ende eines Monats statt. Bitte versuche es später erneut.');
        }
    }

    // Fetch JSON data
    async function fetchJSON(url) {
        // Try to fetch from Supabase database first
        if (url === CLIPS_URL) {
            try {
                return await fetchClipsFromDB();
            } catch (error) {
                console.error('Error fetching from Supabase, falling back to JSON file:', error);
            }
        } else if (url === RESULTS_URL) {
            try {
                const results = await fetchResultsFromDB();
                if (results) return results;
            } catch (error) {
                console.error('Error fetching results from Supabase, falling back to JSON file:', error);
            }
        }
        
        // Fallback to JSON files
        // Add cache busting for development. In production, consider using proper
        // HTTP cache headers (Cache-Control, ETag) for better performance
        const response = await fetch(url + '?t=' + Date.now());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    // Show voting interface
    async function showVotingInterface() {
        const container = document.getElementById('voting-container');
        if (!container) return;

        // Check if user has already voted (check both localStorage and database)
        const votedClipId = localStorage.getItem(getStorageKey());
        
        // Also check database
        try {
            const ipHash = await getUserIpHash();
            const supabase = await getSupabaseClient();
            const { data: existingVote } = await supabase
                .from('votes')
                .select('clip_id')
                .eq('ip_hash', ipHash)
                .eq('voting_round', getVotingRound())
                .single();
            
            if (existingVote) {
                showVotedMessage(existingVote.clip_id);
                return;
            }
        } catch (error) {
            // If database check fails, continue with localStorage check
            console.error('Error checking vote in database:', error);
        }

        if (votedClipId) {
            showVotedMessage(votedClipId);
            return;
        }

        // Calculate and show voting period info
        let startDate, endDate, votingTitle;
        
        if (isSecondVoting) {
            // Second voting round
            startDate = new Date(secondVotingConfig.started_at);
            endDate = new Date(secondVotingConfig.ends_at);
            votingTitle = '🏆 Zweite Voting-Runde: Clip des Jahres';
        } else {
            // Regular monthly voting (automatically 22nd to end of current month)
            const votingPeriod = getVotingPeriodOfMonth();
            startDate = votingPeriod.start;
            endDate = votingPeriod.end;
            votingTitle = 'Voting ist aktiv!';
        }

        const header = document.createElement('div');
        header.className = 'voting-header';
        
        let headerHTML = `<h2>${votingTitle}</h2>`;
        headerHTML += `<p>Voting-Zeitraum: ${formatDate(startDate)} - ${formatDate(endDate)}</p>`;
        
        if (isSecondVoting) {
            headerHTML += `<p class="second-voting-notice">Dies ist eine besondere zweite Voting-Runde für die Top ${currentClips.clips.length} Clips aus dem ${secondVotingConfig.source_month}/${secondVotingConfig.source_year}. Die Gewinner werden als "Clip des Jahres" gespeichert!</p>`;
        }
        
        headerHTML += `<p>Du kannst für genau einen Clip abstimmen. Wähle deinen Favoriten aus!</p>`;
        headerHTML += `<p><strong>${currentClips.clips.length} Clips</strong> stehen zur Auswahl.</p>`;
        
        header.innerHTML = headerHTML;
        container.appendChild(header);

        // Show clips
        const clipsGrid = document.createElement('div');
        clipsGrid.className = 'clips-grid';

        currentClips.clips.forEach(clip => {
            const clipCard = createClipCard(clip);
            clipsGrid.appendChild(clipCard);
        });

        container.appendChild(clipsGrid);

        // Starte sequentielles Laden der Embeds (1., 2., 3. ...)
        startSequentialEmbedLoading();
    }

    // Create clip card
    function createClipCard(clip) {
        return createClipCardInternal(clip, false, false);
    }

    // Create clip card without voting button (for showing after user has voted)
    function createClipCardWithoutVoting(clip, isVoted) {
        return createClipCardInternal(clip, true, isVoted);
    }

    // Internal helper to create clip cards with or without voting functionality
    function createClipCardInternal(clip, hideVoteButton, isVoted) {
        const card = document.createElement('div');
        card.className = 'clip-card';
        
        // Highlight the clip that was voted for
        if (isVoted) {
            card.classList.add('voted-clip');
        }

        // Direktes Embed: wenn möglich zeigen wir das iframe sofort an.
        const embedWrapper = document.createElement('div');
        embedWrapper.className = 'clip-embed-wrapper';
        embedWrapper.style.width = '100%';
        embedWrapper.style.height = '360px';
        embedWrapper.style.marginBottom = '8px';

        // Wir fügen einen Platzhalter ein und enqueuen das Embed, damit iframes
        // nacheinander geladen werden (verbessert Time-to-first-clip bei vielen Clips).
        if (canEmbedClip(clip)) {
            const placeholder = document.createElement('div');
            placeholder.className = 'clip-embed-placeholder';
            placeholder.style.width = '100%';
            placeholder.style.height = '100%';
            placeholder.dataset.clipId = clip.id;
            // einfacher Ladehinweis
            placeholder.innerHTML = '<div class="embed-loading">Lade Clip…</div>';
            embedWrapper.appendChild(placeholder);
            enqueueEmbed(clip, placeholder);
        } else {
            // Fallback: zeige das Thumbnail und öffne den Clip im neuen Tab beim Klick
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
        info.appendChild(meta);
        info.appendChild(creator);

        // Add vote button only if not hidden
        if (!hideVoteButton) {
            const voteBtn = document.createElement('button');
            voteBtn.className = 'btn btn-primary vote-btn';
            voteBtn.textContent = 'Für diesen Clip voten';
            voteBtn.onclick = () => voteForClip(clip.id);
            info.appendChild(voteBtn);
        }

        // Add "Your Vote" badge if this is the voted clip
        if (isVoted) {
            const voteBadge = document.createElement('div');
            voteBadge.className = 'your-vote-badge';
            voteBadge.textContent = '✓ Deine Stimme';
            info.appendChild(voteBadge);
        }

        // Embed/Fallback zuerst, dann Info
        card.appendChild(embedWrapper);
        card.appendChild(info);

        return card;
    }

    // Vote for a clip
    async function voteForClip(clipId) {
        // Show custom modal confirmation
        showVoteConfirm(clipId);
    }

    // Show voted message with all clips and highlight the voted clip
    function showVotedMessage(votedClipId) {
        const container = document.getElementById('voting-container');
        if (!container) return;

        container.innerHTML = '';

        const message = document.createElement('div');
        message.className = 'voted-message';
        message.innerHTML = `
      <h2>✅ Vielen Dank für deine Stimme!</h2>
      <p>Du hast erfolgreich abgestimmt.</p>
      <p>Die Ergebnisse werden am Ende des Voting-Zeitraums veröffentlicht.</p>
      <p class="note">Hinweis: Du hast bereits abgestimmt und kannst nicht erneut voten.</p>
    `;

        container.appendChild(message);

        // Show all clips with the voted clip highlighted
        if (currentClips && currentClips.clips && currentClips.clips.length > 0) {
            const clipsSection = document.createElement('div');
            clipsSection.className = 'voted-clips-section';
            
            const clipsHeader = document.createElement('h3');
            clipsHeader.textContent = 'Alle Clips dieser Voting-Runde:';
            clipsSection.appendChild(clipsHeader);

            const clipsGrid = document.createElement('div');
            clipsGrid.className = 'clips-grid';

            currentClips.clips.forEach(clip => {
                // Convert clip.id to string since votedClipId from localStorage is always a string
                // (clip.id may be string or number from API, votedClipId is always string from localStorage)
                const clipCard = createClipCardWithoutVoting(clip, String(clip.id) === votedClipId);
                clipsGrid.appendChild(clipCard);
            });

            clipsSection.appendChild(clipsGrid);
            container.appendChild(clipsSection);

            // Start loading embeds
            startSequentialEmbedLoading();
        }
    }

    // Show results interface
    async function showResultsInterface() {
        const container = document.getElementById('voting-container');
        if (!container) return;

        if (!currentResults || !currentResults.results || currentResults.results.length === 0) {
            // Wenn keine Ergebnisse vorhanden sind und Voting nicht aktiv ist,
            // zeigen wir eine spezifische, hilfreiche Meldung an.
            showNoResultsMessage();
            return;
        }

        const header = document.createElement('div');
        header.className = 'results-header';
        header.innerHTML = `
      <h2>🏆 Top ${currentResults.results.length} Clips</h2>
      <p>Zeitraum: ${formatDate(new Date(currentResults.period.start))} - ${formatDate(new Date(currentResults.period.end))}</p>
      <p>Gesamtstimmen: <strong>${currentResults.totalVotes || 0}</strong></p>
      <p>Berechnet am: ${formatDate(new Date(currentResults.calculatedAt))}</p>
    `;
        container.appendChild(header);

        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'results-grid';

        currentResults.results.forEach((clip, index) => {
            const resultCard = createResultCard(clip, index + 1);
            resultsGrid.appendChild(resultCard);
        });

        container.appendChild(resultsGrid);

        // Starte sequentielles Laden der Embeds für Ergebnisse
        startSequentialEmbedLoading();
    }

    // Zeige eine freundliche Meldung, wenn es keine Ergebnisse für den letzten Monat gibt
    function showNoResultsMessage() {
        const container = document.getElementById('voting-container');
        if (!container) return;

        container.innerHTML = '';

        const message = document.createElement('div');
        message.className = 'no-results-message';
        // Hinweis: Wir verwenden hier eine allgemeine Formulierung — die Seite wird
        // beim Hosting die korrekte Domain als parent für Twitch-Embeds benötigen.
        message.innerHTML = `
      <h2>ℹ️ Noch keine Ergebnisse für den letzten Monat</h2>
      <p>Für den letzten Monat sind derzeit noch keine Ergebnisse verfügbar.</p>
      <p>Das Voting ist aktuell nicht aktiv. Das Voting findet jeweils vom 22. bis zum Ende des Monats statt.</p>
      <p>Schau bitte am 22. wieder vorbei — dann wird das Voting automatisch aktiviert.</p>
      <p class="note">Wenn du Clips einsehen möchtest, lade die Seite neu, sobald neue Daten vorhanden sind.</p>
    `;

        container.appendChild(message);
    }

    // Create result card
    function createResultCard(clip, rank) {
        const card = document.createElement('div');
        card.className = 'result-card';

        const rankBadge = document.createElement('div');
        rankBadge.className = 'rank-badge';
        rankBadge.textContent = `#${rank}`;

        // Direktes Embed anzeigen (oder Fallback auf Thumbnail, das im neuen Tab öffnet)
        const embedWrapper = document.createElement('div');
        embedWrapper.className = 'clip-embed-wrapper';
        embedWrapper.style.width = '100%';
        embedWrapper.style.height = '360px';
        embedWrapper.style.marginBottom = '8px';

        if (canEmbedClip(clip)) {
            const placeholder = document.createElement('div');
            placeholder.className = 'clip-embed-placeholder';
            placeholder.style.width = '100%';
            placeholder.style.height = '100%';
            placeholder.dataset.clipId = clip.id;
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
        // Embed wird durch Klick auf das Thumbnail gesteuert

        card.appendChild(rankBadge);
        card.appendChild(embedWrapper);
         card.appendChild(info);

         return card;
    }

    // Prüft, ob ein Clip eingebettet werden kann (Twitch benötigt normalerweise eine nicht-lokale Domain).
    // Für Entwicklung kann `currentConfig.allowLocalEmbeds` aktiviert werden, um Embeds lokal zu erlauben.
    function canEmbedClip(/* optional clip */) {
        // Dev override aus config
        if (currentConfig && currentConfig.allowLocalEmbeds) return true;

        const hostname = window.location.hostname || window.location.host || '';
        if (!hostname) return false;
        const isLocal = hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1';
        return !isLocal;
    }


    // Erzeugt ein iframe-Element für den Clip. Wenn nicht möglich, return null.
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

            iframe.src =
                `https://clips.twitch.tv/embed?clip=${clip.id}&parent=${parent}`;

            return iframe;
        } catch (err) {
            console.error('Embed creation failed', err);
            return null;
        }
    }

    // Show error message
    function showError(message) {
        const container = document.getElementById('voting-container');
        if (!container) return;

        container.innerHTML = `
      <div class="error-message">
        <h2>⚠️ Fehler</h2>
        <p>${message}</p>
      </div>
    `;
    }

    // Format date
    function formatDate(date) {
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Modal helper functions for vote confirmation
    let pendingVoteClipId = null;

    window.showVoteConfirm = function(clipId) {
        pendingVoteClipId = clipId;
        const modal = document.getElementById('vote-modal');
        if (modal) {
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            // focus first action for keyboard users
            setTimeout(() => { modal.querySelector('.btn-secondary')?.focus(); }, 10);
        }
    };

    window.hideVoteConfirm = function() {
        pendingVoteClipId = null;
        const modal = document.getElementById('vote-modal');
        if (modal) {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        }
    };

    window.confirmVote = async function() {
        const clipId = pendingVoteClipId;
        hideVoteConfirm();
        
        if (!clipId) return;
        
        try {
            // Get IP hash
            const ipHash = await getUserIpHash();
            
            // Try to submit vote to Supabase
            try {
                await submitVoteToDB(clipId, ipHash, getVotingRound());
                
                // Store vote in localStorage after successful DB submission
                localStorage.setItem(getStorageKey(), clipId);
                
                showVotedMessage(clipId);
            } catch (error) {
                console.error('Error submitting vote to Supabase:', error);
                
                // If Supabase fails, handle appropriately
                if (error.message === 'Already voted') {
                    // User already voted, update localStorage to prevent UI confusion
                    localStorage.setItem(getStorageKey(), clipId);
                    showError('Du hast bereits abgestimmt!');
                } else {
                    // Other errors - clean up localStorage and show error
                    localStorage.removeItem(getStorageKey());
                    showError('Fehler beim Abstimmen. Bitte versuche es erneut.');
                }
            }

        } catch (error) {
            console.error('Error submitting vote:', error);
            localStorage.removeItem(getStorageKey());
            showError('Fehler beim Abstimmen. Bitte versuche es erneut.');
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
