#!/usr/bin/env node

/**
 * Twitch Clips Fetcher
 * 
 * This script fetches clips from Twitch API based on the configuration in config.txt
 * and saves them to clips-data.json
 * 
 * Requirements:
 * - Node.js
 * - Twitch Client ID and Client Secret
 * 
 * Usage:
 *   node fetch-clips.js
 * 
 * Environment Variables:
 *   TWITCH_CLIENT_ID - Your Twitch App Client ID
 *   TWITCH_CLIENT_SECRET - Your Twitch App Client Secret
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG_FILE = path.join(__dirname, 'config.txt');
const OUTPUT_FILE = path.join(__dirname, 'clips-data.json');

class TwitchClipsFetcher {
    constructor() {
        this.clientId = process.env.TWITCH_CLIENT_ID;
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
        this.accessToken = null;
        this.config = null;
    }

    async run() {
        try {
            console.log('🎬 Starting Twitch Clips Fetcher...');
            
            // Load configuration
            this.config = await this.loadConfig();
            console.log('✅ Configuration loaded');
            
            // Validate environment
            if (!this.clientId || !this.clientSecret) {
                throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables are required');
            }
            
            // Get access token
            await this.authenticate();
            console.log('✅ Authenticated with Twitch');
            
            // Get broadcaster info
            const broadcaster = await this.getBroadcaster();
            console.log(`✅ Found broadcaster: ${broadcaster.display_name} (ID: ${broadcaster.id})`);
            
            // Fetch clips
            const clips = await this.fetchClips(broadcaster.id);
            console.log(`✅ Fetched ${clips.length} clips`);
            
            // Save to file
            await this.saveClips(clips, broadcaster);
            console.log(`✅ Saved clips to ${OUTPUT_FILE}`);
            
            console.log('🎉 Done!');
        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        }
    }

    loadConfig() {
        return new Promise((resolve, reject) => {
            fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
                if (err) {
                    reject(new Error(`Could not read config file: ${err.message}`));
                    return;
                }
                
                const config = {};
                const lines = data.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        config[key.trim()] = valueParts.join('=').trim();
                    }
                }
                
                resolve(config);
            });
        });
    }

    async authenticate() {
        const postData = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'client_credentials'
        }).toString();
        
        const response = await this.httpsRequest({
            hostname: 'id.twitch.tv',
            path: '/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        }, postData);
        
        this.accessToken = response.access_token;
    }

    async getBroadcaster() {
        const broadcasterName = this.config.TWITCH_BROADCASTER_ID;
        
        const response = await this.httpsRequest({
            hostname: 'api.twitch.tv',
            path: `/helix/users?login=${broadcasterName}`,
            method: 'GET',
            headers: {
                'Client-ID': this.clientId,
                'Authorization': `Bearer ${this.accessToken}`
            }
        });
        
        if (!response.data || response.data.length === 0) {
            throw new Error(`Broadcaster ${broadcasterName} not found`);
        }
        
        return response.data[0];
    }

    async fetchClips(broadcasterId) {
        const startDate = new Date(this.config.CLIPS_START);
        const endDate = new Date(this.config.CLIPS_END);
        const maxClips = parseInt(this.config.MAX_CLIPS) || 10;
        
        // Get GitHub Pages domain from config or environment
        const domain = process.env.GITHUB_PAGES_DOMAIN || 'sommer2019.github.io';
        
        const params = new URLSearchParams({
            broadcaster_id: broadcasterId,
            started_at: startDate.toISOString(),
            ended_at: endDate.toISOString(),
            first: Math.min(maxClips, 100) // Max 100 per request
        });
        
        const response = await this.httpsRequest({
            hostname: 'api.twitch.tv',
            path: `/helix/clips?${params}`,
            method: 'GET',
            headers: {
                'Client-ID': this.clientId,
                'Authorization': `Bearer ${this.accessToken}`
            }
        });
        
        // Transform clips to our format
        const clips = (response.data || []).slice(0, maxClips).map((clip, index) => ({
            id: clip.id,
            url: clip.url,
            embed_url: `https://clips.twitch.tv/embed?clip=${clip.id}&parent=${domain}&parent=localhost`,
            title: clip.title,
            creator_name: clip.creator_name,
            view_count: clip.view_count,
            created_at: clip.created_at,
            thumbnail_url: clip.thumbnail_url
        }));
        
        return clips;
    }

    async saveClips(clips, broadcaster) {
        const data = {
            clips: clips,
            metadata: {
                last_updated: new Date().toISOString(),
                broadcaster: broadcaster.login,
                broadcaster_id: broadcaster.id,
                clips_count: clips.length
            }
        };
        
        return new Promise((resolve, reject) => {
            fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8', (err) => {
                if (err) {
                    reject(new Error(`Could not save clips: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }

    httpsRequest(options, postData = null) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error(`Invalid JSON response: ${data}`));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            
            req.on('error', (err) => {
                reject(err);
            });
            
            if (postData) {
                req.write(postData);
            }
            
            req.end();
        });
    }
}

// Run if executed directly
if (require.main === module) {
    const fetcher = new TwitchClipsFetcher();
    fetcher.run();
}

module.exports = TwitchClipsFetcher;
