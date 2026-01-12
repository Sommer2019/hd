const fs = require('fs');

// Constants for voting period calculation
const VOTING_PERIOD_DAYS = 7; // Last 7 days of the month

// Calculate the last week of the current month
function getLastWeekOfMonth(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  
  // Get the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfMonth = lastDay.getDate();
  
  // Calculate the start of the last week (VOTING_PERIOD_DAYS before the last day)
  const startOfLastWeek = new Date(year, month, lastDayOfMonth - (VOTING_PERIOD_DAYS - 1), 0, 0, 0, 0);
  const endOfLastWeek = new Date(year, month, lastDayOfMonth, 23, 59, 59, 999);
  
  return { start: startOfLastWeek, end: endOfLastWeek };
}

// Check if current date is in the last week of the month
function isInLastWeekOfMonth(now = new Date()) {
  const lastWeek = getLastWeekOfMonth(now);
  return now >= lastWeek.start && now <= lastWeek.end;
}

function main() {
  const clipId = process.env.CLIP_ID;
  const ipHash = process.env.IP_HASH;
  
  if (!clipId || !ipHash) {
    console.error('Missing CLIP_ID or IP_HASH');
    process.exit(1);
  }
  
  // Read config
  const configPath = './votingData/config.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Check if voting is active (automatically active during last week of month)
  const now = new Date();
  const isVotingActive = isInLastWeekOfMonth(now);
  
  if (!isVotingActive) {
    console.log('Voting is not active (not in the last week of the month)');
    process.exit(1);
  }
  
  // Read current votes
  const votesPath = './votingData/votes.json';
  const votesData = JSON.parse(fs.readFileSync(votesPath, 'utf8'));
  
  // Check if IP has already voted
  if (votesData.votes[ipHash]) {
    console.log('IP has already voted');
    process.exit(1);
  }
  
  // Record vote
  votesData.votes[ipHash] = {
    clipId: clipId,
    votedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(votesPath, JSON.stringify(votesData, null, 2));
  console.log('Vote recorded successfully');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
