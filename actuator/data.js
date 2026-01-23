// Actuator Data JavaScript
// Fetches and displays database statistics and metrics

async function loadActuatorData() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const contentEl = document.getElementById('content');
    
    try {
        const supabase = await getSupabaseClient();
        
        // Fetch all data in parallel
        const [
            votesData,
            clipsData,
            resultsData,
            cdjClipsData,
            secondVotingConfig,
            cdjVotingConfig
        ] = await Promise.all([
            fetchVotesStats(supabase),
            fetchClipsStats(supabase),
            fetchResultsStats(supabase),
            fetchCDJClipsStats(supabase),
            getSecondVotingConfig().catch(() => null),
            getClipDesJahresVotingConfig().catch(() => null)
        ]);
        
        // Update UI with fetched data
        updateVotesDisplay(votesData);
        updateClipsDisplay(clipsData);
        updateResultsDisplay(resultsData);
        updateCDJClipsDisplay(cdjClipsData);
        updateSecondVotingDisplay(secondVotingConfig);
        updateCDJVotingDisplay(cdjVotingConfig);
        updateOtherMetrics();
        
        // Update timestamp
        document.getElementById('timestamp').textContent = new Date().toLocaleString('de-DE');
        
        // Hide loading, show content
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading actuator data:', error);
        loadingEl.style.display = 'none';
        errorEl.textContent = `Error loading data: ${error.message}`;
        errorEl.style.display = 'block';
    }
}

async function fetchVotesStats(supabase) {
    // Get all votes
    const { data: allVotes, error: allError } = await supabase
        .from('votes')
        .select('id, voting_round');
    
    if (allError) throw allError;
    
    const total = (allVotes || []).length;
    const monthly = (allVotes || []).filter(v => v.voting_round === 'monthly').length;
    const cdj = (allVotes || []).filter(v => v.voting_round === 'cdj').length;
    
    return { total, monthly, cdj };
}

async function fetchClipsStats(supabase) {
    const { count, error } = await supabase
        .from('clips')
        .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
}

async function fetchResultsStats(supabase) {
    const { count, error } = await supabase
        .from('results')
        .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
}

async function fetchCDJClipsStats(supabase) {
    const { count, error } = await supabase
        .from('clip_des_jahres')
        .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
}

function updateVotesDisplay(votesData) {
    document.getElementById('total-votes').textContent = votesData.total;
    document.getElementById('monthly-votes').textContent = votesData.monthly;
    document.getElementById('cdj-votes').textContent = votesData.cdj;
}

function updateClipsDisplay(count) {
    document.getElementById('clips-count').textContent = count;
}

function updateResultsDisplay(count) {
    document.getElementById('results-count').textContent = count;
}

function updateCDJClipsDisplay(count) {
    document.getElementById('cdj-clips-count').textContent = count;
}

function updateSecondVotingDisplay(config) {
    const activeEl = document.getElementById('second-voting-active');
    const detailsEl = document.getElementById('second-voting-details');
    
    if (!config) {
        activeEl.textContent = 'No';
        detailsEl.textContent = 'No configuration found';
        return;
    }
    
    const isActive = config.is_active;
    activeEl.textContent = isActive ? 'Yes' : 'No';
    
    if (isActive) {
        const endDate = new Date(config.end_date);
        detailsEl.textContent = `Ends: ${endDate.toLocaleDateString('de-DE')}`;
    } else {
        detailsEl.textContent = 'Currently inactive';
    }
}

function updateCDJVotingDisplay(config) {
    const activeEl = document.getElementById('cdj-voting-active');
    const detailsEl = document.getElementById('cdj-voting-details');
    
    if (!config) {
        activeEl.textContent = 'No';
        detailsEl.textContent = 'No configuration found';
        return;
    }
    
    const isActive = config.is_active;
    activeEl.textContent = isActive ? 'Yes' : 'No';
    
    if (isActive) {
        const endDate = new Date(config.end_date);
        detailsEl.textContent = `Year: ${config.year}, Ends: ${endDate.toLocaleDateString('de-DE')}`;
    } else {
        detailsEl.textContent = 'Currently inactive';
    }
}

function updateOtherMetrics() {
    const now = new Date();
    document.getElementById('current-year').textContent = now.getFullYear();
    document.getElementById('current-month').textContent = now.toLocaleString('de-DE', { month: 'long' });
    
    // Calculate page load time
    if (window.performance && window.performance.timing) {
        const loadTime = window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart;
        document.getElementById('page-load-time').textContent = loadTime;
    } else {
        document.getElementById('page-load-time').textContent = 'N/A';
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', loadActuatorData);
