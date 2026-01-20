"""
Migration script to move data from SQLite to Supabase.
Run this once after setting up the Supabase schema.
"""
import sqlite3
import json
from supabase_db import get_client, add_favorite, add_tag_to_favorite, add_journal_entry

SQLITE_PATH = "painting_journal.db"


def migrate():
    """Migrate all data from SQLite to Supabase."""
    print("Starting migration from SQLite to Supabase...")

    # Connect to SQLite
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Test Supabase connection
    try:
        client = get_client()
        print("Connected to Supabase")
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        return

    # Track ID mappings (SQLite ID -> Supabase ID)
    favorite_id_map = {}

    # 1. Migrate favorites
    print("\n1. Migrating favorites...")
    cursor.execute("SELECT * FROM favorites")
    favorites = cursor.fetchall()

    for fav in favorites:
        old_id = fav["id"]
        painting_data = {
            "external_id": fav["external_id"],
            "museum": fav["museum"],
            "title": fav["title"],
            "artist": fav["artist"],
            "date_display": fav["date_display"],
            "medium": fav["medium"],
            "dimensions": fav["dimensions"],
            "description": fav["description"],
            "image_url": fav["image_url"],
            "thumbnail_url": fav["thumbnail_url"],
            "museum_url": fav["museum_url"],
        }

        new_id = add_favorite(painting_data)
        if new_id:
            favorite_id_map[old_id] = new_id
            print(f"  Migrated favorite: {fav['title'][:50]}...")
        else:
            print(f"  FAILED to migrate: {fav['title'][:50]}...")

    print(f"  Migrated {len(favorite_id_map)} favorites")

    # 2. Migrate tags and favorite_tags
    print("\n2. Migrating tags...")
    cursor.execute("""
        SELECT f.id as favorite_id, t.name as tag_name
        FROM favorite_tags ft
        JOIN favorites f ON ft.favorite_id = f.id
        JOIN tags t ON ft.tag_id = t.id
    """)
    tag_links = cursor.fetchall()

    tag_count = 0
    for link in tag_links:
        old_fav_id = link["favorite_id"]
        tag_name = link["tag_name"]

        if old_fav_id in favorite_id_map:
            new_fav_id = favorite_id_map[old_fav_id]
            if add_tag_to_favorite(new_fav_id, tag_name):
                tag_count += 1

    print(f"  Migrated {tag_count} tag links")

    # 3. Migrate journal entries
    print("\n3. Migrating journal entries...")
    cursor.execute("SELECT * FROM journal_entries")
    entries = cursor.fetchall()

    entry_count = 0
    for entry in entries:
        old_fav_id = entry["favorite_id"]

        if old_fav_id in favorite_id_map:
            new_fav_id = favorite_id_map[old_fav_id]
            if add_journal_entry(new_fav_id, entry["entry_text"]):
                entry_count += 1

    print(f"  Migrated {entry_count} journal entries")

    conn.close()

    print("\n" + "=" * 50)
    print("Migration complete!")
    print(f"  Favorites: {len(favorite_id_map)}")
    print(f"  Tag links: {tag_count}")
    print(f"  Journal entries: {entry_count}")
    print("=" * 50)


if __name__ == "__main__":
    migrate()
