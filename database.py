"""
Database module for Art Stuff.
Handles SQLite storage for favorites, tags, and journal entries.
"""
import sqlite3
import json
from datetime import datetime
from contextlib import contextmanager

DATABASE_PATH = "painting_journal.db"


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize the database with required tables."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Favorites table - stores saved paintings
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                external_id TEXT NOT NULL,
                museum TEXT NOT NULL,
                title TEXT,
                artist TEXT,
                date_display TEXT,
                medium TEXT,
                dimensions TEXT,
                description TEXT,
                image_url TEXT,
                thumbnail_url TEXT,
                museum_url TEXT,
                metadata_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(external_id, museum)
            )
        """)

        # Tags table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        """)

        # Favorite-Tag junction table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS favorite_tags (
                favorite_id INTEGER,
                tag_id INTEGER,
                PRIMARY KEY (favorite_id, tag_id),
                FOREIGN KEY (favorite_id) REFERENCES favorites(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        """)

        # Journal entries table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS journal_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                favorite_id INTEGER NOT NULL,
                entry_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (favorite_id) REFERENCES favorites(id) ON DELETE CASCADE
            )
        """)

        # API cache table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_cache (
                cache_key TEXT PRIMARY KEY,
                response_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()


# Favorites functions
def add_favorite(painting_data):
    """Add a painting to favorites."""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO favorites
                (external_id, museum, title, artist, date_display, medium,
                 dimensions, description, image_url, thumbnail_url, museum_url, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                painting_data.get('external_id'),
                painting_data.get('museum'),
                painting_data.get('title'),
                painting_data.get('artist'),
                painting_data.get('date_display'),
                painting_data.get('medium'),
                painting_data.get('dimensions'),
                painting_data.get('description'),
                painting_data.get('image_url'),
                painting_data.get('thumbnail_url'),
                painting_data.get('museum_url'),
                json.dumps(painting_data.get('metadata', {}))
            ))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            # Already exists
            cursor.execute("""
                SELECT id FROM favorites WHERE external_id = ? AND museum = ?
            """, (painting_data.get('external_id'), painting_data.get('museum')))
            row = cursor.fetchone()
            return row['id'] if row else None


def remove_favorite(favorite_id):
    """Remove a painting from favorites."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM favorites WHERE id = ?", (favorite_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_favorite(favorite_id):
    """Get a single favorite by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM favorites WHERE id = ?", (favorite_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def get_favorite_by_external_id(external_id, museum):
    """Get a favorite by external ID and museum."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM favorites WHERE external_id = ? AND museum = ?",
            (external_id, museum)
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def get_all_favorites(filters=None):
    """Get all favorites with optional filters."""
    with get_db() as conn:
        cursor = conn.cursor()

        query = "SELECT * FROM favorites"
        params = []
        conditions = []

        if filters:
            if filters.get('artist'):
                conditions.append("artist LIKE ?")
                params.append(f"%{filters['artist']}%")
            if filters.get('museum'):
                conditions.append("museum = ?")
                params.append(filters['museum'])
            if filters.get('tag'):
                query = """
                    SELECT DISTINCT f.* FROM favorites f
                    JOIN favorite_tags ft ON f.id = ft.favorite_id
                    JOIN tags t ON ft.tag_id = t.id
                """
                conditions.append("t.name = ?")
                params.append(filters['tag'])

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY created_at DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        favorites = []
        for row in rows:
            fav = dict(row)
            # Get tags for this favorite
            cursor.execute("""
                SELECT t.name FROM tags t
                JOIN favorite_tags ft ON t.id = ft.tag_id
                WHERE ft.favorite_id = ?
            """, (fav['id'],))
            fav['tags'] = [r['name'] for r in cursor.fetchall()]
            favorites.append(fav)

        return favorites


def get_random_favorite():
    """Get a random favorite for 'painting of the day'."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM favorites ORDER BY RANDOM() LIMIT 1")
        row = cursor.fetchone()
        if row:
            fav = dict(row)
            cursor.execute("""
                SELECT t.name FROM tags t
                JOIN favorite_tags ft ON t.id = ft.tag_id
                WHERE ft.favorite_id = ?
            """, (fav['id'],))
            fav['tags'] = [r['name'] for r in cursor.fetchall()]
            return fav
        return None


# Tags functions
def add_tag_to_favorite(favorite_id, tag_name):
    """Add a tag to a favorite."""
    with get_db() as conn:
        cursor = conn.cursor()
        # Get or create tag
        cursor.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (tag_name.lower().strip(),))
        cursor.execute("SELECT id FROM tags WHERE name = ?", (tag_name.lower().strip(),))
        tag_id = cursor.fetchone()['id']

        # Link tag to favorite
        try:
            cursor.execute(
                "INSERT INTO favorite_tags (favorite_id, tag_id) VALUES (?, ?)",
                (favorite_id, tag_id)
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False


def remove_tag_from_favorite(favorite_id, tag_name):
    """Remove a tag from a favorite."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM favorite_tags
            WHERE favorite_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)
        """, (favorite_id, tag_name.lower().strip()))
        conn.commit()
        return cursor.rowcount > 0


def get_all_tags():
    """Get all tags with counts."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.name, COUNT(ft.favorite_id) as count
            FROM tags t
            LEFT JOIN favorite_tags ft ON t.id = ft.tag_id
            GROUP BY t.id
            HAVING count > 0
            ORDER BY count DESC
        """)
        return [{'name': r['name'], 'count': r['count']} for r in cursor.fetchall()]


# Journal functions
def add_journal_entry(favorite_id, entry_text):
    """Add a journal entry for a favorite."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO journal_entries (favorite_id, entry_text)
            VALUES (?, ?)
        """, (favorite_id, entry_text))
        conn.commit()
        return cursor.lastrowid


def update_journal_entry(entry_id, entry_text):
    """Update a journal entry."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE journal_entries
            SET entry_text = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (entry_text, entry_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_journal_entry(entry_id):
    """Delete a journal entry."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM journal_entries WHERE id = ?", (entry_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_journal_entries(favorite_id):
    """Get all journal entries for a favorite."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM journal_entries
            WHERE favorite_id = ?
            ORDER BY created_at DESC
        """, (favorite_id,))
        return [dict(row) for row in cursor.fetchall()]


# Cache functions
def get_cached_response(cache_key):
    """Get a cached API response."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT response_json FROM api_cache WHERE cache_key = ?",
            (cache_key,)
        )
        row = cursor.fetchone()
        if row:
            return json.loads(row['response_json'])
        return None


def set_cached_response(cache_key, response_data):
    """Cache an API response."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO api_cache (cache_key, response_json)
            VALUES (?, ?)
        """, (cache_key, json.dumps(response_data)))
        conn.commit()


def clear_old_cache(days=7):
    """Clear cache entries older than specified days."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM api_cache
            WHERE created_at < datetime('now', ?)
        """, (f'-{days} days',))
        conn.commit()
        return cursor.rowcount
