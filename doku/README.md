# Clip des Monats - Voting System

This voting system allows users to vote for their favorite Twitch clips from the past month.

## Setup Instructions

### 1. GitHub Secrets

Add the following secrets to your GitHub repository:

- `TWITCH_CLIENT_ID`: Your Twitch Application Client ID
- `TWITCH_CLIENT_SECRET`: Your Twitch Application Client Secret
- `VOTING_START_DATE` (optional): Start date for voting period (YYYY-MM-DD)
- `VOTING_END_DATE` (optional): End date for voting period (YYYY-MM-DD)

#### Getting Twitch API Credentials

1. Go to https://dev.twitch.tv/console/apps
2. Register a new application
3. Copy the Client ID and generate a Client Secret
4. Add these as secrets in your GitHub repository

### 2. Workflows

The system includes three GitHub Actions workflows:

#### Fetch Clips (`fetch-clips.yml`)
- **Schedule**: Runs on the 22nd of each month at 00:00 UTC
- **Manual trigger**: Can be triggered manually with custom date range
- **Function**: Fetches clips from the last week of the previous month through the second-to-last week of the current month
- **Output**: Updates `votingData/clips.json` and `votingData/config.json` with voting period set from 22nd to the end of current month

#### Submit Vote (`submit-vote.yml`)
- **Trigger**: Via repository_dispatch event (for future integration)
- **Function**: Records a vote for a specific clip
- **Note**: Currently, votes are stored in localStorage on the client side

#### Calculate Results (`calculate-results.yml`)
- **Schedule**: Runs on days 28-31 at 23:55 UTC (near the end of each month)
- **Manual trigger**: Can be triggered manually
- **Function**: Calculates top 10 clips based on votes (only runs on the last day of the month when in the last week)
- **Output**: Updates `votingData/results.json` and sets config status to "closed"

### 3. Voting Period Configuration

The voting period is **automatically enforced** based on the dates in `votingData/config.json`. The system checks the current date/time against the `votingPeriod.start` and `votingPeriod.end` fields to determine if voting should be active or if results should be displayed.

#### Automatic Period Calculation

By default, the system automatically calculates:

- **Clips Period**: Last week of the previous month through the second-to-last week of the current month
  - Example for January: December 25 - January 24
  - This provides approximately 4 weeks of clips for voting
  
- **Voting Period**: From the 22nd to the last day of the current month
  - Example for January: January 22 - January 31
  - Voting is only active during this period

The voting period dates can be overridden in three ways (in order of priority):

1. **Manual workflow dispatch**: Specify dates when manually triggering the fetch-clips workflow
2. **GitHub Secrets**: Set `VOTING_START_DATE` and `VOTING_END_DATE`
3. **Automatic**: Uses the calculated periods as described above

**Important**: The system automatically switches between voting and results display based on the current date. No manual status changes are required.

### 4. File Structure

```
votingData/
├── config.json      # Voting configuration and status
├── clips.json       # Fetched clips for current voting period
├── votes.json       # Recorded votes (IP hash -> clip ID)
└── results.json     # Top 10 results after voting closes
```

## Usage

### For Users

1. Visit the "Clip des Monats" page
2. Browse available clips from the voting period
3. Click "Für diesen Clip voten" on your favorite clip
4. Confirm your vote (you can only vote once per browser)

### For Administrators

#### Starting a New Voting Period

1. Go to Actions → Fetch Twitch Clips
2. Click "Run workflow"
3. (Optional) Specify custom start/end dates, or use secrets `VOTING_START_DATE` and `VOTING_END_DATE`
4. The workflow will fetch clips and update the voting period dates in config.json
5. Voting becomes active automatically when the current date is within the period

#### Ending a Voting Period

Voting automatically ends when the current date/time passes the `votingPeriod.end` date. Users will automatically see results instead of the voting interface.

Optionally, to manually calculate results:
1. Go to Actions → Calculate Results
2. Click "Run workflow"
3. The workflow will calculate top 10 results

#### Resetting for Next Month

The system automatically handles monthly cycles with the new weekly periods:

- **On the 22nd of each month**: 
  - `fetch-clips.yml` workflow runs automatically
  - Fetches clips from last week of previous month through second-to-last week of current month
  - Updates voting period dates from 22nd to end of current month in `votingData/config.json`
  - Voting becomes active immediately
  
- **From 22nd to end of month**:
  - Users can vote on clips
  - System automatically shows voting interface during this period
  
- **On the last day of the month**:
  - `calculate-results.yml` workflow runs automatically
  - Calculates top 10 clips by votes
  - Updates `votingData/results.json`
  
- **From 1st to 21st of next month**:
  - Users automatically see results
  - System waits for next cycle to begin on the 22nd

## Technical Details

### Client-Side Voting

- Uses localStorage to prevent duplicate votes per browser
- Vote tracking key: `cdm_voted_clip`
- No backend API required for basic functionality

### Future Enhancements

To implement proper IP-based voting verification:

1. Set up a serverless function (e.g., Cloudflare Workers, Vercel)
2. Function hashes the user's IP and triggers the `submit-vote` workflow
3. Update `js/clip-voting.js` to call this function instead of just localStorage

### Data Format

#### config.json
```json
{
  "votingPeriod": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  },
  "twitchChannel": "hd1920x1080",
  "status": "active"
}
```

**Note**: The `status` field is maintained for backward compatibility but is not actively used. The system automatically determines voting status by comparing the current date/time against `votingPeriod.start` and `votingPeriod.end`.

#### clips.json
```json
{
  "clips": [
    {
      "id": "clip_id",
      "url": "https://...",
      "title": "Clip Title",
      "view_count": 1234,
      "created_at": "2026-01-15T...",
      ...
    }
  ],
  "fetchedAt": "2026-01-01T00:00:00Z",
  "period": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  }
}
```

#### results.json
```json
{
  "results": [
    {
      "id": "clip_id",
      "title": "Clip Title",
      "votes": 42,
      ...
    }
  ],
  "calculatedAt": "2026-01-31T23:55:00Z",
  "period": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  },
  "totalVotes": 150
}
```

## Troubleshooting

### Clips not loading

- Check that `votingData/clips.json` exists and contains data
- Check GitHub Actions logs for the fetch-clips workflow
- Verify Twitch API credentials are correct

### Voting not working

- Check browser console for JavaScript errors
- Verify `votingData/config.json` has `status: "active"`
- Clear localStorage and try again: `localStorage.removeItem('cdm_voted_clip')`

### Results not showing

- Check that `votingData/results.json` exists
- Verify calculate-results workflow ran successfully
- Check that `config.json` has `status: "closed"`
