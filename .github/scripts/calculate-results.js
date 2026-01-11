const fs = require('fs');

function main() {
  const today = new Date();
  
  // Only calculate results on the last day of the month
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (tomorrow.getDate() !== 1) {
    console.log('Not the last day of the month yet, skipping calculation');
    return;
  }
  
  // Read clips
  const clipsPath = './votingData/clips.json';
  const clipsData = JSON.parse(fs.readFileSync(clipsPath, 'utf8'));
  
  // Read votes
  const votesPath = './votingData/votes.json';
  const votesData = JSON.parse(fs.readFileSync(votesPath, 'utf8'));
  
  // Count votes per clip
  const voteCount = {};
  for (const ipHash in votesData.votes) {
    const clipId = votesData.votes[ipHash].clipId;
    voteCount[clipId] = (voteCount[clipId] || 0) + 1;
  }
  
  // Create array of clips with vote counts
  const clipsWithVotes = clipsData.clips.map(clip => ({
    ...clip,
    votes: voteCount[clip.id] || 0
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
  
  // Save results
  const resultsData = {
    results: results,
    calculatedAt: new Date().toISOString(),
    period: clipsData.period,
    totalVotes: Object.keys(votesData.votes).length
  };
  
  fs.writeFileSync('./votingData/results.json', JSON.stringify(resultsData, null, 2));
  
  // Update config status
  const configPath = './votingData/config.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.status = 'closed';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log(`Results calculated: ${results.length} clips in top 10`);
  console.log(`Total votes: ${resultsData.totalVotes}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
