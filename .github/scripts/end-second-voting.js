const { 
  getSupabaseClient, 
  getClips,
  getVotesForRound,
  clearVotesForRound,
  getSecondVotingConfig,
  setSecondVotingConfig,
  saveResults,
  saveClipDesJahres,
  deleteOldClipDesJahres
} = require('./db-helper');

async function main() {
  // Initialize Supabase
  const supabase = getSupabaseClient();
  
  // Get second voting config
  console.log('Checking second voting round status...');
  const config = await getSecondVotingConfig(supabase);
  
  if (!config || !config.is_active) {
    console.log('No active second voting round found');
    return;
  }
  
  console.log(`Ending second voting round started at ${config.started_at}`);
  
  // Get clips from the second voting
  console.log('Fetching clips from second voting...');
  const clips = await getClips(supabase);
  
  if (clips.length === 0) {
    console.log('No clips found in second voting');
    await setSecondVotingConfig(supabase, { is_active: false });
    return;
  }
  
  // Get votes from second voting round
  console.log('Fetching votes from second voting round...');
  const votes = await getVotesForRound(supabase, 'second');
  
  // Count votes per clip
  const voteCount = {};
  votes.forEach(vote => {
    const clipId = vote.clip_id;
    voteCount[clipId] = (voteCount[clipId] || 0) + 1;
  });
  
  // Create array of clips with vote counts
  const clipsWithVotes = clips.map(clip => ({
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
    vod_offset: clip.vod_offset,
    votes: voteCount[clip.clip_id] || 0
  }));
  
  // Sort by votes (descending) and view_count as tiebreaker
  clipsWithVotes.sort((a, b) => {
    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }
    return b.view_count - a.view_count;
  });
  
  console.log(`Total votes in second round: ${votes.length}`);
  console.log(`Clips sorted by votes`);
  
  // Replace the monthly results with second voting results
  const sourceYear = config.source_year;
  const sourceMonth = config.source_month;
  
  const resultsMetadata = {
    calculatedAt: new Date().toISOString(),
    period: {
      start: config.started_at,
      end: new Date().toISOString()
    },
    totalVotes: votes.length
  };
  
  console.log(`Replacing results for ${sourceYear}-${sourceMonth} with second voting results...`);
  await saveResults(supabase, clipsWithVotes, resultsMetadata);
  
  // Find clip(s) with the most votes for "Clip des Jahres"
  const maxVotes = clipsWithVotes[0]?.votes || 0;
  const winners = clipsWithVotes.filter(clip => clip.votes === maxVotes && clip.votes > 0);
  
  if (winners.length > 0) {
    console.log(`Saving ${winners.length} winner(s) to Clip des Jahres...`);
    
    // Get the month from the calculated date
    const calculatedDate = new Date(resultsMetadata.calculatedAt);
    const calculatedYear = calculatedDate.getFullYear();
    const calculatedMonth = calculatedDate.getMonth() + 1;
    
    // Clean up old years' data if we're in a new year
    const actualCurrentYear = new Date().getFullYear();
    if (actualCurrentYear > calculatedYear) {
      console.log(`Cleaning up Clip des Jahres data from years before ${actualCurrentYear}...`);
      await deleteOldClipDesJahres(supabase, actualCurrentYear);
    }
    
    // Check if this is the first clip of a new year's month
    const existingClips = await supabase
      .from('clip_des_jahres')
      .select('year, month')
      .eq('year', calculatedYear)
      .eq('month', calculatedMonth);
    
    // If this is a new year and we have clips from the previous year, clean them up
    if (!existingClips.data || existingClips.data.length === 0) {
      const previousYearClips = await supabase
        .from('clip_des_jahres')
        .select('year')
        .lt('year', calculatedYear)
        .limit(1);
      
      if (previousYearClips.data && previousYearClips.data.length > 0) {
        console.log(`First clip of new year detected, removing old year data...`);
        await deleteOldClipDesJahres(supabase, calculatedYear);
      }
    }
    
    // Save winners to clip_des_jahres
    await saveClipDesJahres(supabase, winners, calculatedYear, calculatedMonth);
    
    console.log(`Winners saved with ${maxVotes} votes each`);
  } else {
    console.log('No votes were cast in this round');
  }
  
  // Clear second voting round votes
  console.log('Clearing second voting round votes...');
  await clearVotesForRound(supabase, 'second');
  
  // Deactivate second voting round
  console.log('Deactivating second voting round...');
  await setSecondVotingConfig(supabase, { is_active: false });
  
  console.log('Second voting round ended successfully!');
  console.log(`Results saved for ${sourceYear}-${sourceMonth}`);
  console.log(`Total clips: ${clipsWithVotes.length}`);
  console.log(`Winners in Clip des Jahres: ${winners.length}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
