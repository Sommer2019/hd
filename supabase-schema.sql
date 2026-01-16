-- Supabase Database Schema for Clip Voting System

-- Table: clips
-- Stores fetched Twitch clips (cleared and refreshed on each fetch)
CREATE TABLE IF NOT EXISTS clips (
    id BIGSERIAL PRIMARY KEY,
    clip_id TEXT NOT NULL UNIQUE,
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
    fetched_at TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL
);

-- Table: votes
-- Stores user votes by IP hash
CREATE TABLE IF NOT EXISTS votes (
    id BIGSERIAL PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    clip_id TEXT NOT NULL,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ip_hash)
);

-- Table: results
-- Stores monthly voting results
CREATE TABLE IF NOT EXISTS results (
    id BIGSERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    rank INTEGER NOT NULL,
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
    calculated_at TIMESTAMPTZ NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_votes INTEGER DEFAULT 0,
    UNIQUE(year, month, rank)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clips_clip_id ON clips(clip_id);
CREATE INDEX IF NOT EXISTS idx_clips_fetched_at ON clips(fetched_at);
CREATE INDEX IF NOT EXISTS idx_votes_ip_hash ON votes(ip_hash);
CREATE INDEX IF NOT EXISTS idx_votes_clip_id ON votes(clip_id);
CREATE INDEX IF NOT EXISTS idx_results_year_month ON results(year, month);
CREATE INDEX IF NOT EXISTS idx_results_rank ON results(year, month, rank);

-- Enable Row Level Security (RLS)
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Clips: Allow public read access, service role for write
CREATE POLICY "Allow public read access to clips"
    ON clips FOR SELECT
    USING (true);

CREATE POLICY "Allow service role to manage clips"
    ON clips FOR ALL
    USING (auth.role() = 'service_role');

-- Votes: Allow public to insert (one per IP), service role for all operations
CREATE POLICY "Allow users to insert their own vote"
    ON votes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow users to read their own vote"
    ON votes FOR SELECT
    USING (true);

CREATE POLICY "Allow service role to manage votes"
    ON votes FOR ALL
    USING (auth.role() = 'service_role');

-- Results: Allow public read access, service role for write
CREATE POLICY "Allow public read access to results"
    ON results FOR SELECT
    USING (true);

CREATE POLICY "Allow service role to manage results"
    ON results FOR ALL
    USING (auth.role() = 'service_role');
