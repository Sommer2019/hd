const fs = require('fs');

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
  
  // Check if voting is active
  const now = new Date();
  const votingEnd = new Date(config.votingPeriod.end);
  
  if (config.status !== 'active' || now > votingEnd) {
    console.log('Voting period has ended');
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
