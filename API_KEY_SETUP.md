# ⚠️ IMPORTANT: Supabase API Key Configuration Required

## Error: "Invalid API key"

If you're seeing this error, it means the Supabase anon key in `js/supabase-client.js` needs to be configured with your actual key.

## How to Fix

### Step 1: Get Your Anon Key from Supabase

1. Open your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (itbmerllqlwoinsletkz)
3. Click **Settings** (⚙️ gear icon) in the left sidebar
4. Click **API** in the settings menu
5. Look for "Project API keys" section
6. Copy the **anon** / **public** key (it starts with `eyJ...`)

### Step 2: Update the Frontend Code

Edit the file `js/supabase-client.js`:

```javascript
// Find this line:
const SUPABASE_PUBLISHABLE_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Replace it with your actual key:
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...';
```

### Step 3: Add to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add a new secret:
   - Name: `SUPABASE_PUBLISHABLE_KEY`
   - Value: Your anon key (same one from Step 1)

### Step 4: Verify

1. Commit and push the changes to `js/supabase-client.js`
2. Visit the clipdesmonats page
3. The error should be gone and data should load from Supabase

## What is the Anon Key?

The anon (anonymous/public) key is a **public key** that is safe to expose in client-side code. It's designed to be used in browser applications and is protected by Supabase's Row Level Security (RLS) policies.

## Security Note

- ✅ The anon key is **safe** to commit in your repository
- ✅ It can only access data allowed by RLS policies
- ✅ It cannot modify or delete data without proper permissions
- ⚠️ Do NOT use the service_role key in frontend code (that one is secret!)

## Still Having Issues?

Make sure:
- Your Supabase project URL is: `https://itbmerllqlwoinsletkz.supabase.co`
- You've run the `supabase-schema.sql` to create tables
- RLS policies are enabled on the tables
- The anon key is copied correctly (no spaces or line breaks)

For more details, see `SUPABASE_SETUP.md`.
