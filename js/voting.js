/**
 * Twitch Clip Voting System
 * GitHub Pages compatible - uses client-side OAuth and localStorage
 */

class VotingSystem {
    constructor() {
        this.config = null;
        this.clips = [];
        this.userVote = null;
        this.isLoggedIn = false;
        this.user = null;
        this.votingPhase = 'loading'; // loading, before, active, ended
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.checkAuth();
        this.setupEventListeners();
        this.updateUI();
    }

    async loadConfig() {
        try {
            // Load configuration from config.txt
            const response = await fetch('../config.txt');
            const text = await response.text();
            
            this.config = this.parseConfig(text);
            
            // Determine voting phase
            const now = new Date();
            const votingStart = new Date(this.config.VOTING_START);
            const votingEnd = new Date(this.config.VOTING_END);
            
            if (now < votingStart) {
                this.votingPhase = 'before';
            } else if (now >= votingStart && now <= votingEnd) {
                this.votingPhase = 'active';
            } else {
                this.votingPhase = 'ended';
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.showError('Konfiguration konnte nicht geladen werden.');
        }
    }

    parseConfig(text) {
        const config = {};
        const lines = text.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                config[key.trim()] = valueParts.join('=').trim();
            }
        }
        
        return config;
    }

    setupEventListeners() {
        const loginBtn = document.getElementById('twitch-login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.initiateLogin());
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    checkAuth() {
        // Check for OAuth callback
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        if (params.has('access_token')) {
            const token = params.get('access_token');
            this.saveToken(token);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Check for existing token
        const token = this.getToken();
        if (token) {
            this.validateToken(token);
        }
    }

    saveToken(token) {
        localStorage.setItem('twitch_token', token);
        localStorage.setItem('twitch_token_time', Date.now().toString());
    }

    getToken() {
        const token = localStorage.getItem('twitch_token');
        const tokenTime = localStorage.getItem('twitch_token_time');
        
        // Token expires after 24 hours
        if (token && tokenTime) {
            const age = Date.now() - parseInt(tokenTime);
            if (age < 24 * 60 * 60 * 1000) {
                return token;
            }
        }
        
        return null;
    }

    async validateToken(token) {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `OAuth ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.user = {
                    id: data.user_id,
                    login: data.login
                };
                this.isLoggedIn = true;
                
                // Check if user has already voted
                this.userVote = this.getUserVote();
                
                // Load clips and update UI
                await this.loadClips();
                this.updateUI();
            } else {
                // Token invalid, clear it
                this.clearToken();
            }
        } catch (error) {
            console.error('Error validating token:', error);
            this.clearToken();
        }
    }

    clearToken() {
        localStorage.removeItem('twitch_token');
        localStorage.removeItem('twitch_token_time');
        this.isLoggedIn = false;
        this.user = null;
    }

    initiateLogin() {
        if (!this.config || !this.config.TWITCH_CLIENT_ID) {
            this.showError('Twitch Client ID nicht konfiguriert.');
            return;
        }
        
        const clientId = this.config.TWITCH_CLIENT_ID;
        const redirectUri = encodeURIComponent(window.location.href);
        const scope = 'user:read:email';
        
        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
        
        window.location.href = authUrl;
    }

    logout() {
        this.clearToken();
        this.userVote = null;
        this.updateUI();
    }

    async loadClips() {
        if (!this.config) return;
        
        this.showLoading(true);
        
        try {
            // For GitHub Pages, we'll use a different approach since we can't make direct API calls
            // We'll load pre-fetched clips from a JSON file
            // In production, you would set up a backend service or GitHub Action to fetch clips
            
            const response = await fetch('../clips-data.json');
            if (response.ok) {
                const data = await response.json();
                this.clips = data.clips || [];
            } else {
                // Fallback: generate sample clips for demonstration
                this.clips = this.generateSampleClips();
            }
            
            // Load vote counts
            this.loadVoteCounts();
            
        } catch (error) {
            console.error('Error loading clips:', error);
            // Fallback to sample clips
            this.clips = this.generateSampleClips();
        }
        
        this.showLoading(false);
    }

    generateSampleClips() {
        // Generate sample clips for demonstration
        const sampleClips = [];
        const titles = [
            'Epischer Clutch Moment!',
            'Unglaubliche Reaktion',
            'Funny Fail Compilation',
            'Best Play Ever',
            'Legendary Moment',
            'Insane Skill',
            'Perfect Timing',
            'Hilarious Reaction',
            'Close Call',
            'Victory Royale'
        ];
        
        for (let i = 0; i < 10; i++) {
            sampleClips.push({
                id: `clip_${i + 1}`,
                url: `https://clips.twitch.tv/sample${i + 1}`,
                embed_url: `https://clips.twitch.tv/embed?clip=sample${i + 1}&parent=${window.location.hostname}`,
                title: titles[i],
                creator_name: 'Viewer' + (i + 1),
                view_count: Math.floor(Math.random() * 1000) + 100,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        return sampleClips;
    }

    loadVoteCounts() {
        const votes = localStorage.getItem('clip_votes');
        if (votes) {
            try {
                this.voteCounts = JSON.parse(votes);
            } catch (e) {
                this.voteCounts = {};
            }
        } else {
            this.voteCounts = {};
        }
    }

    saveVoteCounts() {
        localStorage.setItem('clip_votes', JSON.stringify(this.voteCounts));
    }

    getUserVote() {
        if (!this.user) return null;
        const key = `vote_${this.user.id}`;
        return localStorage.getItem(key);
    }

    saveUserVote(clipId) {
        if (!this.user) return;
        const key = `vote_${this.user.id}`;
        localStorage.setItem(key, clipId);
        this.userVote = clipId;
    }

    vote(clipId) {
        if (!this.isLoggedIn) {
            this.showError('Du musst angemeldet sein, um zu voten.');
            return;
        }
        
        if (this.votingPhase !== 'active') {
            this.showError('Das Voting ist derzeit nicht aktiv.');
            return;
        }
        
        if (this.userVote) {
            this.showError('Du hast bereits gevotet!');
            return;
        }
        
        // Record vote
        if (!this.voteCounts[clipId]) {
            this.voteCounts[clipId] = 0;
        }
        this.voteCounts[clipId]++;
        
        this.saveUserVote(clipId);
        this.saveVoteCounts();
        
        this.showSuccess('Dein Vote wurde gespeichert!');
        this.updateUI();
    }

    updateUI() {
        const loginSection = document.getElementById('login-section');
        const votingStatus = document.getElementById('voting-status');
        const clipsSection = document.getElementById('clips-section');
        const resultsSection = document.getElementById('results-section');
        const statusMessage = document.getElementById('status-message');
        const userInfo = document.getElementById('user-info');
        const username = document.getElementById('username');
        
        // Update status message
        let message = '';
        let messageClass = 'info';
        
        if (this.votingPhase === 'loading') {
            message = 'Lädt...';
        } else if (this.votingPhase === 'before') {
            message = `Das Voting startet am ${new Date(this.config.VOTING_START).toLocaleDateString('de-DE')}`;
        } else if (this.votingPhase === 'active') {
            message = `Voting läuft bis ${new Date(this.config.VOTING_END).toLocaleDateString('de-DE')}`;
            messageClass = 'success';
        } else if (this.votingPhase === 'ended') {
            message = 'Das Voting ist beendet. Hier sind die Ergebnisse:';
            messageClass = 'info';
        }
        
        statusMessage.innerHTML = `<div class="status-message ${messageClass}">${message}</div>`;
        
        // Show/hide sections based on login state and voting phase
        if (!this.isLoggedIn) {
            loginSection.style.display = 'block';
            votingStatus.style.display = 'none';
            clipsSection.style.display = 'none';
            resultsSection.style.display = 'none';
        } else {
            loginSection.style.display = 'none';
            votingStatus.style.display = 'block';
            userInfo.style.display = 'block';
            username.textContent = this.user.login;
            
            if (this.votingPhase === 'ended') {
                clipsSection.style.display = 'none';
                resultsSection.style.display = 'block';
                this.renderResults();
            } else if (this.votingPhase === 'active') {
                clipsSection.style.display = 'block';
                resultsSection.style.display = 'none';
                this.renderClips();
            } else {
                clipsSection.style.display = 'none';
                resultsSection.style.display = 'none';
            }
        }
    }

    renderClips() {
        const grid = document.getElementById('clips-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        this.clips.forEach(clip => {
            const card = this.createClipCard(clip);
            grid.appendChild(card);
        });
    }

    createClipCard(clip) {
        const card = document.createElement('div');
        card.className = 'clip-card';
        if (this.userVote === clip.id) {
            card.classList.add('voted');
        }
        
        const voteCount = this.voteCounts[clip.id] || 0;
        
        card.innerHTML = `
            <div class="clip-embed">
                <iframe
                    src="${clip.embed_url}"
                    allowfullscreen
                    frameborder="0">
                </iframe>
            </div>
            <div class="clip-info">
                <h3 class="clip-title">${this.escapeHtml(clip.title)}</h3>
                <div class="clip-meta">
                    <span class="clip-creator">👤 ${this.escapeHtml(clip.creator_name)}</span>
                    <span class="clip-views">👁️ ${clip.view_count}</span>
                </div>
                <button class="vote-btn ${this.userVote === clip.id ? 'voted' : ''}" 
                        data-clip-id="${clip.id}"
                        ${this.userVote ? 'disabled' : ''}>
                    ${this.userVote === clip.id ? '✓ Gevotet' : 'Vote'}
                </button>
                <div class="vote-count">${voteCount} ${voteCount === 1 ? 'Vote' : 'Votes'}</div>
            </div>
        `;
        
        const voteBtn = card.querySelector('.vote-btn');
        voteBtn.addEventListener('click', () => {
            this.vote(clip.id);
        });
        
        return card;
    }

    renderResults() {
        const grid = document.getElementById('results-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Sort clips by vote count
        const sortedClips = [...this.clips].sort((a, b) => {
            const votesA = this.voteCounts[a.id] || 0;
            const votesB = this.voteCounts[b.id] || 0;
            return votesB - votesA;
        });
        
        const maxVotes = Math.max(...sortedClips.map(c => this.voteCounts[c.id] || 0), 1);
        
        sortedClips.forEach((clip, index) => {
            const card = this.createResultCard(clip, index + 1, maxVotes);
            grid.appendChild(card);
        });
    }

    createResultCard(clip, rank, maxVotes) {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        const votes = this.voteCounts[clip.id] || 0;
        const percentage = (votes / maxVotes) * 100;
        
        card.innerHTML = `
            <div class="result-rank ${rank <= 3 ? 'top-3' : ''}">#${rank}</div>
            <div class="result-embed">
                <iframe
                    src="${clip.embed_url}"
                    allowfullscreen
                    frameborder="0">
                </iframe>
            </div>
            <div class="result-info">
                <h3 class="result-title">${this.escapeHtml(clip.title)}</h3>
                <div class="result-meta">
                    Von ${this.escapeHtml(clip.creator_name)} • ${clip.view_count} Views
                </div>
                <div class="result-votes">
                    <div class="votes-bar-container">
                        <div class="votes-bar" style="width: ${percentage}%">
                            ${votes} ${votes === 1 ? 'Vote' : 'Votes'}
                        </div>
                    </div>
                    <div class="votes-number">${votes}</div>
                </div>
            </div>
        `;
        
        return card;
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `status-message ${type}`;
            msgDiv.textContent = message;
            statusMessage.appendChild(msgDiv);
            
            setTimeout(() => {
                msgDiv.remove();
            }, 5000);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the voting system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VotingSystem();
});
