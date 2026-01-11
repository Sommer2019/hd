const fs = require('fs');
const https = require('https');

// Helper function to make HTTPS requests
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getAccessToken(clientId, clientSecret) {
  const postData = `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
  const options = {
    hostname: 'id.twitch.tv',
    path: '/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const response = await httpsRequest(options, postData);
  const data = JSON.parse(response.body);
  return data.access_token;
}

async function getBroadcasterId(channelName, accessToken, clientId) {
  const options = {
    hostname: 'api.twitch.tv',
    path: `/helix/users?login=${channelName}`,
    method: 'GET',
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`
    }
  };
  
  const response = await httpsRequest(options);
  const data = JSON.parse(response.body);
  if (data.data && data.data.length > 0) {
    return data.data[0].id;
  }
  throw new Error('Channel not found');
}

async function getClips(broadcasterId, startDate, endDate, accessToken, clientId) {
  let allClips = [];
  let cursor = null;
  
  do {
    let path = `/helix/clips?broadcaster_id=${broadcasterId}&started_at=${startDate}&ended_at=${endDate}&first=100`;
    if (cursor) {
      path += `&after=${cursor}`;
    }
    
    const options = {
      hostname: 'api.twitch.tv',
      path: path,
      method: 'GET',
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    };
    
    const response = await httpsRequest(options);
    const data = JSON.parse(response.body);
    
    if (data.data) {
      allClips = allClips.concat(data.data);
    }
    
    cursor = data.pagination && data.pagination.cursor;
  } while (cursor);
  
  return allClips;
}

async function main() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET');
    process.exit(1);
  }
  
  // Read config
  const configPath = './votingData/config.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Determine date range
  let startDate, endDate;
  
  if (process.env.MANUAL_START_DATE && process.env.MANUAL_END_DATE) {
    startDate = new Date(process.env.MANUAL_START_DATE).toISOString();
    endDate = new Date(process.env.MANUAL_END_DATE).toISOString();
  } else if (process.env.VOTING_START_DATE && process.env.VOTING_END_DATE) {
    startDate = new Date(process.env.VOTING_START_DATE).toISOString();
    endDate = new Date(process.env.VOTING_END_DATE).toISOString();
  } else {
    // Default: previous month
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const firstDayLastMonth = new Date(year, month, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    startDate = firstDayLastMonth.toISOString();
    endDate = lastDayLastMonth.toISOString();
  }
  
  console.log(`Fetching clips from ${startDate} to ${endDate}`);
  
  // Get access token
  const accessToken = await getAccessToken(clientId, clientSecret);
  
  // Get broadcaster ID
  const broadcasterId = await getBroadcasterId(config.twitchChannel, accessToken, clientId);
  console.log(`Broadcaster ID: ${broadcasterId}`);
  
  // Fetch clips
  const clips = await getClips(broadcasterId, startDate, endDate, accessToken, clientId);
  console.log(`Fetched ${clips.length} clips`);
  
  // Save clips
  const clipsData = {
    clips: clips.map(clip => ({
      id: clip.id,
      url: clip.url,
      embed_url: clip.embed_url,
      broadcaster_id: clip.broadcaster_id,
      broadcaster_name: clip.broadcaster_name,
      creator_id: clip.creator_id,
      creator_name: clip.creator_name,
      video_id: clip.video_id,
      game_id: clip.game_id,
      language: clip.language,
      title: clip.title,
      view_count: clip.view_count,
      created_at: clip.created_at,
      thumbnail_url: clip.thumbnail_url,
      duration: clip.duration,
      vod_offset: clip.vod_offset
    })),
    fetchedAt: new Date().toISOString(),
    period: {
      start: startDate,
      end: endDate
    }
  };
  
  fs.writeFileSync('./votingData/clips.json', JSON.stringify(clipsData, null, 2));
  
  // Update config with voting period
  config.votingPeriod = {
    start: startDate,
    end: endDate
  };
  config.status = 'active';
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log('Clips saved successfully');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
