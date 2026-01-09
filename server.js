const express = require('express');
const session = require('express-session');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage (in production, use a database)
const votes = new Map(); // userId -> clipId
const voteCounts = new Map(); // clipId -> count

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Load configuration from config.txt
function loadConfig() {
  const configPath = path.join(__dirname, 'config.txt');
  const config = {};
  
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    const lines = data.split('\n');
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          config[key.trim()] = value.trim();
        }
      }
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }
  
  return config;
}

// Get Twitch App Access Token
async function getTwitchToken() {
  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Twitch token:', error);
    throw error;
  }
}

// Get broadcaster ID from username
async function getBroadcasterId(username, token) {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/users', {
      params: { login: username },
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data.data[0]?.id;
  } catch (error) {
    console.error('Error getting broadcaster ID:', error);
    throw error;
  }
}

// Fetch clips from Twitch API
async function fetchClips(broadcasterId, startDate, endDate, token) {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/clips', {
      params: {
        broadcaster_id: broadcasterId,
        started_at: startDate,
        ended_at: endDate,
        first: 100
      },
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Sort by view count and return top clips
    const clips = response.data.data.sort((a, b) => b.view_count - a.view_count);
    return clips;
  } catch (error) {
    console.error('Error fetching clips:', error);
    throw error;
  }
}

// API Routes

// Get configuration
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  res.json(config);
});

// Get clips for voting
app.get('/api/clips', async (req, res) => {
  try {
    const config = loadConfig();
    const token = await getTwitchToken();
    const broadcasterId = await getBroadcasterId(config.TWITCH_BROADCASTER_ID, token);
    
    const clips = await fetchClips(
      broadcasterId,
      config.CLIPS_START,
      config.CLIPS_END,
      token
    );
    
    const maxClips = parseInt(config.MAX_CLIPS || '10');
    const topClips = clips.slice(0, maxClips);
    
    // Add vote counts to clips
    const clipsWithVotes = topClips.map(clip => ({
      ...clip,
      votes: voteCounts.get(clip.id) || 0
    }));
    
    res.json(clipsWithVotes);
  } catch (error) {
    console.error('Error in /api/clips:', error);
    res.status(500).json({ error: 'Failed to fetch clips' });
  }
});

// Twitch OAuth - Start authentication
app.get('/api/auth/twitch', (req, res) => {
  const redirectUri = process.env.TWITCH_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=user:read:email`;
  res.json({ authUrl });
});

// Twitch OAuth - Callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('/html/voting.html?error=auth_failed');
  }
  
  try {
    // Exchange code for access token
    const redirectUri = process.env.TWITCH_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
    const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }
    });
    
    const accessToken = tokenResponse.data.access_token;
    
    // Get user info
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const user = userResponse.data.data[0];
    
    // Store user info in session
    req.session.user = {
      id: user.id,
      login: user.login,
      display_name: user.display_name
    };
    
    res.redirect('/html/voting.html?auth=success');
  } catch (error) {
    console.error('Error in auth callback:', error);
    res.redirect('/html/voting.html?error=auth_failed');
  }
});

// Get current user
app.get('/api/user', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Submit vote
app.post('/api/vote', (req, res) => {
  const { clipId } = req.body;
  
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const config = loadConfig();
  const now = new Date();
  const votingStart = new Date(config.VOTING_START);
  const votingEnd = new Date(config.VOTING_END);
  
  if (now < votingStart) {
    return res.status(400).json({ error: 'Voting has not started yet' });
  }
  
  if (now > votingEnd) {
    return res.status(400).json({ error: 'Voting has ended' });
  }
  
  const userId = req.session.user.id;
  
  // Check if user has already voted
  if (votes.has(userId)) {
    return res.status(400).json({ error: 'You have already voted' });
  }
  
  // Record vote
  votes.set(userId, clipId);
  voteCounts.set(clipId, (voteCounts.get(clipId) || 0) + 1);
  
  res.json({ success: true, message: 'Vote recorded successfully' });
});

// Get results
app.get('/api/results', async (req, res) => {
  try {
    const config = loadConfig();
    const now = new Date();
    const votingEnd = new Date(config.VOTING_END);
    
    // Only show results after voting ends
    if (now < votingEnd) {
      return res.status(400).json({ error: 'Results not available yet' });
    }
    
    const token = await getTwitchToken();
    const broadcasterId = await getBroadcasterId(config.TWITCH_BROADCASTER_ID, token);
    
    const clips = await fetchClips(
      broadcasterId,
      config.CLIPS_START,
      config.CLIPS_END,
      token
    );
    
    // Add vote counts and sort by votes
    const clipsWithVotes = clips.map(clip => ({
      ...clip,
      votes: voteCounts.get(clip.id) || 0
    })).sort((a, b) => b.votes - a.votes);
    
    const maxClips = parseInt(config.MAX_CLIPS || '10');
    
    res.json({
      totalVotes: votes.size,
      topClips: clipsWithVotes.slice(0, maxClips)
    });
  } catch (error) {
    console.error('Error in /api/results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure to set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in environment variables or .env file');
});
