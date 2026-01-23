// Page View Tracker
// Tracks page views with session ID and 2-minute cooldown per page

(async function() {
    try {
        // Get the Supabase client
        const supabase = await getSupabaseClient();
        
        // Get the current page path
        const pagePath = window.location.pathname;
        
        // Get or create session ID from cookie/localStorage
        const sessionId = getOrCreateSessionId();
        
        // Check if this is the 404 page
        const is404Page = pagePath === '/404.html' || pagePath === '/404';
        
        // Check if we should track this page view
        const shouldTrack = is404Page ? true : await shouldTrackPageView(supabase, sessionId, pagePath);
        
        if (shouldTrack) {
            // For 404 page, check if there was a redirect
            const redirectInfo = is404Page ? await check404Redirect() : null;
            await trackPageView(supabase, sessionId, pagePath, redirectInfo);
        }
    } catch (error) {
        // Silently fail - don't disrupt the user experience
        console.debug('Page view tracking error:', error);
    }
})();

// Get or create a session ID using localStorage (persistent across tabs)
function getOrCreateSessionId() {
    const SESSION_KEY = 'hd_session_id';
    let sessionId = localStorage.getItem(SESSION_KEY);
    
    if (!sessionId) {
        // Generate a unique session ID
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(SESSION_KEY, sessionId);
    }
    
    return sessionId;
}

// Check if we should track this page view (not visited same page in last 2 minutes)
async function shouldTrackPageView(supabase, sessionId, pagePath) {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from('page_views')
        .select('id')
        .eq('session_id', sessionId)
        .eq('page_path', pagePath)
        .gte('viewed_at', twoMinutesAgo)
        .limit(1);
    
    if (error) {
        console.debug('Error checking page view:', error);
        return false;
    }
    
    // If no recent view found on THIS page, we should track this one
    return !data || data.length === 0;
}

// Check if 404 page performed a redirect
async function check404Redirect() {
    // Wait a bit to see if redirect happens
    return new Promise((resolve) => {
        let redirectDetected = false;
        const originalPath = window.location.pathname;
        
        // Check if page is about to redirect
        const checkRedirect = () => {
            if (window.location.pathname !== originalPath) {
                redirectDetected = true;
                resolve({
                    redirected: true,
                    redirect_to: window.location.href
                });
            }
        };
        
        // Monitor for 100ms
        const interval = setInterval(checkRedirect, 10);
        
        setTimeout(() => {
            clearInterval(interval);
            if (!redirectDetected) {
                resolve(null);
            }
        }, 100);
    });
}

// Track the page view
async function trackPageView(supabase, sessionId, pagePath, redirectInfo) {
    const insertData = {
        session_id: sessionId,
        page_path: pagePath,
        viewed_at: new Date().toISOString()
    };
    
    // Add redirect info if available
    if (redirectInfo) {
        insertData.redirect_info = JSON.stringify(redirectInfo);
    }
    
    const { error } = await supabase
        .from('page_views')
        .insert(insertData);
    
    if (error) {
        console.debug('Error tracking page view:', error);
    }
}
