"""
Database module for Art Stuff - Supabase version.
Handles cloud storage for paintings, favorites, tags, and journal entries.
"""
import os
import json
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase: Client = None

def get_client() -> Client:
    """Get or create Supabase client."""
    global supabase
    if supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase


def init_db():
    """Initialize database - for Supabase, just verify connection."""
    client = get_client()
    # Test connection by querying paintings (public table)
    try:
        client.table("paintings").select("id").limit(1).execute()
        print("Supabase connection successful")
        return True
    except Exception as e:
        print(f"Supabase connection failed: {e}")
        print("Make sure you've run supabase_schema.sql in the Supabase SQL Editor")
        return False


# ============================================
# AUTH FUNCTIONS
# ============================================

def sign_up(email, password):
    """Create a new user account."""
    client = get_client()
    try:
        result = client.auth.sign_up({
            "email": email,
            "password": password
        })
        if result.user:
            return {
                "user": {
                    "id": result.user.id,
                    "email": result.user.email
                },
                "session": {
                    "access_token": result.session.access_token if result.session else None,
                    "refresh_token": result.session.refresh_token if result.session else None
                } if result.session else None
            }
    except Exception as e:
        print(f"Sign up error: {e}")
        return {"error": str(e)}
    return {"error": "Sign up failed"}


def sign_in(email, password):
    """Sign in an existing user."""
    client = get_client()
    try:
        result = client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        if result.user and result.session:
            return {
                "user": {
                    "id": result.user.id,
                    "email": result.user.email
                },
                "session": {
                    "access_token": result.session.access_token,
                    "refresh_token": result.session.refresh_token
                }
            }
    except Exception as e:
        print(f"Sign in error: {e}")
        return {"error": str(e)}
    return {"error": "Invalid email or password"}


def sign_out(access_token):
    """Sign out a user."""
    client = get_client()
    try:
        client.auth.sign_out()
        return {"success": True}
    except Exception as e:
        print(f"Sign out error: {e}")
        return {"error": str(e)}


def get_user_from_token(access_token):
    """Get user info from an access token."""
    client = get_client()
    try:
        result = client.auth.get_user(access_token)
        if result.user:
            return {
                "id": result.user.id,
                "email": result.user.email
            }
    except Exception as e:
        print(f"Get user error: {e}")
    return None


# ============================================
# FAVORITES FUNCTIONS
# ============================================

def add_favorite(painting_data, user_id):
    """Add a painting to favorites."""
    client = get_client()

    data = {
        "user_id": user_id,
        "external_id": painting_data.get("external_id"),
        "museum": painting_data.get("museum"),
        "museum_name": painting_data.get("museum_name"),
        "title": painting_data.get("title"),
        "artist": painting_data.get("artist"),
        "date_display": painting_data.get("date_display"),
        "medium": painting_data.get("medium"),
        "dimensions": painting_data.get("dimensions"),
        "description": painting_data.get("description"),
        "image_url": painting_data.get("image_url"),
        "thumbnail_url": painting_data.get("thumbnail_url"),
        "museum_url": painting_data.get("museum_url"),
    }

    try:
        result = client.table("favorites").insert(data).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        # Check if it's a duplicate
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            existing = get_favorite_by_external_id(
                painting_data.get("external_id"),
                painting_data.get("museum"),
                user_id
            )
            return existing["id"] if existing else None
        print(f"Error adding favorite: {e}")
    return None


def remove_favorite(favorite_id, user_id):
    """Remove a painting from favorites."""
    client = get_client()
    try:
        result = (client.table("favorites")
                  .delete()
                  .eq("id", favorite_id)
                  .eq("user_id", user_id)
                  .execute())
        return len(result.data) > 0 if result.data else False
    except Exception as e:
        print(f"Error removing favorite: {e}")
        return False


def get_favorite(favorite_id, user_id):
    """Get a single favorite by ID."""
    client = get_client()
    try:
        result = (client.table("favorites")
                  .select("*")
                  .eq("id", favorite_id)
                  .eq("user_id", user_id)
                  .execute())
        if result.data:
            fav = result.data[0]
            fav["tags"] = get_tags_for_favorite(favorite_id, user_id)
            fav["journal_entries"] = get_journal_entries(favorite_id, user_id)
            return fav
    except Exception as e:
        print(f"Error getting favorite: {e}")
    return None


def get_favorite_by_external_id(external_id, museum, user_id):
    """Get a favorite by external ID and museum."""
    client = get_client()
    try:
        result = (client.table("favorites")
                  .select("*")
                  .eq("external_id", external_id)
                  .eq("museum", museum)
                  .eq("user_id", user_id)
                  .execute())
        if result.data:
            fav = result.data[0]
            fav["tags"] = get_tags_for_favorite(fav["id"], user_id)
            return fav
    except Exception as e:
        print(f"Error getting favorite by external_id: {e}")
    return None


def get_all_favorites(user_id, filters=None):
    """Get all favorites with optional filters."""
    client = get_client()
    try:
        query = client.table("favorites").select("*").eq("user_id", user_id)

        if filters:
            if filters.get("artist"):
                query = query.ilike("artist", f"%{filters['artist']}%")
            if filters.get("museum"):
                query = query.eq("museum", filters["museum"])

        query = query.order("created_at", desc=True)
        result = query.execute()

        favorites = []
        for fav in result.data or []:
            fav["tags"] = get_tags_for_favorite(fav["id"], user_id)

            # Filter by tag if specified
            if filters and filters.get("tag"):
                if filters["tag"] not in fav["tags"]:
                    continue

            favorites.append(fav)

        return favorites
    except Exception as e:
        print(f"Error getting favorites: {e}")
        return []


def get_random_favorite(user_id):
    """Get a random favorite for 'painting of the day'."""
    client = get_client()
    try:
        # Supabase doesn't have RANDOM(), so we get all and pick one
        result = client.table("favorites").select("*").eq("user_id", user_id).execute()
        if result.data:
            import random
            fav = random.choice(result.data)
            fav["tags"] = get_tags_for_favorite(fav["id"], user_id)
            return fav
    except Exception as e:
        print(f"Error getting random favorite: {e}")
    return None


# ============================================
# TAGS FUNCTIONS
# ============================================

def get_or_create_tag(tag_name, user_id):
    """Get or create a tag, return its ID."""
    client = get_client()
    tag_name = tag_name.lower().strip()

    try:
        # Try to find existing for this user
        result = (client.table("tags")
                  .select("id")
                  .eq("name", tag_name)
                  .eq("user_id", user_id)
                  .execute())
        if result.data:
            return result.data[0]["id"]

        # Create new
        result = client.table("tags").insert({
            "name": tag_name,
            "user_id": user_id
        }).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        print(f"Error with tag: {e}")
    return None


def add_tag_to_favorite(favorite_id, tag_name, user_id):
    """Add a tag to a favorite."""
    client = get_client()
    tag_id = get_or_create_tag(tag_name, user_id)

    if not tag_id:
        return False

    try:
        client.table("favorite_tags").insert({
            "favorite_id": favorite_id,
            "tag_id": tag_id
        }).execute()
        return True
    except Exception as e:
        if "duplicate" not in str(e).lower():
            print(f"Error adding tag to favorite: {e}")
        return False


def remove_tag_from_favorite(favorite_id, tag_name, user_id):
    """Remove a tag from a favorite."""
    client = get_client()
    tag_name = tag_name.lower().strip()

    try:
        # Get tag ID for this user
        tag_result = (client.table("tags")
                      .select("id")
                      .eq("name", tag_name)
                      .eq("user_id", user_id)
                      .execute())
        if not tag_result.data:
            return False

        tag_id = tag_result.data[0]["id"]

        # Remove the link
        result = (client.table("favorite_tags")
                  .delete()
                  .eq("favorite_id", favorite_id)
                  .eq("tag_id", tag_id)
                  .execute())
        return True
    except Exception as e:
        print(f"Error removing tag: {e}")
        return False


def get_tags_for_favorite(favorite_id, user_id):
    """Get all tags for a favorite."""
    client = get_client()
    try:
        # Join favorite_tags with tags
        result = (client.table("favorite_tags")
                  .select("tag_id, tags(name)")
                  .eq("favorite_id", favorite_id)
                  .execute())

        tags = []
        for item in result.data or []:
            if item.get("tags") and item["tags"].get("name"):
                tags.append(item["tags"]["name"])
        return tags
    except Exception as e:
        print(f"Error getting tags for favorite: {e}")
        return []


def get_all_tags(user_id):
    """Get all tags with counts for a user."""
    client = get_client()
    try:
        # Get all tags for this user
        result = client.table("tags").select("id, name").eq("user_id", user_id).execute()

        tags_with_counts = []
        for tag in result.data or []:
            # Count favorites for this tag
            count_result = (client.table("favorite_tags")
                          .select("favorite_id", count="exact")
                          .eq("tag_id", tag["id"])
                          .execute())
            count = count_result.count if count_result.count else 0
            if count > 0:
                tags_with_counts.append({"name": tag["name"], "count": count})

        return sorted(tags_with_counts, key=lambda x: x["count"], reverse=True)
    except Exception as e:
        print(f"Error getting all tags: {e}")
        return []


# ============================================
# JOURNAL FUNCTIONS
# ============================================

def add_journal_entry(favorite_id, entry_text, user_id):
    """Add a journal entry for a favorite."""
    client = get_client()
    try:
        result = client.table("journal_entries").insert({
            "favorite_id": favorite_id,
            "entry_text": entry_text,
            "user_id": user_id
        }).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        print(f"Error adding journal entry: {e}")
    return None


def update_journal_entry(entry_id, entry_text, user_id):
    """Update a journal entry."""
    client = get_client()
    try:
        result = (client.table("journal_entries")
                  .update({"entry_text": entry_text})
                  .eq("id", entry_id)
                  .eq("user_id", user_id)
                  .execute())
        return len(result.data) > 0 if result.data else False
    except Exception as e:
        print(f"Error updating journal entry: {e}")
        return False


def delete_journal_entry(entry_id, user_id):
    """Delete a journal entry."""
    client = get_client()
    try:
        result = (client.table("journal_entries")
                  .delete()
                  .eq("id", entry_id)
                  .eq("user_id", user_id)
                  .execute())
        return True
    except Exception as e:
        print(f"Error deleting journal entry: {e}")
        return False


def get_journal_entries(favorite_id, user_id):
    """Get all journal entries for a favorite."""
    client = get_client()
    try:
        result = (client.table("journal_entries")
                  .select("*")
                  .eq("favorite_id", favorite_id)
                  .eq("user_id", user_id)
                  .order("created_at", desc=True)
                  .execute())
        return result.data or []
    except Exception as e:
        print(f"Error getting journal entries: {e}")
        return []


# ============================================
# CACHE FUNCTIONS
# ============================================

def get_cached_response(cache_key):
    """Get a cached API response."""
    client = get_client()
    try:
        result = (client.table("api_cache")
                  .select("response_data, expires_at")
                  .eq("cache_key", cache_key)
                  .execute())

        if result.data:
            cache_entry = result.data[0]
            # Check if expired
            expires_at = datetime.fromisoformat(cache_entry["expires_at"].replace("Z", "+00:00"))
            if expires_at > datetime.now(expires_at.tzinfo):
                return cache_entry["response_data"]
            else:
                # Clean up expired entry
                client.table("api_cache").delete().eq("cache_key", cache_key).execute()
    except Exception as e:
        print(f"Error getting cached response: {e}")
    return None


def set_cached_response(cache_key, response_data, ttl_hours=24):
    """Cache an API response."""
    client = get_client()
    try:
        expires_at = (datetime.utcnow() + timedelta(hours=ttl_hours)).isoformat()

        # Upsert (insert or update)
        client.table("api_cache").upsert({
            "cache_key": cache_key,
            "response_data": response_data,
            "expires_at": expires_at
        }).execute()
    except Exception as e:
        print(f"Error setting cache: {e}")


def clear_old_cache(days=7):
    """Clear cache entries older than specified days."""
    client = get_client()
    try:
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        result = (client.table("api_cache")
                  .delete()
                  .lt("created_at", cutoff)
                  .execute())
        return len(result.data) if result.data else 0
    except Exception as e:
        print(f"Error clearing cache: {e}")
        return 0


# ============================================
# PAINTINGS TABLE FUNCTIONS (for harvested data)
# ============================================

def upsert_painting(painting_data):
    """Insert or update a painting in the main paintings table."""
    client = get_client()

    data = {
        "external_id": painting_data.get("external_id"),
        "museum": painting_data.get("museum"),
        "museum_name": painting_data.get("museum_name"),
        "title": painting_data.get("title"),
        "artist": painting_data.get("artist"),
        "date_display": painting_data.get("date_display"),
        "medium": painting_data.get("medium"),
        "dimensions": painting_data.get("dimensions"),
        "description": painting_data.get("description"),
        "image_url": painting_data.get("image_url"),
        "thumbnail_url": painting_data.get("thumbnail_url"),
        "museum_url": painting_data.get("museum_url"),
        "metadata": painting_data.get("metadata", {})
    }

    try:
        result = client.table("paintings").upsert(
            data,
            on_conflict="museum,external_id"
        ).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error upserting painting: {e}")
        return None


def search_paintings(query, museum=None, page=1, limit=20):
    """Search the paintings table."""
    client = get_client()
    try:
        offset = (page - 1) * limit

        # Build query
        q = client.table("paintings").select("*", count="exact")

        # Text search on title, artist, and description
        if query:
            queries = [query]

            # ASCII to special character mappings (for when user types ASCII)
            ascii_to_special = {
                'kroyer': 'Krøyer', 'kroger': 'Krøyer',
                'ancher': 'Ancher',
                'hammershoi': 'Hammershøi',
                'kobke': 'Købke',
                'eckersberg': 'Eckersberg',
                'cezanne': 'Cézanne',
                'monet': 'Monet',
                'renoir': 'Renoir',
                'durer': 'Dürer',
            }

            # Check if query matches any ASCII version
            query_lower = query.lower()
            for ascii_ver, special_ver in ascii_to_special.items():
                if ascii_ver in query_lower:
                    queries.append(query_lower.replace(ascii_ver, special_ver.lower()))
                    queries.append(special_ver)

            # Build OR conditions for all query variants
            conditions = []
            for q_term in set(queries):  # Use set to avoid duplicates
                conditions.extend([
                    f"title.ilike.%{q_term}%",
                    f"artist.ilike.%{q_term}%",
                    f"description.ilike.%{q_term}%"
                ])
            q = q.or_(",".join(conditions))

        if museum:
            q = q.eq("museum", museum)

        q = q.range(offset, offset + limit - 1)

        result = q.execute()

        return {
            "paintings": result.data or [],
            "total": result.count or 0,
            "page": page
        }
    except Exception as e:
        print(f"Error searching paintings: {e}")
        return {"paintings": [], "total": 0, "page": page}


def get_painting_from_db(museum, external_id):
    """Get a painting from the local database."""
    client = get_client()
    try:
        result = (client.table("paintings")
                  .select("*")
                  .eq("museum", museum)
                  .eq("external_id", external_id)
                  .execute())
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting painting: {e}")
        return None


def get_random_painting():
    """Get a random painting from the database."""
    client = get_client()
    try:
        # Get count first
        count_result = client.table("paintings").select("id", count="exact").execute()
        total = count_result.count or 0

        if total == 0:
            return None

        import random
        offset = random.randint(0, total - 1)

        result = client.table("paintings").select("*").range(offset, offset).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting random painting: {e}")
        return None


def get_collection_stats():
    """Get statistics about the painting collection."""
    client = get_client()
    try:
        # Get total paintings count
        paintings_result = client.table("paintings").select("id", count="exact").execute()
        total_paintings = paintings_result.count or 0

        # Get unique artists
        artists_result = client.table("paintings").select("artist").execute()
        artists = set(p["artist"] for p in artists_result.data if p.get("artist") and p["artist"] not in ["anonymous", "Unknown", "Artist unknown", "Unknown Artist"])
        unique_artists = len(artists)

        # Get unique museums
        museums_result = client.table("paintings").select("museum_name").execute()
        museums = set(p["museum_name"] for p in museums_result.data if p.get("museum_name"))
        unique_museums = len(museums)

        return {
            "paintings": total_paintings,
            "artists": unique_artists,
            "museums": unique_museums
        }
    except Exception as e:
        print(f"Error getting collection stats: {e}")
        return {"paintings": 0, "artists": 0, "museums": 0}
