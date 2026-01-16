const { 
  getSupabaseClient, 
  getSecondVotingConfig,
  setSecondVotingConfig,
  clearVotesForRound
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
  
  const now = new Date();
  const endsAt = new Date(config.ends_at);
  
  // Check if second voting has expired
  if (now > endsAt) {
    console.log(`Second voting round expired at ${endsAt.toISOString()}`);
    console.log('Aborting second voting round and clearing votes...');
    
    // Clear second voting round votes
    await clearVotesForRound(supabase, 'second');
    
    // Deactivate second voting round
    await setSecondVotingConfig(supabase, { is_active: false });
    
    console.log('Second voting round aborted due to expiry');
  } else {
    const timeRemaining = Math.round((endsAt - now) / (1000 * 60 * 60));
    console.log(`Second voting round is still active (${timeRemaining} hours remaining)`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
