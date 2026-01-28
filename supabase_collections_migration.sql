-- Collections feature migration
-- Run this in the Supabase SQL Editor

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT NOT NULL UNIQUE,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection items (paintings in a collection)
CREATE TABLE IF NOT EXISTS collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    museum TEXT NOT NULL,
    title TEXT,
    artist TEXT,
    image_url TEXT,
    date_display TEXT,
    position INTEGER DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, museum, external_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);

-- RLS policies
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Collections: owners can do anything, public ones are viewable by all
CREATE POLICY "Users can manage own collections"
    ON collections FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Public collections are viewable"
    ON collections FOR SELECT
    USING (is_public = true);

-- Collection items: owners can manage, public collection items are viewable
CREATE POLICY "Users can manage own collection items"
    ON collection_items FOR ALL
    USING (
        collection_id IN (
            SELECT id FROM collections WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Public collection items are viewable"
    ON collection_items FOR SELECT
    USING (
        collection_id IN (
            SELECT id FROM collections WHERE is_public = true
        )
    );
