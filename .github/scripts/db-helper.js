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
  getLatestResults
};
