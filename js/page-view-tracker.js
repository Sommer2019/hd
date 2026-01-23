// Page View Tracker
// Tracks page views with IP hashing and 5-minute cooldown

(async function() {
    try {
        // Get the Supabase client
        const supabase = await getSupabaseClient();
        
        // Get the current page path
        const pagePath = window.location.pathname;
        
        // Get IP hash from a lightweight hashing function
        // Since we can't get the actual IP in the browser, we'll use a fingerprint
        const ipHash = await generateBrowserFingerprint();
        
        // Check if this IP has visited this page in the last 5 minutes
        const shouldTrack = await shouldTrackPageView(supabase, ipHash, pagePath);
        
        if (shouldTrack) {
            await trackPageView(supabase, ipHash, pagePath);
        }
    } catch (error) {
        // Silently fail - don't disrupt the user experience
        console.debug('Page view tracking error:', error);
    }
})();

// Generate a browser fingerprint to use as a pseudo-IP hash
async function generateBrowserFingerprint() {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
        navigator.deviceMemory || 0
    ].join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
        const char = components.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    return 'fp_' + Math.abs(hash).toString(16);
}

// Check if we should track this page view (not visited in last 5 minutes)
async function shouldTrackPageView(supabase, ipHash, pagePath) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from('page_views')
        .select('id')
        .eq('ip_hash', ipHash)
        .eq('page_path', pagePath)
        .gte('viewed_at', fiveMinutesAgo)
        .limit(1);
    
    if (error) {
        console.debug('Error checking page view:', error);
        return false;
    }
    
    // If no recent view found, we should track this one
    return !data || data.length === 0;
}

// Track the page view
async function trackPageView(supabase, ipHash, pagePath) {
    const { error } = await supabase
        .from('page_views')
        .insert({
            ip_hash: ipHash,
            page_path: pagePath,
            viewed_at: new Date().toISOString()
        });
    
    if (error) {
        console.debug('Error tracking page view:', error);
    }
}
