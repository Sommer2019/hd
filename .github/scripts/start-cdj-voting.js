const { 
  getSupabaseClient, 
  getClipDesJahres,
  setClipDesJahresVotingConfig, 
  clearClips,
  insertClips,
  clearVotesForRound 
} = require('./db-helper');

async function main() {
  const targetYear = parseInt(process.env.TARGET_YEAR);
  const durationDays = parseInt(process.env.DURATION_DAYS || '6'); // Default 6 days (Dec 15 to Dec 21)
  const isAutoStart = process.env.AUTO_START === 'true';
  
  if (!targetYear) {
    throw new Error('TARGET_YEAR is required');
  }
  
  // Initialize Supabase
  const supabase = getSupabaseClient();
  
  // Get current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  
  // Validation: Can only be started in December or later
  // (Manual start can be done after November second voting is complete)
  if (!isAutoStart) {
    // For manual start, check if we're in December or later
    // This ensures November's second voting has had time to complete
    if (currentMonth < 12) {
      throw new Error('Clip des Jahres voting can only be started in December or later');
    }
  }
  
  // Check if November's second voting was completed for the target year
  console.log(`Checking if November ${targetYear} second voting was completed...`);
  const { data: novemberResults, error: novError } = await supabase
    .from('results')
    .select('*')
    .eq('year', targetYear)
    .eq('month', 11)
    .limit(1);
  
  if (novError) throw novError;
  
  if (!novemberResults || novemberResults.length === 0) {
    throw new Error(`No second voting results found for November ${targetYear}. Cannot start Clip des Jahres voting.`);
  }
  
  // Get all clips from the clip_des_jahres table for the target year period
  // Period: December (targetYear-1) through November (targetYear)
  console.log(`Fetching clips for Clip des Jahres period (Dec ${targetYear - 1} - Nov ${targetYear})...`);
  
  // Fetch December from previous year
  const { data: decemberClips, error: decError } = await supabase
    .from('clip_des_jahres')
    .select('*')
    .eq('year', targetYear - 1)
    .eq('month', 12)
    .order('votes', { ascending: false })
    .limit(1);
  
  if (decError && decError.code !== 'PGRST116') throw decError;
  
  // Fetch January through November from target year
  const { data: yearClips, error: yearError } = await supabase
    .from('clip_des_jahres')
    .select('*')
    .eq('year', targetYear)
    .gte('month', 1)
    .lte('month', 11)
    .order('month', { ascending: true })
    .order('votes', { ascending: false });
  
  if (yearError && yearError.code !== 'PGRST116') throw yearError;
  
  // Get the top clip from each month
  const monthlyWinners = {};
  
  // Add December winner
  if (decemberClips && decemberClips.length > 0) {
    monthlyWinners[12] = decemberClips[0];
  }
  
  // Add winners from January through November
  if (yearClips && yearClips.length > 0) {
    yearClips.forEach(clip => {
      const month = clip.month;
      if (!monthlyWinners[month]) {
        monthlyWinners[month] = clip;
      }
    });
  }
  
  // Convert to array
  const clipsForVoting = Object.values(monthlyWinners);
  
  if (clipsForVoting.length === 0) {
    throw new Error(`No clips found for Clip des Jahres period (Dec ${targetYear - 1} - Nov ${targetYear})`);
  }
  
  console.log(`Found ${clipsForVoting.length} clips from monthly winners`);
  
  // Calculate end date
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  endDate.setHours(23, 59, 59, 999); // End at 23:59:59
  
  // Clear any existing CDJ voting round votes
  console.log('Clearing previous Clip des Jahres voting round votes...');
  await clearVotesForRound(supabase, 'cdj');
  
  // Clear current clips and replace with monthly winners
  console.log('Clearing current clips...');
  await clearClips(supabase);
  
  // Transform clips for voting
  const clipsForVotingTransformed = clipsForVoting.map(result => ({
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
  
  // Insert clips for CDJ voting
  console.log('Inserting monthly winners for Clip des Jahres voting...');
  const fetchMetadata = {
    fetchedAt: startDate.toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    }
  };
  await insertClips(supabase, clipsForVotingTransformed, fetchMetadata);
  
  // Set CDJ voting configuration
  console.log('Activating Clip des Jahres voting round...');
  await setClipDesJahresVotingConfig(supabase, {
    is_active: true,
    started_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    target_year: targetYear,
    auto_started: isAutoStart
  });
  
  console.log('Clip des Jahres voting round started successfully!');
  console.log(`Start: ${startDate.toISOString()}`);
  console.log(`End: ${endDate.toISOString()}`);
  console.log(`Target Year: ${targetYear}`);
  console.log(`Number of clips: ${clipsForVotingTransformed.length}`);
  console.log(`Duration: ${Math.round((endDate - startDate) / (1000 * 60 * 60 * 24))} days`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
