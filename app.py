"""
Art Stuff - A place to discover cool art stuff.
"""
import webbrowser
import threading
from functools import wraps
from flask import Flask, render_template, request, jsonify, redirect, url_for, g

# Use Supabase for cloud database (comment out and use 'database' for local SQLite)
import supabase_db as db
# import database as db  # Uncomment for local SQLite

import museum_apis as api
import categories

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Initialize database on startup
db.init_db()


# ============================================
# AUTH HELPERS
# ============================================

def get_current_user():
    """Get current user from Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        return db.get_user_from_token(token)
    return None


def require_auth(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        g.user = user
        return f(*args, **kwargs)
    return decorated


# ============================================
# AUTH ROUTES
# ============================================

@app.route('/login')
def login_page():
    """Login/signup page."""
    return render_template('auth.html')


@app.route('/api/auth/signup', methods=['POST'])
def api_signup():
    """Create a new user account."""
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email and password are required"}), 400

    result = db.sign_up(data['email'], data['password'])
    if result.get('error'):
        return jsonify(result), 400
    return jsonify(result)


@app.route('/api/auth/login', methods=['POST'])
def api_login():
    """Sign in a user."""
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email and password are required"}), 400

    result = db.sign_in(data['email'], data['password'])
    if result.get('error'):
        return jsonify(result), 401
    return jsonify(result)


@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    """Sign out a user."""
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:] if auth_header.startswith('Bearer ') else None
    result = db.sign_out(token)
    return jsonify(result)


@app.route('/api/auth/user')
def api_get_user():
    """Get the current user."""
    user = get_current_user()
    if user:
        return jsonify({"user": user})
    return jsonify({"user": None})


# Page routes
@app.route('/')
def home():
    """Show landing page for guests, redirect to explore for logged-in users."""
    # Check if user is authenticated via token in cookie or session
    # For now, we'll show landing and let JS handle redirect if logged in
    return render_template('landing.html')


@app.route('/search')
def search_page():
    """Search page."""
    return render_template('search.html')


@app.route('/collection')
def collection_page():
    """Collection page."""
    return render_template('collection.html')


@app.route('/painting/<museum>/<path:external_id>')
def painting_page(museum, external_id):
    """Single painting detail page."""
    return render_template('painting.html', museum=museum, external_id=external_id)


@app.route('/explore')
def explore_page():
    """Main exploration page - the new home."""
    return render_template('explore.html')


@app.route('/explore/era/<era_key>')
def explore_era(era_key):
    """Browse paintings from a specific era."""
    era = categories.ERAS.get(era_key)
    if not era:
        return render_template('404.html'), 404
    return render_template('browse.html',
                          category_type='era',
                          category_key=era_key,
                          category=era)


@app.route('/explore/theme/<theme_key>')
def explore_theme(theme_key):
    """Browse paintings by theme."""
    theme = categories.THEMES.get(theme_key)
    if not theme:
        return render_template('404.html'), 404
    return render_template('browse.html',
                          category_type='theme',
                          category_key=theme_key,
                          category=theme)


@app.route('/explore/mood/<mood_key>')
def explore_mood(mood_key):
    """Browse paintings by mood."""
    mood = categories.MOODS.get(mood_key)
    if not mood:
        return render_template('404.html'), 404
    return render_template('browse.html',
                          category_type='mood',
                          category_key=mood_key,
                          category=mood)


@app.route('/explore/artist/<artist_name>')
def explore_artist(artist_name):
    """Browse works by a specific artist."""
    return render_template('artist.html', artist_name=artist_name)


# API routes
@app.route('/api/search')
def api_search():
    """Search for paintings in local database."""
    query = request.args.get('q', '')
    museum = request.args.get('museum', None)
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))

    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    # Search local Supabase database
    results = db.search_paintings(query, museum, page, limit)

    # Add spelling suggestion if few/no results found
    if results.get('total', 0) < 3:
        suggestion = api.suggest_spelling(query)
        if suggestion:
            results['suggestion'] = suggestion

    return jsonify(results)


@app.route('/api/explore/categories')
def api_get_categories():
    """Get all category data for the explore page."""
    representatives = categories.get_representative_paintings()
    return jsonify({
        "eras": {k: {"key": k, **v} for k, v in categories.ERAS.items()},
        "themes": {k: {"key": k, **v} for k, v in categories.THEMES.items()},
        "moods": {k: {"key": k, **v} for k, v in categories.MOODS.items()},
        "featured_artist": categories.get_featured_artist(),
        "weekly_spotlight": categories.get_weekly_spotlight(),
        "representatives": representatives
    })


@app.route('/api/explore/<category_type>/<category_key>')
def api_explore_category(category_type, category_key):
    """Fetch paintings for a specific category."""
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 12))

    result = categories.fetch_by_category(category_type, category_key, page, limit)
    return jsonify(result)


@app.route('/api/explore/surprise')
def api_surprise():
    """Get a random painting for 'Surprise Me' feature."""
    painting = categories.fetch_surprise()
    if painting:
        return jsonify(painting)
    return jsonify({"error": "Could not fetch a painting"}), 500


@app.route('/api/explore/preview')
def api_preview():
    """Get a curated preview of paintings for guests (not logged in)."""
    # Get random paintings from different categories for preview
    paintings = []

    # Fetch from a few different searches to get variety
    preview_terms = ['portrait', 'landscape', 'still life', 'sea', 'garden']
    import random
    random.shuffle(preview_terms)

    for term in preview_terms[:3]:
        results = db.search_paintings(term, None, 1, 10)
        paintings.extend(results.get('paintings', []))

    # Shuffle and limit to 30
    random.shuffle(paintings)
    return jsonify({"paintings": paintings[:30]})


@app.route('/api/stats')
def api_stats():
    """Get collection statistics (total paintings, artists, museums)."""
    stats = db.get_collection_stats()
    return jsonify(stats)


@app.route('/api/explore/artist/<artist_name>')
def api_artist_works(artist_name):
    """Fetch works by a specific artist."""
    limit = int(request.args.get('limit', 12))
    paintings = categories.fetch_artist_works(artist_name, limit)
    return jsonify({"paintings": paintings, "artist": artist_name})


@app.route('/api/painting/<museum>/<path:external_id>')
def api_get_painting(museum, external_id):
    """Get a single painting's details."""
    painting = api.get_painting(museum, external_id)
    if not painting:
        return jsonify({"error": "Painting not found"}), 404

    # Check if it's a favorite for the current user
    user = get_current_user()
    painting['is_favorite'] = False
    painting['favorite_id'] = None
    painting['tags'] = []

    if user:
        favorite = db.get_favorite_by_external_id(external_id, museum, user['id'])
        if favorite:
            painting['is_favorite'] = True
            painting['favorite_id'] = favorite['id']
            painting['tags'] = favorite.get('tags', [])

    return jsonify(painting)


@app.route('/api/painting-of-the-day')
@require_auth
def api_painting_of_the_day():
    """Get a random painting from user's favorites."""
    painting = db.get_random_favorite(g.user['id'])
    if not painting:
        return jsonify({"message": "No favorites yet. Start exploring and save some paintings!"}), 200
    return jsonify(painting)


# Favorites API
@app.route('/api/favorites', methods=['GET'])
@require_auth
def api_get_favorites():
    """Get all favorites with optional filters."""
    filters = {}
    if request.args.get('artist'):
        filters['artist'] = request.args.get('artist')
    if request.args.get('museum'):
        filters['museum'] = request.args.get('museum')
    if request.args.get('tag'):
        filters['tag'] = request.args.get('tag')

    favorites = db.get_all_favorites(g.user['id'], filters if filters else None)
    return jsonify({"favorites": favorites})


@app.route('/api/favorites', methods=['POST'])
@require_auth
def api_add_favorite():
    """Add a painting to favorites."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    favorite_id = db.add_favorite(data, g.user['id'])
    if favorite_id:
        return jsonify({"id": favorite_id, "message": "Added to favorites"})
    return jsonify({"error": "Failed to add favorite"}), 500


@app.route('/api/favorites/<favorite_id>', methods=['DELETE'])
@require_auth
def api_remove_favorite(favorite_id):
    """Remove a painting from favorites."""
    if db.remove_favorite(favorite_id, g.user['id']):
        return jsonify({"message": "Removed from favorites"})
    return jsonify({"error": "Favorite not found"}), 404


@app.route('/api/favorites/<favorite_id>')
@require_auth
def api_get_favorite(favorite_id):
    """Get a single favorite with its journal entries."""
    favorite = db.get_favorite(favorite_id, g.user['id'])
    if not favorite:
        return jsonify({"error": "Favorite not found"}), 404

    return jsonify(favorite)


# Tags API
@app.route('/api/tags')
@require_auth
def api_get_tags():
    """Get all tags for the current user."""
    tags = db.get_all_tags(g.user['id'])
    return jsonify({"tags": tags})


@app.route('/api/favorites/<favorite_id>/tags', methods=['POST'])
@require_auth
def api_add_tag(favorite_id):
    """Add a tag to a favorite."""
    data = request.get_json()
    if not data or not data.get('tag'):
        return jsonify({"error": "Tag name is required"}), 400

    if db.add_tag_to_favorite(favorite_id, data['tag'], g.user['id']):
        return jsonify({"message": "Tag added"})
    return jsonify({"message": "Tag already exists"})


@app.route('/api/favorites/<favorite_id>/tags/<tag_name>', methods=['DELETE'])
@require_auth
def api_remove_tag(favorite_id, tag_name):
    """Remove a tag from a favorite."""
    if db.remove_tag_from_favorite(favorite_id, tag_name, g.user['id']):
        return jsonify({"message": "Tag removed"})
    return jsonify({"error": "Tag not found"}), 404


# Journal API
@app.route('/api/favorites/<favorite_id>/journal', methods=['GET'])
@require_auth
def api_get_journal_entries(favorite_id):
    """Get all journal entries for a favorite."""
    entries = db.get_journal_entries(favorite_id, g.user['id'])
    return jsonify({"entries": entries})


@app.route('/api/favorites/<favorite_id>/journal', methods=['POST'])
@require_auth
def api_add_journal_entry(favorite_id):
    """Add a journal entry for a favorite."""
    data = request.get_json()
    if not data or not data.get('entry_text'):
        return jsonify({"error": "Entry text is required"}), 400

    entry_id = db.add_journal_entry(favorite_id, data['entry_text'], g.user['id'])
    if entry_id:
        return jsonify({"id": entry_id, "message": "Journal entry added"})
    return jsonify({"error": "Failed to add journal entry"}), 500


@app.route('/api/journal/<entry_id>', methods=['PUT'])
@require_auth
def api_update_journal_entry(entry_id):
    """Update a journal entry."""
    data = request.get_json()
    if not data or not data.get('entry_text'):
        return jsonify({"error": "Entry text is required"}), 400

    if db.update_journal_entry(entry_id, data['entry_text'], g.user['id']):
        return jsonify({"message": "Journal entry updated"})
    return jsonify({"error": "Journal entry not found"}), 404


@app.route('/api/journal/<entry_id>', methods=['DELETE'])
@require_auth
def api_delete_journal_entry(entry_id):
    """Delete a journal entry."""
    if db.delete_journal_entry(entry_id, g.user['id']):
        return jsonify({"message": "Journal entry deleted"})
    return jsonify({"error": "Journal entry not found"}), 404


def open_browser():
    """Open browser after a short delay."""
    webbrowser.open('http://127.0.0.1:5001')


if __name__ == '__main__':
    # Open browser after 1.5 seconds
    threading.Timer(1.5, open_browser).start()
    print("\n  Art Stuff")
    print("  Starting server at http://127.0.0.1:5001")
    print("  Press Ctrl+C to stop\n")
    app.run(debug=False, port=5001)
