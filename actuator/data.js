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
            cdjVotingConfig,
            pageViewStats
        ] = await Promise.all([
            fetchVotesStats(supabase),
            fetchClipsStats(supabase),
            fetchResultsStats(supabase),
            fetchCDJClipsStats(supabase),
            getSecondVotingConfig().catch(err => {
                console.warn('Could not load second voting config:', err);
                return null;
            }),
            getClipDesJahresVotingConfig().catch(err => {
                console.warn('Could not load CDJ voting config:', err);
                return null;
            }),
            fetchPageViewStats().catch(err => {
                console.warn('Could not load page view stats:', err);
                return null;
            })
        ]);
        
        // Update UI with fetched data
        updateVotesDisplay(votesData);
        updateClipsDisplay(clipsData);
        updateResultsDisplay(resultsData);
        updateCDJClipsDisplay(cdjClipsData);
        updateSecondVotingDisplay(secondVotingConfig);
        updateCDJVotingDisplay(cdjVotingConfig);
        updatePageViewDisplay(pageViewStats);
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

async function fetchPageViewStats() {
    const [stats, detailed] = await Promise.all([
        Promise.all([
            getPageViewStats('24h'),
            getPageViewStats('7d'),
            getPageViewStats('30d'),
            getPageViewStats('1y'),
            getPageViewStats('all')
        ]),
        Promise.all([
            getDetailedPageViewStats('24h'),
            getDetailedPageViewStats('7d'),
            getDetailedPageViewStats('30d')
        ])
    ]);
    
    return {
        views24h: stats[0],
        views7d: stats[1],
        views30d: stats[2],
        views1y: stats[3],
        viewsAll: stats[4],
        detailed24h: detailed[0],
        detailed7d: detailed[1],
        detailed30d: detailed[2]
    };
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

function updatePageViewDisplay(stats) {
    if (!stats) {
        document.getElementById('views-24h').textContent = 'N/A';
        document.getElementById('views-7d').textContent = 'N/A';
        document.getElementById('views-30d').textContent = 'N/A';
        document.getElementById('views-1y').textContent = 'N/A';
        document.getElementById('views-all').textContent = 'N/A';
        return;
    }
    
    document.getElementById('views-24h').textContent = stats.views24h;
    document.getElementById('views-7d').textContent = stats.views7d;
    document.getElementById('views-30d').textContent = stats.views30d;
    document.getElementById('views-1y').textContent = stats.views1y;
    document.getElementById('views-all').textContent = stats.viewsAll;
    
    // Update detailed breakdown
    if (stats.detailed24h) {
        updateDetailedPageViewDisplay('24h', stats.detailed24h);
    }
    if (stats.detailed7d) {
        updateDetailedPageViewDisplay('7d', stats.detailed7d);
    }
    if (stats.detailed30d) {
        updateDetailedPageViewDisplay('30d', stats.detailed30d);
    }
}

function updateDetailedPageViewDisplay(timeRange, detailedStats) {
    const containerId = `detailed-views-${timeRange}`;
    const container = document.getElementById(containerId);
    
    if (!container || !detailedStats) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create 404 summary
    const summary404 = document.createElement('div');
    summary404.className = 'metric-card-small';
    summary404.innerHTML = `
        <div class="metric-label-small">404 Errors</div>
        <div class="metric-value-small">${detailedStats.total404s}</div>
        <div class="metric-detail">
            ${detailedStats.total404sWithRedirect} with redirect, 
            ${detailedStats.total404sWithout} without
        </div>
    `;
    container.appendChild(summary404);
    
    // Show top pages (limit to top 5)
    const topPages = detailedStats.pageBreakdown.slice(0, 5);
    
    topPages.forEach(pageData => {
        const pageCard = document.createElement('div');
        pageCard.className = 'metric-card-small';
        
        const pageName = pageData.page === '/' || pageData.page === '/index.html' 
            ? 'Home' 
            : pageData.page;
        
        let detailText = `${pageData.count} views`;
        if (pageData.is404 && pageData.redirects > 0) {
            detailText += ` (${pageData.redirects} redirected)`;
        }
        
        pageCard.innerHTML = `
            <div class="metric-label-small">${pageName}</div>
            <div class="metric-value-small">${pageData.count}</div>
            <div class="metric-detail">${detailText}</div>
        `;
        
        container.appendChild(pageCard);
    });
    
    // Show "others" if there are more pages
    if (detailedStats.pageBreakdown.length > 5) {
        const othersCount = detailedStats.pageBreakdown.slice(5)
            .reduce((sum, page) => sum + page.count, 0);
        
        const othersCard = document.createElement('div');
        othersCard.className = 'metric-card-small';
        othersCard.innerHTML = `
            <div class="metric-label-small">Other pages</div>
            <div class="metric-value-small">${othersCount}</div>
            <div class="metric-detail">${detailedStats.pageBreakdown.length - 5} pages</div>
        `;
        container.appendChild(othersCard);
    }
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
        const endDate = new Date(config.ends_at);
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
        const endDate = new Date(config.ends_at);
        detailsEl.textContent = `Year: ${config.year}, Ends: ${endDate.toLocaleDateString('de-DE')}`;
    } else {
        detailsEl.textContent = 'Currently inactive';
    }
}

function updateOtherMetrics() {
    const now = new Date();
    document.getElementById('current-year').textContent = now.getFullYear();
    document.getElementById('current-month').textContent = now.toLocaleString('de-DE', { month: 'long' });
    
    // Calculate page load time using modern Performance API
    try {
        const perfEntries = performance.getEntriesByType('navigation');
        if (perfEntries && perfEntries.length > 0) {
            const navTiming = perfEntries[0];
            const loadTime = Math.round(navTiming.domContentLoadedEventEnd - navTiming.fetchStart);
            document.getElementById('page-load-time').textContent = loadTime;
        } else {
            document.getElementById('page-load-time').textContent = 'N/A';
        }
    } catch (err) {
        console.warn('Could not calculate page load time:', err);
        document.getElementById('page-load-time').textContent = 'N/A';
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', loadActuatorData);
