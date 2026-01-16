const { 
  getSupabaseClient, 
  getLatestResults, 
  setSecondVotingConfig, 
  clearClips,
  insertClips,
  clearVotesForRound 
} = require('./db-helper');

async function main() {
  const sourceYear = parseInt(process.env.SOURCE_YEAR);
  const sourceMonth = parseInt(process.env.SOURCE_MONTH);
  const durationDays = parseInt(process.env.DURATION_DAYS || '7');
  
  if (!sourceYear || !sourceMonth) {
    throw new Error('SOURCE_YEAR and SOURCE_MONTH are required');
  }
  
  if (sourceMonth < 1 || sourceMonth > 12) {
    throw new Error('SOURCE_MONTH must be between 1 and 12');
  }
  
  // Initialize Supabase
  const supabase = getSupabaseClient();
  
  // Get results from the specified month
  console.log(`Fetching results from ${sourceYear}-${sourceMonth}...`);
  const { data: monthlyResults, error: resultsError } = await supabase
    .from('results')
    .select('*')
    .eq('year', sourceYear)
    .eq('month', sourceMonth)
    .order('rank', { ascending: true })
    .limit(10);
  
  if (resultsError) throw resultsError;
  
  if (!monthlyResults || monthlyResults.length === 0) {
    throw new Error(`No results found for ${sourceYear}-${sourceMonth}`);
  }
  
  console.log(`Found ${monthlyResults.length} clips from monthly voting`);
  
  // Calculate end date
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  
  // Check if end date would be after next automatic voting period
  // Automatic voting starts on the 22nd of each month
  const currentDay = startDate.getDate();
  const currentMonth = startDate.getMonth();
  const currentYear = startDate.getFullYear();
  
  // Calculate next voting start date
  let nextVotingStart;
  if (currentDay >= 22) {
    // If we're on or after the 22nd, next voting is next month
    nextVotingStart = new Date(currentYear, currentMonth + 1, 22, 0, 0, 0);
  } else {
    // If we're before the 22nd, next voting is this month
    nextVotingStart = new Date(currentYear, currentMonth, 22, 0, 0, 0);
  }
  
  // If current date is already in automatic voting period, don't allow second voting
  if (currentDay >= 22) {
    const thisMonthVotingStart = new Date(currentYear, currentMonth, 22, 0, 0, 0);
    if (startDate >= thisMonthVotingStart) {
      throw new Error('Cannot start second voting during automatic monthly voting period');
    }
  }
  
  // Adjust end date if it would overlap with next automatic voting
  if (endDate > nextVotingStart) {
    console.log(`Adjusting end date from ${endDate.toISOString()} to ${nextVotingStart.toISOString()} to avoid overlap with next automatic voting`);
    endDate.setTime(nextVotingStart.getTime() - 1000); // 1 second before next voting starts
  }
  
  // Clear any existing second voting round votes
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
    source_year: sourceYear,
    source_month: sourceMonth
  });
  
  console.log('Second voting round started successfully!');
  console.log(`Start: ${startDate.toISOString()}`);
  console.log(`End: ${endDate.toISOString()}`);
  console.log(`Source: ${sourceYear}-${sourceMonth}`);
  console.log(`Duration: ${Math.round((endDate - startDate) / (1000 * 60 * 60 * 24))} days`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
