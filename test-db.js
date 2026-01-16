// Simple test to verify Supabase connection
const { getSupabaseClient } = require('./.github/scripts/db-helper');

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Set up environment variables for testing
    process.env.SUPABASE_URL = 'https://itbmerllqlwoinsletkz.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0Ym1lcmxscWx3b2luc2xldGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcwNTI4MDAsImV4cCI6MjA1MjYyODgwMH0.SmpJqZVhHCpeMN-GUZgvzw_NKG1Rcgn';
    
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
