const { 
  getSupabaseClient, 
  getSecondVotingConfig,
  setSecondVotingConfig, 
  clearClips,
  insertClips,
  clearVotesForRound 
} = require('./db-helper');

async function main() {
  // Initialize Supabase
  const supabase = getSupabaseClient();
  
  // Configuration constants
  const END_DAY = 21;
  const END_HOUR = 23;
  const END_MINUTE = 59;
  const END_SECOND = 59;
  const END_MILLISECOND = 999;
  
  // Check current date - should be 15th of the month
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
  const currentYear = now.getFullYear();
  
  console.log(`Running auto-start check on ${currentYear}-${currentMonth}-${currentDay}`);
  
  // Calculate previous month
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  console.log(`Checking for results from ${prevYear}-${prevMonth}...`);
  
  // Check if second voting config already exists and is active
  const config = await getSecondVotingConfig(supabase);
  
  if (config && config.is_active) {
    console.log('Second voting is already active, skipping auto-start');
    console.log(`Active since: ${config.started_at}`);
    console.log(`Source: ${config.source_year}-${config.source_month}`);
    
    // Check if the active voting is for the previous month
    if (config.source_year === prevYear && config.source_month === prevMonth) {
      console.log('The active second voting is already for the previous month');
    }
    return;
  }
  
  // Get results from the previous month
  const { data: monthlyResults, error: resultsError } = await supabase
    .from('results')
    .select('*')
    .eq('year', prevYear)
    .eq('month', prevMonth)
    .order('rank', { ascending: true })
    .limit(10);
  
  if (resultsError) throw resultsError;
  
  if (!monthlyResults || monthlyResults.length === 0) {
    console.log(`No results found for ${prevYear}-${prevMonth}, cannot start second voting`);
    return;
  }
  
  console.log(`Found ${monthlyResults.length} clips from ${prevYear}-${prevMonth}`);
  console.log('Starting automatic second voting round...');
  
  // Calculate end date - 21st at 23:59:59
  const startDate = now;
  const endDate = new Date(currentYear, currentMonth - 1, END_DAY, END_HOUR, END_MINUTE, END_SECOND, END_MILLISECOND);
  
  // Validate that end date is in the future
  if (endDate <= startDate) {
    console.log('End date would be in the past, cannot start second voting');
    console.log(`Start: ${startDate.toISOString()}`);
    console.log(`End: ${endDate.toISOString()}`);
    return;
  }
  
  console.log(`Duration: ${Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24))} days`);
  
  // Clear any existing second voting round votes (just in case)
  console.log('Clearing previous second voting round votes...');
  await clearVotesForRound(supabase, 'second');
  
  // Clear current clips and replace with top 10 from monthly results
  console.log('Clearing current clips...');
  await clearClips(supabase);
  
  // Transform results to clip format
  const clipsForVoting = monthlyResults.map(result => ({
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
    vod_offset: result.vod_offset
  }));
  
  // Insert clips for second voting
  console.log('Inserting top 10 clips for second voting...');
  const fetchMetadata = {
    fetchedAt: startDate.toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    }
  };
  await insertClips(supabase, clipsForVoting, fetchMetadata);
  
  // Set second voting configuration
  console.log('Activating second voting round...');
  await setSecondVotingConfig(supabase, {
    is_active: true,
    started_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    source_year: prevYear,
    source_month: prevMonth
  });
  
  console.log('Second voting round started successfully!');
  console.log(`Start: ${startDate.toISOString()}`);
  console.log(`End: ${endDate.toISOString()}`);
  console.log(`Source: ${prevYear}-${prevMonth}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
