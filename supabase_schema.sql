-- Painting Journal - Supabase Schema
-- Run this in the Supabase SQL Editor (SQL icon in left sidebar)

-- ============================================
-- PAINTINGS TABLE - Harvested from museum APIs
-- ============================================
CREATE TABLE paintings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL,
    museum TEXT NOT NULL,
    museum_name TEXT,
    title TEXT NOT NULL,
    artist TEXT,
    date_display TEXT,
    medium TEXT,
    dimensions TEXT,
    description TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    museum_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one painting per museum/external_id combo
    UNIQUE(museum, external_id)
);

-- Index for fast searches
CREATE INDEX idx_paintings_artist ON paintings(artist);
CREATE INDEX idx_paintings_title ON paintings USING gin(to_tsvector('english', title));
CREATE INDEX idx_paintings_museum ON paintings(museum);
CREATE INDEX idx_paintings_artist_search ON paintings USING gin(to_tsvector('english', artist));

-- ============================================
-- FAVORITES TABLE - User's saved paintings
-- ============================================
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,  -- For future auth, nullable for now
    painting_id UUID REFERENCES paintings(id) ON DELETE SET NULL,

    -- Denormalized fields for paintings not yet in our DB
    external_id TEXT NOT NULL,
    museum TEXT NOT NULL,
    museum_name TEXT,
    title TEXT NOT NULL,
    artist TEXT,
    date_display TEXT,
    medium TEXT,
    dimensions TEXT,
    description TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    museum_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One favorite per user per painting
    UNIQUE(user_id, museum, external_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_museum ON favorites(museum);

-- ============================================
-- JOURNAL ENTRIES TABLE
-- ============================================
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    favorite_id UUID NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
    entry_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journal_favorite ON journal_entries(favorite_id);

-- ============================================
-- TAGS TABLE
-- ============================================
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,  -- For future multi-user
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, name)
);

-- ============================================
-- FAVORITE_TAGS - Many-to-many join table
-- ============================================
CREATE TABLE favorite_tags (
    favorite_id UUID NOT NULL REFERENCES favorites(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (favorite_id, tag_id)
);

CREATE INDEX idx_favorite_tags_tag ON favorite_tags(tag_id);

-- ============================================
-- HARVEST_LOGS - Track museum data harvests
-- ============================================
CREATE TABLE harvest_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    museum TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    paintings_added INTEGER DEFAULT 0,
    paintings_updated INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',  -- running, completed, failed
    error_message TEXT
);

CREATE INDEX idx_harvest_museum ON harvest_logs(museum);
CREATE INDEX idx_harvest_status ON harvest_logs(status);

-- ============================================
-- API_CACHE - Cache external API responses
-- ============================================
CREATE TABLE api_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    response_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cache_key ON api_cache(cache_key);
CREATE INDEX idx_cache_expires ON api_cache(expires_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to paintings table
CREATE TRIGGER paintings_updated_at
    BEFORE UPDATE ON paintings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Apply to journal_entries table
CREATE TRIGGER journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (for future multi-user)
-- ============================================
-- Enabling RLS but with permissive policies for now

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_tags ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (single user mode)
CREATE POLICY "Allow all on favorites" ON favorites FOR ALL USING (true);
CREATE POLICY "Allow all on journal_entries" ON journal_entries FOR ALL USING (true);
CREATE POLICY "Allow all on tags" ON tags FOR ALL USING (true);
CREATE POLICY "Allow all on favorite_tags" ON favorite_tags FOR ALL USING (true);

-- Paintings and cache are public read
ALTER TABLE paintings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read on paintings" ON paintings FOR SELECT USING (true);
CREATE POLICY "Service write on paintings" ON paintings FOR ALL USING (true);

ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on api_cache" ON api_cache FOR ALL USING (true);

ALTER TABLE harvest_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on harvest_logs" ON harvest_logs FOR ALL USING (true);
