const { getSupabaseClient, hasVoted, recordVote } = require('./db-helper');

// Constants for voting period calculation
const VOTING_START_DAY = 22; // Voting starts on the 22nd of each month

// Calculate the voting period for the current month (from 22nd to end of month)
function getVotingPeriodOfMonth(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  
  // Get the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfMonth = lastDay.getDate();
  
  // Voting period: 22nd to last day of month
  const votingStart = new Date(year, month, VOTING_START_DAY, 0, 0, 0, 0);
  const votingEnd = new Date(year, month, lastDayOfMonth, 23, 59, 59, 999);
  
  return { start: votingStart, end: votingEnd };
}

// Check if current date is in the voting period (22nd to end of month)
function isInVotingPeriod(now = new Date()) {
  const votingPeriod = getVotingPeriodOfMonth(now);
  return now >= votingPeriod.start && now <= votingPeriod.end;
}

async function main() {
  const clipId = process.env.CLIP_ID;
  const ipHash = process.env.IP_HASH;
  
  if (!clipId || !ipHash) {
    console.error('Missing CLIP_ID or IP_HASH');
    process.exit(1);
  }
  
  // Check if voting is active (automatically active from 22nd to end of month)
  const now = new Date();
  const isVotingActive = isInVotingPeriod(now);
  
  if (!isVotingActive) {
    console.log('Voting is not active (not between 22nd and end of month)');
    process.exit(1);
  }
  
  // Initialize Supabase
  const supabase = getSupabaseClient();
  
  // Check if IP has already voted
  const alreadyVoted = await hasVoted(supabase, ipHash);
  
  if (alreadyVoted) {
    console.log('IP has already voted');
    process.exit(1);
  }
  
  // Record vote in database
  await recordVote(supabase, ipHash, clipId);
  
  console.log('Vote recorded successfully in database');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
