# Clip des Jahres Voting Feature

## Overview

This feature implements a yearly "Clip des Jahres" (Clip of the Year) voting system. Users can vote for their favorite clip from the monthly winners of the past year (December to November period).

## How It Works

### Voting Period

1. **Manual Start**: Can be manually started after November's second voting round is completed
2. **Automatic Start**: If not manually started by December 15th, the voting automatically starts
3. **Automatic End**: Voting ends on December 21st at 23:59
4. **Manual End**: Can be manually ended at any time during the voting period

### Clip Selection

The voting includes the top clip from each month's second voting round (Clip des Monats winners):
- December (previous year) through November (current year)
- Each monthly winner is eligible for the Clip des Jahres voting

### Voting Process

1. Users visit the Clip des Jahres page during the voting period
2. They see all eligible clips (monthly winners)
3. Each user can vote for exactly one clip
4. Voting is tracked by IP hash to prevent duplicate votes
5. After voting, users see a confirmation and cannot vote again

### Winner Display

- After voting ends, the winner is saved to the `cdj_winners` table
- The winner is displayed on the Clip des Jahres page for the entire next year
- If no winner exists for the previous year, a message is shown

## Database Tables

### cdj_voting_config

Stores the configuration for the current Clip des Jahres voting round.

```sql
CREATE TABLE cdj_voting_config (
    id BIGSERIAL PRIMARY KEY,
    is_active BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    target_year INTEGER,
    auto_started BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### cdj_winners

Stores the final winner for each year.

```sql
CREATE TABLE cdj_winners (
    id BIGSERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    clip_id TEXT NOT NULL,
    url TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    broadcaster_id TEXT NOT NULL,
    broadcaster_name TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    video_id TEXT,
    game_id TEXT,
    language TEXT,
    title TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    thumbnail_url TEXT,
    duration NUMERIC,
    vod_offset INTEGER,
    votes INTEGER DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL
);
```

### votes Table Extension

The existing `votes` table is extended to support the 'cdj' voting round:

```sql
voting_round TEXT DEFAULT 'monthly'
```

Possible values:
- `'monthly'`: Regular monthly voting
- `'second'`: Second voting round
- `'cdj'`: Clip des Jahres voting

## Scripts

### start-cdj-voting.js

Starts a Clip des Jahres voting round.

**Environment Variables:**
- `TARGET_YEAR`: The year for which to vote (e.g., 2024)
- `DURATION_DAYS`: Duration of the voting in days (default: 6)
- `AUTO_START`: Set to 'true' for automatic start (optional)

**Validation:**
- Checks that November's second voting for the target year was completed
- Fetches all monthly winners from December (target_year-1) to November (target_year)
- Clears current clips and replaces with monthly winners
- Activates CDJ voting configuration

**Usage:**
```bash
TARGET_YEAR=2024 DURATION_DAYS=7 npm run start-cdj-voting
```

### end-cdj-voting.js

Ends the current Clip des Jahres voting round.

**Process:**
1. Fetches all votes from the CDJ voting round
2. Counts votes per clip
3. Determines the winner (most votes, view count as tiebreaker)
4. Saves the winner to `cdj_winners` table
5. Clears CDJ votes
6. Deactivates CDJ voting configuration

**Usage:**
```bash
npm run end-cdj-voting
```

### check-cdj-voting.js

Automated script to check for auto-start and auto-end conditions.

**Auto-Start Logic:**
- Runs daily in December
- On December 15th or later, checks if CDJ voting should be started
- Only starts if November's second voting is complete
- Calculates duration to end on December 21st at 23:59

**Auto-End Logic:**
- Checks if voting has expired
- If expired, automatically runs `end-cdj-voting.js`

**Usage:**
```bash
npm run check-cdj-voting
```

## GitHub Actions Workflows

### start-cdj-voting.yml

Manual workflow to start Clip des Jahres voting.

**Inputs:**
- `target_year`: Year for which to vote (required)
- `duration_days`: Duration in days (default: 7)

**Trigger:**
- Manual dispatch via GitHub Actions UI

### end-cdj-voting.yml

Manual workflow to end Clip des Jahres voting.

**Trigger:**
- Manual dispatch via GitHub Actions UI

### check-cdj-voting.yml

Automated workflow for auto-start and auto-end.

**Schedule:**
- Runs daily at 6:00 AM UTC in December (for auto-start check)
- Runs daily at 11:59 PM UTC in December (for auto-end check)

**Trigger:**
- Scheduled (cron)
- Manual dispatch via GitHub Actions UI

## Frontend Integration

### clipdesjahres.html

Updated to include:
- Vote confirmation modal
- Dynamic content based on voting state

### clip-des-jahres.js

Completely rewritten to support three states:

1. **CDJ Voting Active**: Shows voting interface with all eligible clips
2. **Winner Display**: Shows the winner from the previous year
3. **Monthly Winners Display**: Shows monthly winners if no CDJ winner exists

**Features:**
- IP-based vote tracking
- Vote confirmation modal
- LocalStorage persistence
- Database integration via Supabase
- Sequential embed loading for performance

### supabase-client.js

Added functions:
- `getClipDesJahresVotingConfig()`: Fetch CDJ voting config
- `fetchClipDesJahresWinner(year)`: Fetch winner for a specific year
- Extended `submitVoteToDB()` to support 'cdj' voting round

## Setup Instructions

### 1. Create Database Tables

Run the SQL commands in `doku/supabase-schema.sql` for:
- `cdj_voting_config`
- `cdj_winners`

### 2. Configure Workflows

The workflows are already set up and will run automatically based on the schedule.

### 3. Manual Start (Optional)

To manually start CDJ voting before December 15th:

1. Go to GitHub Actions
2. Select "Start Clip des Jahres Voting" workflow
3. Click "Run workflow"
4. Enter the target year and duration
5. Click "Run workflow" button

### 4. Manual End (Optional)

To manually end CDJ voting:

1. Go to GitHub Actions
2. Select "End Clip des Jahres Voting" workflow
3. Click "Run workflow"

## User Experience

### During Voting Period

1. User visits `clipdesjahres.html`
2. Sees title: "Clip des Jahres [YEAR] - Voting ist aktiv!"
3. Sees all eligible clips with vote buttons
4. Clicks vote button
5. Confirmation modal appears
6. User confirms vote
7. Vote is recorded
8. Thank you message appears with all clips (voted clip highlighted)

### After Voting Period (Winner Exists)

1. User visits `clipdesjahres.html`
2. Sees title: "Clip des Jahres [YEAR]"
3. Sees the winning clip prominently displayed
4. Sees vote count

### After Voting Period (No Winner Yet)

1. User visits `clipdesjahres.html`
2. Sees monthly winners organized by month
3. Sees message about voting period

## Important Notes

1. **Prerequisite**: November's second voting must be completed before starting CDJ voting
2. **Timing**: Automatic start on December 15th ensures voting happens even if manual start is forgotten
3. **Data**: Only top clip from each month (December to November) is eligible
4. **Winner Persistence**: Winner is saved permanently and displayed for the entire next year
5. **Vote Tracking**: Uses both IP hash and LocalStorage for vote persistence

## Testing

### Test Manual Start

```bash
# Ensure November results exist for test year
TARGET_YEAR=2024 DURATION_DAYS=7 npm run start-cdj-voting
```

### Test Manual End

```bash
npm run end-cdj-voting
```

### Test Auto-Check

```bash
npm run check-cdj-voting
```

### Test Frontend

1. Start CDJ voting for current year
2. Visit `clipdesjahres.html`
3. Verify voting interface appears
4. Cast a vote
5. Verify confirmation and vote persistence
6. End CDJ voting
7. Verify winner appears on the page

## Troubleshooting

### Voting Won't Start

- Check that November's second voting was completed
- Check database for `results` table entries for November
- Verify `TARGET_YEAR` is correct

### No Clips Available

- Check `clip_des_jahres` table for entries
- Verify monthly second voting rounds were completed
- Check date range (December prev year to November target year)

### Winner Not Showing

- Check `cdj_winners` table for entry
- Verify voting was ended properly
- Check console for JavaScript errors

### Automatic Timing Not Working

- Verify GitHub Actions workflow is enabled
- Check workflow runs in Actions tab
- Verify cron schedule is correct
- Check for workflow execution errors

## Future Enhancements

- Email notifications when voting starts/ends
- Social media integration for sharing winner
- Historical archive of all past winners
- Leaderboard showing all-time most voted clips
- Analytics dashboard for voting patterns
