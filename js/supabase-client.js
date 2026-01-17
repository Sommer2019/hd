// Supabase Browser Client
// This file provides Supabase access from the browser

// Supabase configuration - these are PUBLIC keys that are safe to expose in client-side code
// The publishable/anon key is designed to be used in browser applications
// ⚠️ IMPORTANT: Replace SUPABASE_PUBLISHABLE_KEY with your actual anon key from Supabase dashboard
// Go to: Supabase Project Settings → API → Project API keys → anon/public key
const SUPABASE_URL = 'https://itbmerllqlwoinsletkz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0Ym1lcmxscWx3b2luc2xldGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Nzc1NzksImV4cCI6MjA4NDE1MzU3OX0.k8fHdFB2R31mB5spP5fukb0h0X_ToExrLBrcW4uL4fE'; // Replace with actual key from Supabase dashboard

// Initialize Supabase client using CDN
let supabaseClient = null;

// Load Supabase client from CDN
function loadSupabaseClient() {
  return new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Supabase client'));
    };
    document.head.appendChild(script);
  });
}

// Get Supabase client instance
async function getSupabaseClient() {
  if (!supabaseClient) {
    await loadSupabaseClient();
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return supabaseClient;
}

// Get all clips from database
async function fetchClipsFromDB() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .order('view_count', { ascending: false });
  
  if (error) throw error;
  
  // Transform database format to expected format
  return {
    clips: (data || []).map(clip => ({
      id: clip.clip_id,
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
    fetchedAt: data && data.length > 0 ? data[0].fetched_at : new Date().toISOString(),
    period: data && data.length > 0 ? {
      start: data[0].period_start,
      end: data[0].period_end
    } : { start: null, end: null }
  };
}

// Get latest results from database
async function fetchResultsFromDB() {
  const supabase = await getSupabaseClient();
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
  
  if (!data || data.length === 0) {
    return null;
  }
  
  // Transform to expected format
  const firstResult = data[0];
  return {
    results: data.map(result => ({
      id: result.clip_id,
      url: result.url,
      embed_url: result.embed_url,
      broadcaster_id: result.broadcaster_id,
      broadcaster_name: result.broadcaster_name,
      creator_id: result.creator_id,
      creator_name: result.creator_name,
      video_id: result.video_id,
      game_id: result.game_id,
      language: result.language,
      title: result.title,
      view_count: result.view_count,
      created_at: result.created_at,
      thumbnail_url: result.thumbnail_url,
      duration: result.duration,
      vod_offset: result.vod_offset,
      votes: result.votes
    })),
    calculatedAt: firstResult.calculated_at,
    period: {
      start: firstResult.period_start,
      end: firstResult.period_end
    },
    totalVotes: firstResult.total_votes
  };
}

// Get second voting round configuration
async function getSecondVotingConfig() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('second_voting_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data;
}

// Submit vote (supports both regular and second voting rounds)
async function submitVoteToDB(clipId, ipHash, votingRound = 'monthly') {
  const supabase = await getSupabaseClient();
  
  // Check if already voted in this voting round
  const { data: existingVote, error: checkError } = await supabase
    .from('votes')
    .select('id')
    .eq('ip_hash', ipHash)
    .eq('voting_round', votingRound)
    .single();
  
  if (existingVote) {
    throw new Error('Already voted');
  }
  
  if (checkError && checkError.code !== 'PGRST116') {
    throw checkError;
  }
  
  // Insert vote
  const { error: insertError } = await supabase
    .from('votes')
    .insert({
      ip_hash: ipHash,
      clip_id: clipId,
      voting_round: votingRound,
      voted_at: new Date().toISOString()
    });
  
  if (insertError) throw insertError;
}

// Get Clip des Jahres for a specific year
async function fetchClipDesJahres(year) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('clip_des_jahres')
    .select('*')
    .eq('year', year)
    .order('month', { ascending: true })
    .order('votes', { ascending: false });
  
  if (error) throw error;
  
  return data || [];
}

// Get Clip des Jahres voting configuration
async function getClipDesJahresVotingConfig() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('cdj_voting_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  return data;
}

// Get Clip des Jahres winner for a specific year
async function fetchClipDesJahresWinner(year) {
  const supabase = await getSupabaseClient();
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
