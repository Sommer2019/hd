const { getSupabaseClient, getClips, getVotes, saveResults, clearVotes } = require('./db-helper');

async function main() {
  const today = new Date();
  
  // Only calculate results on the last day of the month
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (tomorrow.getDate() !== 1) {
    console.log('Not the last day of the month yet, skipping calculation');
    return;
  }
  
  // Initialize Supabase
  const supabase = getSupabaseClient();
  
  // Get clips from database
  console.log('Fetching clips from database...');
  const clips = await getClips(supabase);
  
  if (clips.length === 0) {
    console.log('No clips found in database');
    return;
  }
  
  // Get votes from database
  console.log('Fetching votes from database...');
  const votes = await getVotes(supabase);
  
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
  
  // Get top 10 (or more if there are ties at position 10)
  const results = [];
  let minVotesForTop10 = 0;
  
  for (let i = 0; i < clipsWithVotes.length; i++) {
    if (i < 10) {
      results.push(clipsWithVotes[i]);
      if (i === 9) {
        minVotesForTop10 = clipsWithVotes[i].votes;
      }
    } else if (minVotesForTop10 > 0 && clipsWithVotes[i].votes === minVotesForTop10) {
      // Include clips tied with the 10th position
      // Note: If position 10 has 0 votes, we don't include additional 0-vote clips
      results.push(clipsWithVotes[i]);
    } else {
      break;
    }
  }
  
  // Get period info from first clip
  const periodInfo = clips.length > 0 ? {
    start: clips[0].period_start,
    end: clips[0].period_end
  } : {
    start: new Date().toISOString(),
    end: new Date().toISOString()
  };
  
  // Save results to database (monthly)
  const resultsMetadata = {
    calculatedAt: new Date().toISOString(),
    period: periodInfo,
    totalVotes: votes.length
  };
  
  console.log('Saving results to database...');
  await saveResults(supabase, results, resultsMetadata);
  
  // Clear votes after calculating results
  console.log('Clearing votes from database...');
  await clearVotes(supabase);
  
  console.log(`Results calculated and saved: ${results.length} clips in top 10`);
  console.log(`Total votes: ${resultsMetadata.totalVotes}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
