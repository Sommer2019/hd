# Supabase Configuration Setup

As of the latest update, Supabase credentials are now managed through environment variables instead of being hardcoded in `js/supabase-client.js`.

## Overview

The Supabase URL and publishable key are now stored in:
- **Local Development**: `.env` file
- **Production/CI**: GitHub repository secrets
- **Runtime**: `js/config.js` (generated from environment variables)

## Local Development Setup

### Step 1: Create .env file

Copy the example environment file:

```bash
cp .env.example .env
```

### Step 2: Add Your Credentials

Edit `.env` and add your Supabase credentials:

```env
SUPABASE_URL=https://itbmerllqlwoinsletkz.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-actual-key-here
```

To get your publishable key:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Settings** → **API**
4. Copy the **anon / public** key

### Step 3: Generate config.js

Run the build script to generate `js/config.js`:

```bash
npm run build-config
```

This will create `js/config.js` from your `.env` variables.

### Step 4: Test Locally

Open any HTML file in your browser (e.g., `index.html`) and verify:
- No console errors about missing configuration
- Supabase features work correctly (voting, page tracking, etc.)

## Production/CI Setup

For GitHub Pages deployment or CI/CD workflows:

### Step 1: Add GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add/verify these secrets:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_PUBLISHABLE_KEY`: Your anon/public key

### Step 2: Update Deployment Workflow

Add a build step to your deployment workflow (if not already present):

```yaml
- name: Generate Supabase Config
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}
  run: npm run build-config
```

This should run **before** deploying the site.

## File Structure

```
.
├── .env                    # Local environment variables (ignored by git)
├── .env.example            # Template for .env
├── js/
│   ├── config.js          # Generated config (ignored by git)
│   └── supabase-client.js # Supabase client (loads from config.js)
└── scripts/
    └── build-config.js    # Script to generate config.js
```

## Important Notes

### Security
- ✅ The **anon/public key** is safe to expose in client-side code
- ✅ It's protected by Supabase's Row Level Security (RLS) policies
- ⚠️ Never use the `service_role` key in frontend code
- ⚠️ `js/config.js` is in `.gitignore` and should never be committed

### Git Ignore
The following files are ignored by git and should never be committed:
- `.env`
- `.env.local`
- `js/config.js`

### Troubleshooting

**Error: "Supabase configuration not loaded"**
- Make sure `js/config.js` exists
- Run `npm run build-config` to generate it
- Verify your `.env` file has the correct credentials

**Error: "Invalid API key"**
- Double-check your `SUPABASE_PUBLISHABLE_KEY` in `.env`
- Make sure you're using the **anon/public** key, not the service role key
- Verify there are no extra spaces or line breaks in the key

**Config works locally but not in production**
- Verify GitHub secrets are set correctly
- Ensure deployment workflow runs `npm run build-config`
- Check deployment logs for any errors

## Migration from Old Setup

If you're migrating from hardcoded credentials:

1. The old hardcoded values in `js/supabase-client.js` have been removed
2. Follow the "Local Development Setup" above
3. Your existing GitHub secrets should work automatically
4. No changes needed to other scripts in `.github/scripts/`

## Related Documentation

- [Supabase Setup Guide](SUPABASE_SETUP.md)
- [API Key Setup](API_KEY_SETUP.md)
