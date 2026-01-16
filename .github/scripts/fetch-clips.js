const fs = require('fs');
const https = require('https');
const { getSupabaseClient, clearClips, insertClips } = require('./db-helper');

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

function getLastWeekOfMonth(year, month) {
  // month is 0-indexed (0 = January, 11 = December)
  // Get the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfMonth = lastDay.getDate();
  
  // Calculate the start of the last week (7 days before the last day)
  const startOfLastWeek = new Date(year, month, lastDayOfMonth - 6, 0, 0, 0, 0);
  const endOfLastWeek = new Date(year, month, lastDayOfMonth, 23, 59, 59, 999);
  
  return { start: startOfLastWeek, end: endOfLastWeek };
}

function getSecondToLastWeekOfMonth(year, month) {
  // month is 0-indexed
  // Get the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfMonth = lastDay.getDate();
  
  // The second-to-last week ends 7 days before the last day
  const endOfSecondToLastWeek = new Date(year, month, lastDayOfMonth - 7, 23, 59, 59, 999);
  
  return { end: endOfSecondToLastWeek };
}

function calculateVotingAndClipsPeriods(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed
  
  // Voting period: Last week of current month
  const votingPeriod = getLastWeekOfMonth(year, month);
  
  // Clips period: Last week of previous month through second-to-last week of current month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  
  const clipsStart = getLastWeekOfMonth(prevYear, prevMonth).start;
  const clipsEnd = getSecondToLastWeekOfMonth(year, month).end;
  
  return {
    votingPeriod,
    clipsPeriod: {
      start: clipsStart,
      end: clipsEnd
    }
  };
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
  let clipsStartDate, clipsEndDate, votingStartDate, votingEndDate;
  
  if (process.env.MANUAL_START_DATE && process.env.MANUAL_END_DATE) {
    // Manual override: use provided dates for clips
    // Note: For manual runs, we still calculate the voting period separately
    // to maintain the design that voting is in the last week of the month
    const manualStart = new Date(process.env.MANUAL_START_DATE);
    const manualEnd = new Date(process.env.MANUAL_END_DATE);
    
    clipsStartDate = manualStart.toISOString();
    clipsEndDate = manualEnd.toISOString();
    
    // Calculate voting period for the month containing the manual end date
    const endYear = manualEnd.getFullYear();
    const endMonth = manualEnd.getMonth();
    const votingPeriod = getLastWeekOfMonth(endYear, endMonth);
    
    votingStartDate = votingPeriod.start.toISOString();
    votingEndDate = votingPeriod.end.toISOString();
  } else if (process.env.VOTING_START_DATE && process.env.VOTING_END_DATE) {
    // Legacy environment variables: use as-is for backward compatibility
    clipsStartDate = new Date(process.env.VOTING_START_DATE).toISOString();
    clipsEndDate = new Date(process.env.VOTING_END_DATE).toISOString();
    votingStartDate = clipsStartDate;
    votingEndDate = clipsEndDate;
  } else {
    // Default: Calculate based on current date
    // Clips: last week of previous month through second-to-last week of current month
    // Voting: last week of current month
    const now = new Date();
    const periods = calculateVotingAndClipsPeriods(now);
    
    clipsStartDate = periods.clipsPeriod.start.toISOString();
    clipsEndDate = periods.clipsPeriod.end.toISOString();
    votingStartDate = periods.votingPeriod.start.toISOString();
    votingEndDate = periods.votingPeriod.end.toISOString();
  }
  
  console.log(`Fetching clips from ${clipsStartDate} to ${clipsEndDate}`);
  console.log(`Voting period will be from ${votingStartDate} to ${votingEndDate}`);
  
  // Get access token
  const accessToken = await getAccessToken(clientId, clientSecret);
  
  // Get broadcaster ID
  const broadcasterId = await getBroadcasterId(config.twitchChannel, accessToken, clientId);
  console.log(`Broadcaster ID: ${broadcasterId}`);
  
  // Fetch clips
  const clips = await getClips(broadcasterId, clipsStartDate, clipsEndDate, accessToken, clientId);
  console.log(`Fetched ${clips.length} clips`);
  
  // Save clips to Supabase
  const supabase = getSupabaseClient();
  
  // Clear old clips
  console.log('Clearing old clips from database...');
  await clearClips(supabase);
  
  // Prepare clips data
  const clipsData = clips.map(clip => ({
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
  }));
  
  const fetchMetadata = {
    fetchedAt: new Date().toISOString(),
    period: {
      start: clipsStartDate,
      end: clipsEndDate
    }
  };
  
  // Insert new clips
  console.log('Inserting new clips into database...');
  await insertClips(supabase, clipsData, fetchMetadata);
  
  // Also save to JSON file for backward compatibility
  const clipsJsonData = {
    clips: clipsData,
    fetchedAt: fetchMetadata.fetchedAt,
    period: fetchMetadata.period
  };
  
  fs.writeFileSync('./votingData/clips.json', JSON.stringify(clipsJsonData, null, 2));
  
  // Update config with voting period
  config.votingPeriod = {
    start: votingStartDate,
    end: votingEndDate
  };
  config.status = 'active';
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log('Clips saved successfully');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
