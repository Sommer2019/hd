const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Clear all clips from the database
async function clearClips(supabase) {
  const { error } = await supabase
    .from('clips')
    .delete()
    .gte('id', 0);  // Delete all records (id is always >= 0)
  
  if (error) throw error;
}

// Insert clips into the database
async function insertClips(supabase, clips, fetchMetadata) {
  const clipsToInsert = clips.map(clip => ({
    clip_id: clip.id,
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
    vod_offset: clip.vod_offset,
    fetched_at: fetchMetadata.fetchedAt,
    period_start: fetchMetadata.period.start,
    period_end: fetchMetadata.period.end
  }));
  
  const { error } = await supabase
    .from('clips')
    .insert(clipsToInsert);
  
  if (error) throw error;
}

// Get all clips
async function getClips(supabase) {
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .order('view_count', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Check if IP has voted
async function hasVoted(supabase, ipHash) {
  const { data, error } = await supabase
    .from('votes')
    .select('id')
    .eq('ip_hash', ipHash)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }
  
  return data !== null;
}

// Record a vote
async function recordVote(supabase, ipHash, clipId) {
  const { error } = await supabase
    .from('votes')
    .insert({
      ip_hash: ipHash,
      clip_id: clipId,
      voted_at: new Date().toISOString()
    });
  
  if (error) throw error;
}

// Get all votes
async function getVotes(supabase) {
  const { data, error } = await supabase
    .from('votes')
    .select('*');
  
  if (error) throw error;
  return data || [];
}

// Clear all votes
async function clearVotes(supabase) {
  const { error } = await supabase
    .from('votes')
    .delete()
    .gte('id', 0);  // Delete all records (id is always >= 0)
  
  if (error) throw error;
}

// Save results for a specific month
async function saveResults(supabase, results, metadata) {
  const year = new Date(metadata.calculatedAt).getFullYear();
  const month = new Date(metadata.calculatedAt).getMonth() + 1;
  
  // Delete existing results for this month
  await supabase
    .from('results')
    .delete()
    .eq('year', year)
    .eq('month', month);
  
  // Insert new results
  const resultsToInsert = results.map((clip, index) => ({
    year,
    month,
    rank: index + 1,
    clip_id: clip.id,
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
    vod_offset: clip.vod_offset,
    votes: clip.votes,
    calculated_at: metadata.calculatedAt,
    period_start: metadata.period.start,
    period_end: metadata.period.end,
    total_votes: metadata.totalVotes
  }));
  
  const { error } = await supabase
    .from('results')
    .insert(resultsToInsert);
  
  if (error) throw error;
}

// Get results for current or previous month
async function getLatestResults(supabase) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Try current month first
  let { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .order('rank', { ascending: true });
  
  if (error) throw error;
  
  // If no results for current month, try previous month
  if (!data || data.length === 0) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    const result = await supabase
      .from('results')
      .select('*')
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .order('rank', { ascending: true });
    
    if (result.error) throw result.error;
    data = result.data;
  }
  
  return data || [];
}

// Get second voting round configuration
async function getSecondVotingConfig(supabase) {
  const { data, error } = await supabase
    .from('second_voting_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }
  
  return data;
}

// Create or update second voting config
async function setSecondVotingConfig(supabase, config) {
  // Get existing config
  const existing = await getSecondVotingConfig(supabase);
  
  if (existing) {
    // Update existing config
    const { error } = await supabase
      .from('second_voting_config')
      .update({
        ...config,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    
    if (error) throw error;
  } else {
    // Insert new config
    const { error } = await supabase
      .from('second_voting_config')
      .insert({
        ...config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }
}

// Save clips to clip_des_jahres table
async function saveClipDesJahres(supabase, clips, year, month) {
  // Delete existing entries for this year/month
  await supabase
    .from('clip_des_jahres')
    .delete()
    .eq('year', year)
    .eq('month', month);
  
  // Insert new clips
  const clipsToInsert = clips.map(clip => ({
    year,
    month,
    clip_id: clip.id,
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
    vod_offset: clip.vod_offset,
    votes: clip.votes,
    calculated_at: new Date().toISOString()
  }));
  
  const { error } = await supabase
    .from('clip_des_jahres')
    .insert(clipsToInsert);
  
  if (error) throw error;
}

// Get clip des jahres entries for a specific year
async function getClipDesJahres(supabase, year) {
  const { data, error } = await supabase
    .from('clip_des_jahres')
    .select('*')
    .eq('year', year)
    .order('month', { ascending: true })
    .order('votes', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Delete old clip des jahres entries (for previous years)
async function deleteOldClipDesJahres(supabase, beforeYear) {
  const { error } = await supabase
    .from('clip_des_jahres')
    .delete()
    .lt('year', beforeYear);
  
  if (error) throw error;
}

// Check if IP has voted in a specific voting round
async function hasVotedInRound(supabase, ipHash, votingRound = 'monthly') {
  const { data, error } = await supabase
    .from('votes')
    .select('id')
    .eq('ip_hash', ipHash)
    .eq('voting_round', votingRound)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }
  
  return data !== null;
}

// Record a vote for a specific voting round
async function recordVoteInRound(supabase, ipHash, clipId, votingRound = 'monthly') {
  const { error } = await supabase
    .from('votes')
    .insert({
      ip_hash: ipHash,
      clip_id: clipId,
      voting_round: votingRound,
      voted_at: new Date().toISOString()
    });
  
  if (error) throw error;
}

// Get votes for a specific voting round
async function getVotesForRound(supabase, votingRound = 'monthly') {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('voting_round', votingRound);
  
  if (error) throw error;
  return data || [];
}

// Clear votes for a specific voting round
async function clearVotesForRound(supabase, votingRound = 'monthly') {
  const { error } = await supabase
    .from('votes')
    .delete()
    .eq('voting_round', votingRound);
  
  if (error) throw error;
}

// Get Clip des Jahres voting configuration
async function getClipDesJahresVotingConfig(supabase) {
  const { data, error } = await supabase
    .from('cdj_voting_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }
  
  return data;
}

// Create or update Clip des Jahres voting config
async function setClipDesJahresVotingConfig(supabase, config) {
  // Get existing config
  const existing = await getClipDesJahresVotingConfig(supabase);
  
  if (existing) {
    // Update existing config
    const { error } = await supabase
      .from('cdj_voting_config')
      .update({
        ...config,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    
    if (error) throw error;
  } else {
    // Insert new config
    const { error } = await supabase
      .from('cdj_voting_config')
      .insert({
        ...config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }
}

// Save Clip des Jahres winner
async function saveClipDesJahresWinner(supabase, clip, year) {
  // Delete existing winner for this year
  await supabase
    .from('cdj_winners')
    .delete()
    .eq('year', year);
  
  // Insert new winner
  const { error } = await supabase
    .from('cdj_winners')
    .insert({
      year,
      clip_id: clip.id,
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
      vod_offset: clip.vod_offset,
      votes: clip.votes,
      calculated_at: new Date().toISOString()
    });
  
  if (error) throw error;
}

// Get Clip des Jahres winner for a specific year
async function getClipDesJahresWinner(supabase, year) {
  const { data, error } = await supabase
    .from('cdj_winners')
    .select('*')
    .eq('year', year)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data;
}

// Get page view statistics
async function getPageViewStats(supabase, timeRange) {
  const now = new Date();
  let startDate;
  
  switch (timeRange) {
    case '24h':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = null; // All time
  }
  
  let query = supabase.from('page_views').select('*', { count: 'exact', head: true });
  
  if (startDate) {
    query = query.gte('viewed_at', startDate.toISOString());
  }
  
  const { count, error } = await query;
  
  if (error) throw error;
  return count || 0;
}

// Get page view statistics by page
async function getPageViewStatsByPage(supabase, timeRange) {
  const now = new Date();
  let startDate;
  
  switch (timeRange) {
    case '24h':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = null; // All time
  }
  
  let query = supabase.from('page_views').select('page_path');
  
  if (startDate) {
    query = query.gte('viewed_at', startDate.toISOString());
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  // Count views by page
  const pageStats = {};
  (data || []).forEach(view => {
    const page = view.page_path;
    pageStats[page] = (pageStats[page] || 0) + 1;
  });
  
  return pageStats;
}

// Get total page views
async function getTotalPageViews(supabase) {
  const { count, error } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true });
  
  if (error) throw error;
  return count || 0;
}

module.exports = {
  getSupabaseClient,
  clearClips,
  insertClips,
  getClips,
  hasVoted,
  recordVote,
  getVotes,
  clearVotes,
  saveResults,
  getLatestResults,
  getSecondVotingConfig,
  setSecondVotingConfig,
  saveClipDesJahres,
  getClipDesJahres,
  deleteOldClipDesJahres,
  hasVotedInRound,
  recordVoteInRound,
  getVotesForRound,
  clearVotesForRound,
  getClipDesJahresVotingConfig,
  setClipDesJahresVotingConfig,
  saveClipDesJahresWinner,
  getClipDesJahresWinner,
  getPageViewStats,
  getPageViewStatsByPage,
  getTotalPageViews
};
