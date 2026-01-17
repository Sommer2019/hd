// Clip des Jahres - Voting and Display System
(function () {
    'use strict';

    const VOTE_STORAGE_KEY_CDJ = 'cdj_voted_clip';
    let cdjVotingConfig = null;
    let isCdjVoting = false;
    let currentClips = null;
    let clipsByMonth = {};
    let userIpHash = null;
    
    // Queue für sequentielles Laden von Embeds
    const embedLoadQueue = [];
    let embedLoading = false;

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
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // 1-12
            
            // Check for CDJ voting first
            try {
                cdjVotingConfig = await getClipDesJahresVotingConfig();
                if (cdjVotingConfig && cdjVotingConfig.is_active) {
                    const endsAt = new Date(cdjVotingConfig.ends_at);
                    
                    // Check if CDJ voting is still valid (not past end date)
                    if (now <= endsAt) {
                        isCdjVoting = true;
                        console.log('Clip des Jahres voting round is active');
                    }
                }
            } catch (error) {
                console.error('Error checking CDJ voting config:', error);
            }

            if (isCdjVoting) {
                // Show CDJ voting interface
                await showCdjVotingInterface();
            } else {
                // Show CDJ winner or monthly winners
                await showCdjDisplay(currentYear);
            }
        } catch (error) {
            console.error('Error initializing Clip des Jahres:', error);
            showError('Fehler beim Laden der Clip des Jahres Daten. Bitte versuche es später erneut.');
        }
    }

    // Show CDJ Voting Interface
    async function showCdjVotingInterface() {
        const container = document.getElementById('cdj-container');
        const description = document.getElementById('cdj-description');
        if (!container) return;

        // Update description
        if (description) {
            description.textContent = 'Stimme für deinen Favoriten aus den besten Clips des Jahres!';
        }

        // Load clips from database
        try {
            const clipsData = await fetchClipsFromDB();
            currentClips = clipsData;
            
            if (!currentClips || !currentClips.clips || currentClips.clips.length === 0) {
                showError('Keine Clips für das Voting verfügbar.');
                return;
            }
        } catch (error) {
            console.error('Error fetching clips:', error);
            showError('Fehler beim Laden der Clips.');
            return;
        }

        // Check if user has already voted
        const votedClipId = localStorage.getItem(VOTE_STORAGE_KEY_CDJ);
        
        // Also check database
        try {
            const ipHash = await getUserIpHash();
            const supabase = await getSupabaseClient();
            const { data: existingVote } = await supabase
                .from('votes')
                .select('clip_id')
                .eq('ip_hash', ipHash)
                .eq('voting_round', 'cdj')
                .single();
            
            if (existingVote) {
                showVotedMessage(existingVote.clip_id);
                return;
            }
        } catch (error) {
            console.error('Error checking vote in database:', error);
        }

        if (votedClipId) {
            showVotedMessage(votedClipId);
            return;
        }

        // Show voting interface
        container.innerHTML = '';

        const startDate = new Date(cdjVotingConfig.started_at);
        const endDate = new Date(cdjVotingConfig.ends_at);

        const header = document.createElement('div');
        header.className = 'voting-header';
        header.innerHTML = `
            <h2>🏆 Clip des Jahres ${cdjVotingConfig.target_year} - Voting ist aktiv!</h2>
            <p>Voting-Zeitraum: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
            <p>Stimme für deinen Lieblings-Clip des Jahres ${cdjVotingConfig.target_year}!</p>
            <p>Du kannst für genau einen Clip abstimmen. Wähle deinen Favoriten aus!</p>
            <p><strong>${currentClips.clips.length} Clips</strong> stehen zur Auswahl.</p>
        `;
        container.appendChild(header);

        // Show clips
        const clipsGrid = document.createElement('div');
        clipsGrid.className = 'clips-grid';

        currentClips.clips.forEach(clip => {
            const clipCard = createClipCardForVoting(clip);
            clipsGrid.appendChild(clipCard);
        });

        container.appendChild(clipsGrid);

        // Start loading embeds
        startSequentialEmbedLoading();
    }

    // Create clip card for voting
    function createClipCardForVoting(clip) {
        const card = document.createElement('div');
        card.className = 'clip-card';

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

        const voteBtn = document.createElement('button');
        voteBtn.className = 'btn btn-primary vote-btn';
        voteBtn.textContent = 'Für diesen Clip voten';
        voteBtn.onclick = () => showVoteConfirm(clip.id);

        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(creator);
        info.appendChild(voteBtn);

        card.appendChild(embedWrapper);
        card.appendChild(info);

        return card;
    }

    // Show voted message
    function showVotedMessage(votedClipId) {
        const container = document.getElementById('cdj-container');
        if (!container) return;

        container.innerHTML = '';

        const message = document.createElement('div');
        message.className = 'voted-message';
        message.innerHTML = `
            <h2>✅ Vielen Dank für deine Stimme!</h2>
            <p>Du hast erfolgreich für den Clip des Jahres abgestimmt.</p>
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
                const clipCard = createClipCardWithoutVoting(clip, String(clip.id) === votedClipId);
                clipsGrid.appendChild(clipCard);
            });

            clipsSection.appendChild(clipsGrid);
            container.appendChild(clipsSection);

            startSequentialEmbedLoading();
        }
    }

    // Create clip card without voting button
    function createClipCardWithoutVoting(clip, isVoted) {
        const card = document.createElement('div');
        card.className = 'clip-card';
        
        if (isVoted) {
            card.classList.add('voted-clip');
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

        if (isVoted) {
            const voteBadge = document.createElement('div');
            voteBadge.className = 'your-vote-badge';
            voteBadge.textContent = '✓ Deine Stimme';
            info.appendChild(voteBadge);
        }

        card.appendChild(embedWrapper);
        card.appendChild(info);

        return card;
    }

    // Show CDJ display (winner or monthly winners)
    async function showCdjDisplay(currentYear) {
        const container = document.getElementById('cdj-container');
        const description = document.getElementById('cdj-description');
        if (!container) return;

        // Try to get winner for last year
        const previousYear = currentYear - 1;
        let winner = null;
        
        try {
            winner = await fetchClipDesJahresWinner(previousYear);
        } catch (error) {
            console.log('No winner found for last year:', error);
        }

        if (winner) {
            // Show winner
            if (description) {
                description.textContent = `Der Gewinner des Clip des Jahres ${previousYear}:`;
            }

            container.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'cdj-winner-header';
            header.innerHTML = `
                <h2>🏆 Clip des Jahres ${previousYear}</h2>
                <p>Mit <strong>${winner.votes || 0} Stimmen</strong> hat dieser Clip gewonnen!</p>
            `;
            container.appendChild(header);

            const winnerCard = createWinnerCard(winner);
            container.appendChild(winnerCard);

            startSequentialEmbedLoading();
        } else {
            // Show monthly winners or message
            if (description) {
                description.textContent = 'Hier findest du die Top 10 Gewinner der zweiten Voting-Runde von Dezember bis November.';
            }

            // Determine the "Clip des Jahres" year based on current month
            const cdjYear = currentYear;
            
            // Fetch clip des jahres from database for the CDJ period
            const clips = await fetchClipDesJahresPeriod(cdjYear);
            
            if (!clips || clips.length === 0) {
                showNoClipsMessage(previousYear);
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
            
            showClipsByMonth(cdjYear);
        }
    }

    // Create winner card
    function createWinnerCard(winner) {
        const card = document.createElement('div');
        card.className = 'result-card winner-card';
        card.style.maxWidth = '800px';
        card.style.margin = '0 auto';

        const embedWrapper = document.createElement('div');
        embedWrapper.className = 'clip-embed-wrapper';
        embedWrapper.style.width = '100%';
        embedWrapper.style.height = '450px';
        embedWrapper.style.marginBottom = '12px';

        if (canEmbedClip()) {
            const placeholder = document.createElement('div');
            placeholder.className = 'clip-embed-placeholder';
            placeholder.style.width = '100%';
            placeholder.style.height = '100%';
            placeholder.innerHTML = '<div class="embed-loading">Lade Clip…</div>';
            embedWrapper.appendChild(placeholder);
            enqueueEmbed(winner, placeholder);
        } else {
            const thumbnail = document.createElement('img');
            thumbnail.src = winner.thumbnail_url;
            thumbnail.alt = winner.title;
            thumbnail.className = 'clip-thumbnail';
            thumbnail.style.cursor = 'pointer';
            thumbnail.addEventListener('click', () => window.open(winner.url, '_blank'));
            embedWrapper.appendChild(thumbnail);
        }

        const info = document.createElement('div');
        info.className = 'clip-info';

        const title = document.createElement('h3');
        title.textContent = winner.title;
        title.className = 'clip-title';

        const votes = document.createElement('div');
        votes.className = 'clip-votes';
        votes.innerHTML = `<strong>🗳️ ${winner.votes || 0} Stimmen</strong>`;

        const meta = document.createElement('div');
        meta.className = 'clip-meta';
        meta.innerHTML = `
            <span>👁️ ${winner.view_count.toLocaleString()} Views</span>
            <span>⏱️ ${Math.floor(winner.duration)}s</span>
            <span>📅 ${formatDate(new Date(winner.created_at))}</span>
        `;

        const creator = document.createElement('div');
        creator.className = 'clip-creator';
        creator.textContent = `Erstellt von: ${winner.creator_name}`;

        info.appendChild(title);
        info.appendChild(votes);
        info.appendChild(meta);
        info.appendChild(creator);

        card.appendChild(embedWrapper);
        card.appendChild(info);

        return card;
    }
    
    // Fetch clips for the CDJ period (Dec previous year through Nov current year)
    async function fetchClipDesJahresPeriod(cdjYear) {
        const supabase = await getSupabaseClient();
        
        // Fetch December from previous year
        const { data: decemberClips, error: decError } = await supabase
            .from('clip_des_jahres')
            .select('*')
            .eq('year', cdjYear - 1)
            .eq('month', 12)
            .order('votes', { ascending: false });
        
        if (decError && decError.code !== 'PGRST116') throw decError;
        
        // Fetch January through November from current year
        const { data: currentYearClips, error: currError } = await supabase
            .from('clip_des_jahres')
            .select('*')
            .eq('year', cdjYear)
            .gte('month', 1)
            .lte('month', 11)
            .order('month', { ascending: true })
            .order('votes', { ascending: false });
        
        if (currError && currError.code !== 'PGRST116') throw currError;
        
        // Combine the results
        const allClips = [...(decemberClips || []), ...(currentYearClips || [])];
        
        return allClips;
    }

    // Show clips organized by month
    function showClipsByMonth(cdjYear) {
        const container = document.getElementById('cdj-container');
        if (!container) return;

        container.innerHTML = '';

        const monthNames = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];

        // Show period header
        const periodHeader = document.createElement('div');
        periodHeader.className = 'cdj-period-header';
        periodHeader.innerHTML = `<p>Zeitraum: Dezember ${cdjYear - 1} - November ${cdjYear}</p>`;
        container.appendChild(periodHeader);

        // Define the order: December first, then January-November
        const monthOrder = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        
        monthOrder.forEach(month => {
            if (!clipsByMonth[month]) return; // Skip months without clips
            
            const monthSection = document.createElement('div');
            monthSection.className = 'cdj-month-section';

            const monthHeader = document.createElement('h2');
            monthHeader.className = 'cdj-month-header';
            // For December, show previous year
            const displayYear = month === 12 ? cdjYear - 1 : cdjYear;
            monthHeader.textContent = `🏆 ${monthNames[month - 1]} ${displayYear}`;
            monthSection.appendChild(monthHeader);

            const clipsGrid = document.createElement('div');
            clipsGrid.className = 'results-grid';

            const monthClips = clipsByMonth[month];
            
            // Sort clips by votes (descending)
            monthClips.sort((a, b) => b.votes - a.votes);

            // Show only top 10
            const top10Clips = monthClips.slice(0, 10);

            top10Clips.forEach((clip, index) => {
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

    function showNoClipsMessage(previousYear) {
        const container = document.getElementById('cdj-container');
        if (!container) return;

        const currentYear = previousYear + 1;

        container.innerHTML = `
            <div class="no-results-message">
                <h2>ℹ️ Noch kein Clip des Jahres ${previousYear}</h2>
                <p>Für das Jahr ${previousYear} wurde noch kein "Clip des Jahres" Gewinner ermittelt.</p>
                <p>Das Voting für den "Clip des Jahres" findet jährlich im Dezember statt.</p>
                <p>Die monatlichen Gewinner der zweiten Voting-Runde von Dezember ${currentYear - 1} bis November ${currentYear} werden hier angezeigt.</p>
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

    // Modal helper functions for vote confirmation
    let pendingVoteClipId = null;

    window.showVoteConfirm = function(clipId) {
        pendingVoteClipId = clipId;
        const modal = document.getElementById('vote-modal');
        if (modal) {
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
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
                await submitVoteToDB(clipId, ipHash, 'cdj');
                
                // Store vote in localStorage after successful DB submission
                localStorage.setItem(VOTE_STORAGE_KEY_CDJ, clipId);
                
                showVotedMessage(clipId);
            } catch (error) {
                console.error('Error submitting vote to Supabase:', error);
                
                // If Supabase fails, handle appropriately
                if (error.message === 'Already voted') {
                    localStorage.setItem(VOTE_STORAGE_KEY_CDJ, clipId);
                    showError('Du hast bereits abgestimmt!');
                } else {
                    localStorage.removeItem(VOTE_STORAGE_KEY_CDJ);
                    showError('Fehler beim Abstimmen. Bitte versuche es erneut.');
                }
            }

        } catch (error) {
            console.error('Error submitting vote:', error);
            localStorage.removeItem(VOTE_STORAGE_KEY_CDJ);
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
