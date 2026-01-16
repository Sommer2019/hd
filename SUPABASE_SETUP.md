# Supabase Setup Guide

This guide explains how to set up the Supabase database for the clip voting system.

## ⚠️ Quick Setup Checklist

Before the system will work, you MUST:

1. ✅ Create a Supabase project at https://supabase.com
2. ✅ Run `supabase-schema.sql` in Supabase SQL Editor
3. ✅ Get your anon key from Supabase dashboard (Settings → API)
4. ✅ Update `js/supabase-client.js` with your actual anon key
5. ✅ Add GitHub secrets (SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY)

## Prerequisites

- Supabase account
- Access to your Supabase project dashboard

## Supabase Configuration

### Database URL and Key

You need to configure the following values from your Supabase project:

- **SUPABASE_URL**: `https://itbmerllqlwoinsletkz.supabase.co` (already set in code)
- **SUPABASE_PUBLISHABLE_KEY**: Get from Supabase dashboard (see below)

### How to Get Your Supabase Anon Key

1. Go to your Supabase project dashboard
2. Click on **Settings** (gear icon in sidebar)
3. Click on **API** in the settings menu
4. Under "Project API keys", copy the **anon/public** key
5. This key starts with `eyJ...` and is a JWT token

### Update Frontend Configuration

⚠️ **IMPORTANT**: You must update `js/supabase-client.js` with your actual anon key:

```javascript
const SUPABASE_PUBLISHABLE_KEY = 'eyJ...'; // Paste your anon key here
```

### GitHub Secrets Setup

Add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following secrets:
   - `SUPABASE_URL`: `https://itbmerllqlwoinsletkz.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon/public key (used for both frontend and backend)

**Note**: For production, you should use a service role key for backend operations (fetch-clips, calculate-results). However, if you want to use only the publishable key, you need to adjust the RLS policies to allow anon role to perform all operations. This is less secure but works for this use case.

## Database Schema Setup

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the SQL script from `supabase-schema.sql` to create the necessary tables:
   - `clips` - Stores fetched Twitch clips
   - `votes` - Stores user votes by IP hash
   - `results` - Stores monthly voting results

The schema includes:
- Proper indexes for performance
- Row Level Security (RLS) policies
- Unique constraints to prevent duplicate votes

## How It Works

### 1. Fetching Clips

The `fetch-clips` workflow runs monthly and:
- Fetches clips from Twitch API
- **Clears all existing clips** from the database
- Inserts new clips into the database
- Also saves to `votingData/clips.json` for backward compatibility

### 2. Voting

Users can vote during the last week of each month:
- Frontend fetches clips from Supabase
- Users vote for their favorite clip
- Vote is stored in Supabase with IP hash
- Each IP can only vote once (enforced by unique constraint)
- localStorage is also used for client-side duplicate prevention

### 3. Results Calculation

On the last day of each month:
- Script counts all votes per clip
- Generates top 10 results
- **Saves results monthly** to the database (year/month indexed)
- **Clears all votes** after calculation
- Results remain accessible by year/month

### 4. Displaying Results

The frontend:
- Tries to fetch data from Supabase first
- Falls back to JSON files if Supabase is unavailable
- Shows current month results or previous month if not available

## Testing

To test the setup:

1. Manually trigger the "Fetch Twitch Clips" workflow
2. Visit the voting page during the last week of the month
3. Try to vote for a clip
4. Check Supabase dashboard to verify data is being stored

## Troubleshooting

### Votes not being recorded

- Check that SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set in GitHub Secrets
- Verify RLS policies are enabled in Supabase
- Check browser console for errors

### Frontend not loading clips

- Verify the Supabase client loads correctly (check browser console)
- Check that the clips table has data
- Verify RLS policies allow public read access

### IP detection not working

The system uses `api.ipify.org` to get the user's IP address. If this service is unavailable:
- The system falls back to a session-based ID
- Consider using an alternative IP detection service

## Migration from File Storage

The system now uses Supabase as the primary data store, but maintains backward compatibility:

- JSON files are still generated for clips (not for votes/results)
- Frontend tries Supabase first, then falls back to JSON files
- This allows for gradual migration and testing

## Security Notes

- The publishable key is safe to expose in client-side code
- IP addresses are hashed before storage
- RLS policies prevent unauthorized data modification
- Each IP can only vote once (database constraint)
