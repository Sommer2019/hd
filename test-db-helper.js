// Simple test to verify database helper functions
// This is a basic smoke test to ensure the functions are defined correctly

const dbHelper = require('./.github/scripts/db-helper');

console.log('Testing database helper exports...\n');

const requiredFunctions = [
  'getSupabaseClient',
  'clearClips',
  'insertClips',
  'getClips',
  'hasVoted',
  'recordVote',
  'getVotes',
  'clearVotes',
  'saveResults',
  'getLatestResults',
  'getSecondVotingConfig',
  'setSecondVotingConfig',
  'saveClipDesJahres',
  'getClipDesJahres',
  'deleteOldClipDesJahres',
  'hasVotedInRound',
  'recordVoteInRound',
  'getVotesForRound',
  'clearVotesForRound',
  'getClipDesJahresVotingConfig',
  'setClipDesJahresVotingConfig',
  'saveClipDesJahresWinner',
  'getClipDesJahresWinner'
];

let allPassed = true;

requiredFunctions.forEach(funcName => {
  if (typeof dbHelper[funcName] === 'function') {
    console.log(`✓ ${funcName} is exported`);
  } else {
    console.log(`✗ ${funcName} is NOT exported`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✓ All database helper functions are exported correctly');
  process.exit(0);
} else {
  console.log('✗ Some functions are missing from exports');
  process.exit(1);
}
