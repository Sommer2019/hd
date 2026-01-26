// Stream Status Manager
// Checks if Twitch stream is live and manages stream/offline state

const TWITCH_CHANNEL = 'hd1920x1080';
const CHECK_INTERVAL = 60000; // Check every 60 seconds
let checkIntervalId = null;
let currentStreamStatus = null;

// Check if stream is live using Twitch embed API
// Expected responses from decapi.me:
// - When live: "X hours Y minutes Z seconds" (or similar time format)
// - When offline: "channel is offline" or similar message with "offline"/"not" keywords
async function checkStreamStatus() {
  try {
    // Use decapi.me Twitch uptime API to check stream status
    const response = await fetch(`https://decapi.me/twitch/uptime/${TWITCH_CHANNEL}?precision=7`);
    const text = await response.text();
    
    // If stream is offline, the API typically returns a message containing "offline" or "not"
    // If live, it returns the uptime duration (e.g., "2 hours 30 minutes")
    const textLower = text.toLowerCase();
    const isLive = !textLower.includes('offline') && !textLower.includes('not') && text.trim().length > 0;
    
    return isLive;
  } catch (error) {
    console.warn('Error checking stream status:', error);
    // On error, assume live to show the embed (fail-safe)
    return true;
  }
}

// Format date/time for display
function formatStreamTime(dateString) {
  try {
    const date = new Date(dateString);
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin'
    };
    return date.toLocaleString('de-DE', options) + ' Uhr';
  } catch (error) {
    return dateString;
  }
}

// Show offline message with next stream info
async function showOfflineMessage() {
  try {
    // Check if getNextStream function is available
    if (typeof getNextStream !== 'function') {
      console.warn('getNextStream function not available - showing fallback message');
      showOfflineFallback();
      return;
    }
    
    // Get next stream from Supabase
    const nextStream = await getNextStream();
    
    const playerWrapper = document.querySelector('.responsive-embed.player');
    if (!playerWrapper) return;
    
    // Create offline message
    const offlineDiv = document.createElement('div');
    offlineDiv.className = 'stream-offline-message';
    offlineDiv.innerHTML = `
      <div class="offline-content">
        <div class="offline-icon">📺</div>
        <h2>Stream ist offline</h2>
        ${nextStream ? `
          <div class="next-stream-info">
            <h3>Nächster Stream:</h3>
            <p class="stream-title">${nextStream.title || 'Stream'}</p>
            <p class="stream-time">${formatStreamTime(nextStream.start_time)}</p>
          </div>
        ` : `
          <p>Schau bald wieder vorbei!</p>
          <p><a href="streamplan.html" class="streamplan-link">Zum Streamplan →</a></p>
        `}
      </div>
    `;
    
    // Hide iframe and show offline message
    const iframe = playerWrapper.querySelector('.twitch-player-iframe');
    if (iframe) {
      iframe.style.display = 'none';
    }
    
    // Remove any existing offline message
    const existing = playerWrapper.querySelector('.stream-offline-message');
    if (existing) {
      existing.remove();
    }
    
    playerWrapper.appendChild(offlineDiv);
  } catch (error) {
    console.warn('Error showing offline message:', error);
  }
}

// Show offline fallback message when next stream data is unavailable
function showOfflineFallback() {
  const playerWrapper = document.querySelector('.responsive-embed.player');
  if (!playerWrapper) return;
  
  const iframe = playerWrapper.querySelector('.twitch-player-iframe');
  if (iframe) {
    iframe.style.display = 'none';
  }
  
  const offlineDiv = document.createElement('div');
  offlineDiv.className = 'stream-offline-message';
  offlineDiv.innerHTML = `
    <div class="offline-content">
      <div class="offline-icon">📺</div>
      <h2>Stream ist offline</h2>
      <p>Schau bald wieder vorbei!</p>
      <p><a href="streamplan.html" class="streamplan-link">Zum Streamplan →</a></p>
    </div>
  `;
  
  const existing = playerWrapper.querySelector('.stream-offline-message');
  if (existing) {
    existing.remove();
  }
  
  playerWrapper.appendChild(offlineDiv);
}

// Show stream embed (remove offline message)
function showStreamEmbed() {
  const playerWrapper = document.querySelector('.responsive-embed.player');
  if (!playerWrapper) return;
  
  const iframe = playerWrapper.querySelector('.twitch-player-iframe');
  const offlineMessage = playerWrapper.querySelector('.stream-offline-message');
  
  if (iframe) {
    iframe.style.display = '';
  }
  
  if (offlineMessage) {
    offlineMessage.remove();
  }
}

// Update stream display based on status
async function updateStreamDisplay() {
  const isLive = await checkStreamStatus();
  
  // Only update if status changed
  if (currentStreamStatus !== isLive) {
    currentStreamStatus = isLive;
    
    if (isLive) {
      console.log('Stream is live - showing embed');
      showStreamEmbed();
    } else {
      console.log('Stream is offline - showing message');
      await showOfflineMessage();
    }
  }
}

// Start monitoring stream status
function startStreamMonitoring() {
  // Stop any existing monitoring
  stopStreamMonitoring();
  
  // Initial check
  updateStreamDisplay();
  
  // Set up periodic checking
  checkIntervalId = setInterval(updateStreamDisplay, CHECK_INTERVAL);
  
  console.log('Stream monitoring started (checking every 60 seconds)');
}

// Stop monitoring stream status
function stopStreamMonitoring() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
    console.log('Stream monitoring stopped');
  }
}

// Initialize stream status checking when page loads
(function initStreamStatus() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStreamMonitoring);
  } else {
    startStreamMonitoring();
  }
  
  // Stop monitoring when page is hidden (to save resources)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopStreamMonitoring();
    } else {
      startStreamMonitoring();
    }
  });
})();
