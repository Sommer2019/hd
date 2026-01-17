const { 
  getSupabaseClient, 
  getClips,
  getVotesForRound,
  clearVotesForRound,
  getClipDesJahresVotingConfig,
  setClipDesJahresVotingConfig,
  saveClipDesJahresWinner
} = require('./db-helper');

async function main() {
  // Initialize Supabase
  const supabase = getSupabaseClient();
  
  // Get CDJ voting config
  console.log('Checking Clip des Jahres voting round status...');
  const config = await getClipDesJahresVotingConfig(supabase);
  
  if (!config || !config.is_active) {
    console.log('No active Clip des Jahres voting round found');
    return;
  }
  
  console.log(`Ending Clip des Jahres voting round started at ${config.started_at}`);
  
  // Get clips from the CDJ voting
  console.log('Fetching clips from Clip des Jahres voting...');
  const clips = await getClips(supabase);
  
  if (clips.length === 0) {
    console.log('No clips found in Clip des Jahres voting');
    await setClipDesJahresVotingConfig(supabase, { is_active: false });
    return;
  }
  
  // Get votes from CDJ voting round
  console.log('Fetching votes from Clip des Jahres voting round...');
  const votes = await getVotesForRound(supabase, 'cdj');
  
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
  
  console.log(`Total votes in Clip des Jahres round: ${votes.length}`);
  console.log(`Clips sorted by votes`);
  
  // Save the winner
  const targetYear = config.target_year;
  const winner = clipsWithVotes[0];
  
  if (winner && winner.votes > 0) {
    console.log(`Saving winner to Clip des Jahres winners for year ${targetYear}...`);
    await saveClipDesJahresWinner(supabase, winner, targetYear);
    console.log(`Winner saved: ${winner.title} with ${winner.votes} votes`);
  } else {
    console.log('No votes were cast in this round - no winner to save');
  }
  
  // Clear CDJ voting round votes
  console.log('Clearing Clip des Jahres voting round votes...');
  await clearVotesForRound(supabase, 'cdj');
  
  // Deactivate CDJ voting round
  console.log('Deactivating Clip des Jahres voting round...');
  await setClipDesJahresVotingConfig(supabase, { is_active: false });
  
  console.log('Clip des Jahres voting round ended successfully!');
  console.log(`Target Year: ${targetYear}`);
  if (winner && winner.votes > 0) {
    console.log(`Winner: ${winner.title}`);
    console.log(`Votes: ${winner.votes}`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
