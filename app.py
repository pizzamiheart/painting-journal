"""
Painting Journal - A personal art exploration and journaling app.
"""
import webbrowser
import threading
from flask import Flask, render_template, request, jsonify

import database as db
import museum_apis as api

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Initialize database on startup
db.init_db()


# Page routes
@app.route('/')
def home():
    """Home page with painting of the day."""
    return render_template('index.html')


@app.route('/search')
def search_page():
    """Search page."""
    return render_template('search.html')


@app.route('/collection')
def collection_page():
    """Collection page."""
    return render_template('collection.html')


@app.route('/painting/<museum>/<external_id>')
def painting_page(museum, external_id):
    """Single painting detail page."""
    return render_template('painting.html', museum=museum, external_id=external_id)


# API routes
@app.route('/api/search')
def api_search():
    """Search for paintings across museums."""
    query = request.args.get('q', '')
    museum = request.args.get('museum', None)
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))

    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    results = api.search_all(query, museum, page, limit)

    # Add spelling suggestion if few/no results found
    if results.get('total', 0) < 3:
        suggestion = api.suggest_spelling(query)
        if suggestion:
            results['suggestion'] = suggestion

    return jsonify(results)


@app.route('/api/painting/<museum>/<external_id>')
def api_get_painting(museum, external_id):
    """Get a single painting's details."""
    painting = api.get_painting(museum, external_id)
    if not painting:
        return jsonify({"error": "Painting not found"}), 404

    # Check if it's a favorite
    favorite = db.get_favorite_by_external_id(external_id, museum)
    painting['is_favorite'] = favorite is not None
    painting['favorite_id'] = favorite['id'] if favorite else None

    if favorite:
        painting['tags'] = []
        cursor_fav = db.get_favorite(favorite['id'])
        if cursor_fav:
            favorites_with_tags = db.get_all_favorites()
            for f in favorites_with_tags:
                if f['id'] == favorite['id']:
                    painting['tags'] = f.get('tags', [])
                    break

    return jsonify(painting)


@app.route('/api/painting-of-the-day')
def api_painting_of_the_day():
    """Get a random painting from favorites."""
    painting = db.get_random_favorite()
    if not painting:
        return jsonify({"message": "No favorites yet. Start exploring and save some paintings!"}), 200
    return jsonify(painting)


# Favorites API
@app.route('/api/favorites', methods=['GET'])
def api_get_favorites():
    """Get all favorites with optional filters."""
    filters = {}
    if request.args.get('artist'):
        filters['artist'] = request.args.get('artist')
    if request.args.get('museum'):
        filters['museum'] = request.args.get('museum')
    if request.args.get('tag'):
        filters['tag'] = request.args.get('tag')

    favorites = db.get_all_favorites(filters if filters else None)
    return jsonify({"favorites": favorites})


@app.route('/api/favorites', methods=['POST'])
def api_add_favorite():
    """Add a painting to favorites."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    favorite_id = db.add_favorite(data)
    if favorite_id:
        return jsonify({"id": favorite_id, "message": "Added to favorites"})
    return jsonify({"error": "Failed to add favorite"}), 500


@app.route('/api/favorites/<int:favorite_id>', methods=['DELETE'])
def api_remove_favorite(favorite_id):
    """Remove a painting from favorites."""
    if db.remove_favorite(favorite_id):
        return jsonify({"message": "Removed from favorites"})
    return jsonify({"error": "Favorite not found"}), 404


@app.route('/api/favorites/<int:favorite_id>')
def api_get_favorite(favorite_id):
    """Get a single favorite with its journal entries."""
    favorite = db.get_favorite(favorite_id)
    if not favorite:
        return jsonify({"error": "Favorite not found"}), 404

    # Get tags
    favorites_with_tags = db.get_all_favorites()
    for f in favorites_with_tags:
        if f['id'] == favorite_id:
            favorite['tags'] = f.get('tags', [])
            break

    # Get journal entries
    favorite['journal_entries'] = db.get_journal_entries(favorite_id)

    return jsonify(favorite)


# Tags API
@app.route('/api/tags')
def api_get_tags():
    """Get all tags."""
    tags = db.get_all_tags()
    return jsonify({"tags": tags})


@app.route('/api/favorites/<int:favorite_id>/tags', methods=['POST'])
def api_add_tag(favorite_id):
    """Add a tag to a favorite."""
    data = request.get_json()
    if not data or not data.get('tag'):
        return jsonify({"error": "Tag name is required"}), 400

    if db.add_tag_to_favorite(favorite_id, data['tag']):
        return jsonify({"message": "Tag added"})
    return jsonify({"message": "Tag already exists"})


@app.route('/api/favorites/<int:favorite_id>/tags/<tag_name>', methods=['DELETE'])
def api_remove_tag(favorite_id, tag_name):
    """Remove a tag from a favorite."""
    if db.remove_tag_from_favorite(favorite_id, tag_name):
        return jsonify({"message": "Tag removed"})
    return jsonify({"error": "Tag not found"}), 404


# Journal API
@app.route('/api/favorites/<int:favorite_id>/journal', methods=['GET'])
def api_get_journal_entries(favorite_id):
    """Get all journal entries for a favorite."""
    entries = db.get_journal_entries(favorite_id)
    return jsonify({"entries": entries})


@app.route('/api/favorites/<int:favorite_id>/journal', methods=['POST'])
def api_add_journal_entry(favorite_id):
    """Add a journal entry for a favorite."""
    data = request.get_json()
    if not data or not data.get('entry_text'):
        return jsonify({"error": "Entry text is required"}), 400

    entry_id = db.add_journal_entry(favorite_id, data['entry_text'])
    if entry_id:
        return jsonify({"id": entry_id, "message": "Journal entry added"})
    return jsonify({"error": "Failed to add journal entry"}), 500


@app.route('/api/journal/<int:entry_id>', methods=['PUT'])
def api_update_journal_entry(entry_id):
    """Update a journal entry."""
    data = request.get_json()
    if not data or not data.get('entry_text'):
        return jsonify({"error": "Entry text is required"}), 400

    if db.update_journal_entry(entry_id, data['entry_text']):
        return jsonify({"message": "Journal entry updated"})
    return jsonify({"error": "Journal entry not found"}), 404


@app.route('/api/journal/<int:entry_id>', methods=['DELETE'])
def api_delete_journal_entry(entry_id):
    """Delete a journal entry."""
    if db.delete_journal_entry(entry_id):
        return jsonify({"message": "Journal entry deleted"})
    return jsonify({"error": "Journal entry not found"}), 404


def open_browser():
    """Open browser after a short delay."""
    webbrowser.open('http://127.0.0.1:5000')


if __name__ == '__main__':
    # Open browser after 1.5 seconds
    threading.Timer(1.5, open_browser).start()
    print("\n  Painting Journal")
    print("  Starting server at http://127.0.0.1:5000")
    print("  Press Ctrl+C to stop\n")
    app.run(debug=False, port=5000)
