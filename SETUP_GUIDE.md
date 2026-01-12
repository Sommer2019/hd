# Clip des Monats - Setup Guide

## Quick Start

### 1. Configure Twitch API Credentials

To fetch clips automatically, you need Twitch API credentials:

1. Go to https://dev.twitch.tv/console/apps
2. Click "Register Your Application"
3. Fill in the form:
   - **Name**: "HD Clip des Monats" (or any name)
   - **OAuth Redirect URLs**: `http://localhost`
   - **Category**: Website Integration
4. Click "Create"
5. Copy your **Client ID**
6. Click "New Secret" to generate a **Client Secret** and copy it

### 2. Add GitHub Secrets

Go to your repository settings → Secrets and variables → Actions → New repository secret

Add these secrets:

- **TWITCH_CLIENT_ID**: Your Twitch Client ID
- **TWITCH_CLIENT_SECRET**: Your Twitch Client Secret
- **VOTING_START_DATE** (optional): e.g., `2026-02-01`
- **VOTING_END_DATE** (optional): e.g., `2026-02-28`

If you don't set the dates, the system will automatically use the previous calendar month.

### 3. How It Works

#### Automatic Date-Based Voting

The voting system **automatically activates during the last week of each month** (last 7 days). No manual configuration needed:

- **Voting Active**: Automatically active during the last week of the current month (e.g., January 25-31)
- **Results Display**: Automatically shown during the first ~3 weeks of the month
- **No Config Updates Required**: The system calculates the voting period dynamically based on the current date

The `votingData/config.json` file is updated by workflows for informational purposes, but the voting activation is determined automatically by date calculation.

#### Automatic Monthly Cycle

1. **Around Day 22 of Each Month** (at 00:00 UTC):
   - `fetch-clips.yml` workflow runs automatically
   - Fetches clips from last week of previous month through second-to-last week of current month
     - Example for January: clips from December 25 - January 24
   - Updates `votingData/clips.json` with fetched clips
   - Updates `votingData/config.json` with voting period set to last week of current month
     - Example for January: voting period January 25 - January 31

2. **During the Last Week of the Month** (approximately days 25-31):
   - Users visit ClipDesMonats.html
   - System automatically detects it's the last week and shows voting interface
   - Users can browse and vote for one clip
   - Votes are stored in localStorage (one per browser)
   - No manual status change needed - completely automatic

3. **Last Day of the Month** (Days 28-31 at 23:55 UTC):
   - `calculate-results.yml` workflow runs
   - Checks if it's the last day of the month and in the last week
   - Calculates top 10 clips by votes
   - Updates `votingData/results.json`

4. **After Voting Period Ends** (First ~3 weeks of next month):
   - Users automatically see results instead of voting interface
   - No manual status change needed - system checks dates automatically
   - Around day 22, new cycle begins when workflow runs

### 4. Manual Operations

#### Manually Start Voting for a Custom Period

1. Go to **Actions** → **Fetch Twitch Clips**
2. Click **Run workflow**
3. Enter custom start and end dates (or leave empty for previous month)
4. Click **Run workflow**

#### Manually Calculate Results

1. Go to **Actions** → **Calculate Results**
2. Click **Run workflow**
3. Click **Run workflow** (confirms)

### 5. Testing Locally

To test the voting interface locally:

```bash
# Navigate to repository
cd /path/to/hd

# Start a local web server
python3 -m http.server 8080

# Open browser to http://localhost:8080/ClipDesMonats.html
```

To reset your vote (for testing):
1. Open browser console (F12)
2. Run: `localStorage.removeItem('cdm_voted_clip')`
3. Refresh the page

### 6. File Structure

```
votingData/
├── config.json      # Current voting status and period
├── clips.json       # Clips available for voting
├── votes.json       # Vote records (currently not used in client-only mode)
├── results.json     # Top 10 results after calculation
└── README.md        # Detailed documentation
```

### 7. Customization

#### Change Voting Period Duration or Timing

The voting period is automatically calculated to be the last 7 days of each month. To change when voting is active:

1. Edit `js/clip-voting.js` - modify the `getLastWeekOfMonth()` function to change which days are considered "voting days"
2. Edit `.github/scripts/submit-vote.js` - make the same changes to keep backend validation in sync
3. Edit `.github/scripts/fetch-clips.js` - modify if you want to change which clips are fetched
4. Edit `.github/workflows/fetch-clips.yml` - change the cron schedule (currently runs on day 22)
5. Edit `.github/workflows/calculate-results.yml` - adjust if needed (currently runs on days 28-31)

#### Change Twitch Channel

Edit `votingData/config.json`:
```json
{
  "twitchChannel": "your_channel_name",
  ...
}
```

#### Customize UI

- **Colors**: Edit `css/clip-voting.css`
- **Text**: Edit `ClipDesMonats.html` and `js/clip-voting.js`

### 8. Current Limitations

⚠️ **Important**: The current implementation uses **browser localStorage** for vote tracking. This means:

- Users can vote once per browser
- Clearing browser data allows voting again
- No true IP-based verification (GitHub Pages limitation)

For true IP-based voting, you would need to add a serverless backend (e.g., Cloudflare Workers, Vercel Functions) that:
1. Receives vote requests from the client
2. Hashes the user's IP address
3. Triggers the GitHub Actions workflow via API

### 9. Troubleshooting

**Q: Clips are not showing**
- Check if `votingData/clips.json` has data
- Check GitHub Actions logs for fetch-clips workflow
- Verify Twitch API credentials are correct

**Q: Voting doesn't work**
- Check browser console for errors
- Verify the current date is in the last week of the month (system auto-activates)
- Try clearing localStorage and refreshing
- Check if `votingData/clips.json` has clips available

**Q: Results not showing**
- Check if `votingData/results.json` exists and has data
- Verify calculate-results workflow ran successfully
- Ensure the current date is NOT in the last week of the month (results show automatically when voting period ends)

**Q: Workflow not running automatically**
- Check that GitHub Actions are enabled in repository settings
- Verify cron schedules in workflow files
- Note: Scheduled workflows may have up to 15 minute delay

### 10. Support

For issues or questions:
- Check `votingData/README.md` for detailed documentation
- Review GitHub Actions logs for workflow errors
- Check browser console for JavaScript errors

## Security Summary

✅ **No security vulnerabilities found** by CodeQL analysis.

The system:
- Uses HTTPS for all API calls
- Does not expose API credentials to clients
- Uses GitHub Actions secrets for sensitive data
- Implements client-side vote limiting (localStorage)
- Does not store personal information

Note: For production use with real voting, consider implementing proper IP-based verification through a serverless backend.
