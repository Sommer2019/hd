// Clip des Monats - Voting System
(function() {
  'use strict';

  const CONFIG_URL = './votingData/config.json';
  const CLIPS_URL = './votingData/clips.json';
  const RESULTS_URL = './votingData/results.json';
  const VOTE_STORAGE_KEY = 'cdm_voted_clip';

  let currentConfig = null;
  let currentClips = null;
  let currentResults = null;

  // Constants for voting period calculation
  const VOTING_PERIOD_DAYS = 7; // Last 7 days of the month

  // Calculate the last week of the current month
  function getLastWeekOfMonth(referenceDate = new Date()) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    
    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const lastDayOfMonth = lastDay.getDate();
    
    // Calculate the start of the last week (VOTING_PERIOD_DAYS before the last day)
    const startOfLastWeek = new Date(year, month, lastDayOfMonth - (VOTING_PERIOD_DAYS - 1), 0, 0, 0, 0);
    const endOfLastWeek = new Date(year, month, lastDayOfMonth, 23, 59, 59, 999);
    
    return { start: startOfLastWeek, end: endOfLastWeek };
  }

  // Check if current date is in the last week of the month
  function isInLastWeekOfMonth(now = new Date()) {
    const lastWeek = getLastWeekOfMonth(now);
    return now >= lastWeek.start && now <= lastWeek.end;
  }

  // Initialize the voting system
  async function init() {
    try {
      // Load configuration
      currentConfig = await fetchJSON(CONFIG_URL);
      
      // Check if voting is currently active
      // Voting is automatically active during the last week of each month
      const now = new Date();
      const isVotingActive = isInLastWeekOfMonth(now);
      
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
      showError('Fehler beim Laden der Voting-Daten. Bitte versuche es später erneut.');
    }
  }

  // Fetch JSON data
  async function fetchJSON(url) {
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

    // Check if user has already voted
    const votedClipId = localStorage.getItem(VOTE_STORAGE_KEY);
    
    if (votedClipId) {
      showVotedMessage(votedClipId);
      return;
    }

    // Calculate and show voting period info (automatically last week of current month)
    const votingPeriod = getLastWeekOfMonth();
    const startDate = votingPeriod.start;
    const endDate = votingPeriod.end;
    
    const header = document.createElement('div');
    header.className = 'voting-header';
    header.innerHTML = `
      <h2>Voting ist aktiv!</h2>
      <p>Voting-Zeitraum: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
      <p>Du kannst für genau einen Clip abstimmen. Wähle deinen Favoriten aus!</p>
      <p><strong>${currentClips.clips.length} Clips</strong> stehen zur Auswahl.</p>
    `;
    container.appendChild(header);

    // Show clips
    const clipsGrid = document.createElement('div');
    clipsGrid.className = 'clips-grid';
    
    currentClips.clips.forEach(clip => {
      const clipCard = createClipCard(clip);
      clipsGrid.appendChild(clipCard);
    });
    
    container.appendChild(clipsGrid);
  }

  // Create clip card
  function createClipCard(clip) {
    const card = document.createElement('div');
    card.className = 'clip-card';
    
    const thumbnail = document.createElement('img');
    thumbnail.src = clip.thumbnail_url;
    thumbnail.alt = clip.title;
    thumbnail.className = 'clip-thumbnail';
    
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
    voteBtn.onclick = () => voteForClip(clip.id);
    
    const watchBtn = document.createElement('a');
    watchBtn.href = clip.url;
    watchBtn.target = '_blank';
    watchBtn.className = 'btn btn-secondary';
    watchBtn.textContent = 'Clip ansehen';
    
    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(creator);
    info.appendChild(voteBtn);
    info.appendChild(watchBtn);
    
    card.appendChild(thumbnail);
    card.appendChild(info);
    
    return card;
  }

  // Vote for a clip
  async function voteForClip(clipId) {
    // Confirm vote
    if (!confirm('Möchtest du wirklich für diesen Clip abstimmen? Du kannst nur einmal voten!')) {
      return;
    }

    try {
      // Store vote in localStorage
      localStorage.setItem(VOTE_STORAGE_KEY, clipId);
      
      // In a real implementation, you would send this to a backend
      // For now, we'll just show a success message
      showVotedMessage(clipId);
      
      // Note: In production, you would call a webhook or GitHub API here
      // Example: await submitVoteToBackend(clipId);
      
    } catch (error) {
      console.error('Error submitting vote:', error);
      localStorage.removeItem(VOTE_STORAGE_KEY);
      showError('Fehler beim Abstimmen. Bitte versuche es erneut.');
    }
  }

  // Show voted message
  function showVotedMessage(clipId) {
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
  }

  // Show results interface
  async function showResultsInterface() {
    const container = document.getElementById('voting-container');
    if (!container) return;

    if (!currentResults || !currentResults.results || currentResults.results.length === 0) {
      showError('Noch keine Ergebnisse verfügbar.');
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
  }

  // Create result card
  function createResultCard(clip, rank) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const rankBadge = document.createElement('div');
    rankBadge.className = 'rank-badge';
    rankBadge.textContent = `#${rank}`;
    
    const thumbnail = document.createElement('img');
    thumbnail.src = clip.thumbnail_url;
    thumbnail.alt = clip.title;
    thumbnail.className = 'clip-thumbnail';
    
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
    
    const watchBtn = document.createElement('a');
    watchBtn.href = clip.url;
    watchBtn.target = '_blank';
    watchBtn.className = 'btn btn-primary';
    watchBtn.textContent = 'Clip ansehen';
    
    info.appendChild(title);
    info.appendChild(votes);
    info.appendChild(meta);
    info.appendChild(creator);
    info.appendChild(watchBtn);
    
    card.appendChild(rankBadge);
    card.appendChild(thumbnail);
    card.appendChild(info);
    
    return card;
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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.CDM = {
    init,
    resetVote: () => localStorage.removeItem(VOTE_STORAGE_KEY)
  };
})();
