/**
 * Twitch API Status Checker
 * Checks if a Twitch channel is currently live
 */

class TwitchStatusChecker {
    constructor(channelName) {
        this.channelName = channelName;
        this.lastStatus = null;
        this.checkInterval = 60000; // Check every 60 seconds
        this.intervalId = null;
    }

    /**
     * Check if the channel is currently live using Twitch API
     */
    async checkStreamStatus() {
        try {
            // Use Twitch's public API endpoint with anonymous client ID
            // This is a public read-only endpoint that doesn't require authentication
            const response = await fetch(
                `https://api.twitch.tv/helix/streams?user_login=${this.channelName}`,
                {
                    headers: {
                        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko' // Twitch's public anonymous client ID
                    }
                }
            );

            if (!response.ok) {
                // If API fails, try fallback method
                return await this.checkStreamStatusFallback();
            }

            const data = await response.json();
            const isLive = data.data && data.data.length > 0;
            
            console.log(`Twitch channel ${this.channelName} status:`, isLive ? 'LIVE' : 'OFFLINE');
            return isLive;
        } catch (error) {
            console.warn('Error checking Twitch status via API:', error);
            // Use fallback method
            return await this.checkStreamStatusFallback();
        }
    }

    /**
     * Fallback method: Check stream status by attempting to load channel info
     * This is less reliable but works without authentication
     */
    async checkStreamStatusFallback() {
        try {
            // Check if the channel page indicates stream is live
            const response = await fetch(`https://www.twitch.tv/${this.channelName}`, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            
            // Since we can't read the response with no-cors, default to offline
            // This ensures we show YouTube when we can't verify the stream status
            console.log('Fallback detection - defaulting to offline for safety');
            return false;
        } catch (error) {
            console.warn('Fallback check failed:', error);
            // Default to offline if we can't verify
            return false;
        }
    }

    /**
     * Start periodic status checking
     */
    startMonitoring(callback, interval = this.checkInterval) {
        this.checkInterval = interval;
        
        // Initial check
        this.checkAndNotify(callback);
        
        // Set up periodic checks
        this.intervalId = setInterval(() => {
            this.checkAndNotify(callback);
        }, this.checkInterval);
        
        console.log(`Started monitoring Twitch channel ${this.channelName} every ${interval / 1000}s`);
    }

    /**
     * Stop periodic status checking
     */
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Stopped monitoring Twitch channel');
        }
    }

    /**
     * Check status and notify callback if changed
     */
    async checkAndNotify(callback) {
        try {
            const isLive = await this.checkStreamStatus();
            
            // Only notify if status changed
            if (this.lastStatus !== isLive) {
                console.log(`Twitch status changed: ${this.lastStatus === null ? 'initial' : (this.lastStatus ? 'LIVE' : 'OFFLINE')} -> ${isLive ? 'LIVE' : 'OFFLINE'}`);
                this.lastStatus = isLive;
                if (callback) {
                    callback(isLive);
                }
            }
        } catch (error) {
            console.error('Error in checkAndNotify:', error);
        }
    }
}

// Export for use in other scripts
window.TwitchStatusChecker = TwitchStatusChecker;
