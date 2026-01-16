// Simple test to verify Supabase connection
const { getSupabaseClient } = require('./.github/scripts/db-helper');

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
      console.error('ERROR: Environment variables not set!');
      console.error('Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY');
      console.error('Example:');
      console.error('  export SUPABASE_URL="https://itbmerllqlwoinsletkz.supabase.co"');
      console.error('  export SUPABASE_PUBLISHABLE_KEY="your-actual-anon-key-from-supabase-dashboard"');
      process.exit(1);
    }
    
    const supabase = getSupabaseClient();
    
    // Test reading from clips table
    console.log('Testing read access to clips table...');
    const { data: clipsData, error: clipsError } = await supabase
      .from('clips')
      .select('count');
    
    if (clipsError) {
      console.error('Error reading clips:', clipsError);
    } else {
      console.log('✓ Successfully connected to clips table');
    }
    
    // Test reading from votes table
    console.log('Testing read access to votes table...');
    const { data: votesData, error: votesError } = await supabase
      .from('votes')
      .select('count');
    
    if (votesError) {
      console.error('Error reading votes:', votesError);
    } else {
      console.log('✓ Successfully connected to votes table');
    }
    
    // Test reading from results table
    console.log('Testing read access to results table...');
    const { data: resultsData, error: resultsError } = await supabase
      .from('results')
      .select('count');
    
    if (resultsError) {
      console.error('Error reading results:', resultsError);
    } else {
      console.log('✓ Successfully connected to results table');
    }
    
    console.log('\nConnection test complete!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testConnection();
