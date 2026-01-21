-- Painting Journal - Auth Migration
-- Run this in Supabase SQL Editor AFTER enabling Auth in your project
-- This updates the schema to support multi-user with Supabase Auth

-- ============================================
-- 1. ADD USER_ID TO JOURNAL_ENTRIES
-- ============================================
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS user_id UUID;

-- Create index for user_id queries
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);

-- ============================================
-- 2. DROP OLD PERMISSIVE POLICIES
-- ============================================
DROP POLICY IF EXISTS "Allow all on favorites" ON favorites;
DROP POLICY IF EXISTS "Allow all on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow all on tags" ON tags;
DROP POLICY IF EXISTS "Allow all on favorite_tags" ON favorite_tags;

-- ============================================
-- 3. CREATE USER-SCOPED RLS POLICIES
-- ============================================

-- FAVORITES: Users can only see/modify their own favorites
CREATE POLICY "Users can view own favorites"
    ON favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
    ON favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
    ON favorites FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
    ON favorites FOR DELETE
    USING (auth.uid() = user_id);

-- JOURNAL ENTRIES: Users can only see/modify entries on their favorites
CREATE POLICY "Users can view own journal entries"
    ON journal_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
    ON journal_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
    ON journal_entries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
    ON journal_entries FOR DELETE
    USING (auth.uid() = user_id);

-- TAGS: Users can only see/modify their own tags
CREATE POLICY "Users can view own tags"
    ON tags FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags"
    ON tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
    ON tags FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
    ON tags FOR DELETE
    USING (auth.uid() = user_id);

-- FAVORITE_TAGS: Users can modify tags on their own favorites
CREATE POLICY "Users can view own favorite_tags"
    ON favorite_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM favorites
            WHERE favorites.id = favorite_tags.favorite_id
            AND favorites.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own favorite_tags"
    ON favorite_tags FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM favorites
            WHERE favorites.id = favorite_tags.favorite_id
            AND favorites.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own favorite_tags"
    ON favorite_tags FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM favorites
            WHERE favorites.id = favorite_tags.favorite_id
            AND favorites.user_id = auth.uid()
        )
    );

-- ============================================
-- 4. SERVICE ROLE BYPASS (for server-side operations)
-- ============================================
-- Note: When using service_role key, RLS is bypassed automatically
-- This is useful for admin operations and migrations

-- ============================================
-- DONE!
-- Your existing data (with null user_id) will be hidden.
-- New signups will start with empty collections.
-- ============================================
