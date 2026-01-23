"""
Art categories for discovery-based exploration.
Defines eras, themes, moods, and methods to fetch paintings by category.
"""
import random
import re
import supabase_db as db


def extract_year(date_string):
    """
    Extract a representative year from various date formats.
    Returns None if no year can be extracted.

    Examples:
    - "1503" -> 1503
    - "c. 1665" -> 1665
    - "1889-1890" -> 1889
    - "ca. 1510-1515" -> 1510
    - "19th century" -> 1850
    - "early 16th century" -> 1510
    - "late 19th century" -> 1880
    """
    if not date_string:
        return None

    date_string = str(date_string).lower().strip()

    # Try to find a 4-digit year
    year_match = re.search(r'\b(\d{4})\b', date_string)
    if year_match:
        return int(year_match.group(1))

    # Handle century notation (e.g., "19th century")
    century_match = re.search(r'(\d{1,2})(?:st|nd|rd|th)\s*century', date_string)
    if century_match:
        century = int(century_match.group(1))
        # Base year is (century - 1) * 100
        base_year = (century - 1) * 100

        if 'early' in date_string:
            return base_year + 10
        elif 'late' in date_string:
            return base_year + 80
        elif 'mid' in date_string:
            return base_year + 50
        else:
            return base_year + 50  # Default to mid-century

    return None


def is_in_era(date_string, era_years):
    """
    Check if a date falls within an era's date range.
    era_years format: "1400-1600"
    """
    year = extract_year(date_string)
    if year is None:
        return False

    # Parse era date range
    match = re.match(r'(\d{4})-(\d{4})', era_years)
    if not match:
        return True  # If no valid range, don't filter

    start_year = int(match.group(1))
    end_year = int(match.group(2))

    # Allow some flexibility (+/- 20 years) for artistic overlap
    return (start_year - 20) <= year <= (end_year + 20)

# Art historical eras with key artists and search terms
ERAS = {
    "renaissance": {
        "name": "Renaissance",
        "years": "1400-1600",
        "description": "Rebirth of classical ideals. Perspective, humanism, and mastery of form.",
        "artists": ["Leonardo da Vinci", "Michelangelo", "Raphael", "Botticelli", "Titian", "Jan van Eyck", "Dürer"],
        "search_terms": ["renaissance", "Leonardo", "Michelangelo", "Raphael", "Botticelli"],
        "wall_color": "#4A3728"
    },
    "baroque": {
        "name": "Baroque",
        "years": "1600-1750",
        "description": "Drama, grandeur, and emotional intensity. Rich colors and bold contrasts.",
        "artists": ["Caravaggio", "Rembrandt", "Vermeer", "Rubens", "Velázquez"],
        "search_terms": ["baroque", "Rembrandt", "Vermeer", "Caravaggio", "Rubens"],
        "wall_color": "#8B2332"
    },
    "rococo": {
        "name": "Rococo",
        "years": "1720-1780",
        "description": "Elegance, lightness, and playful themes. Soft colors and ornate detail.",
        "artists": ["Watteau", "Fragonard", "Boucher", "Tiepolo"],
        "search_terms": ["rococo", "Watteau", "Fragonard", "Boucher"],
        "wall_color": "#D4C5B9"
    },
    "romanticism": {
        "name": "Romanticism",
        "years": "1780-1850",
        "description": "Emotion, nature, and the sublime. Dramatic landscapes and heroic subjects.",
        "artists": ["Turner", "Delacroix", "Goya", "Constable", "Friedrich"],
        "search_terms": ["romantic", "Turner", "Delacroix", "Goya", "Constable"],
        "wall_color": "#2D4739"
    },
    "impressionism": {
        "name": "Impressionism",
        "years": "1860-1890",
        "description": "Light, color, and the fleeting moment. Visible brushstrokes and everyday scenes.",
        "artists": ["Monet", "Renoir", "Degas", "Pissarro", "Morisot", "Cassatt", "Sisley"],
        "search_terms": ["impressionist", "Monet", "Renoir", "Degas", "Pissarro"],
        "wall_color": "#E8E4DF"
    },
    "post-impressionism": {
        "name": "Post-Impressionism",
        "years": "1886-1910",
        "description": "Beyond Impressionism. Bold colors, symbolic content, and emotional expression.",
        "artists": ["Van Gogh", "Gauguin", "Seurat", "Toulouse-Lautrec", "Edvard Munch"],
        "search_terms": ["Van Gogh", "Gauguin", "Seurat", "post-impressionist"],
        "wall_color": "#F5E6D3"
    },
    "modern": {
        "name": "Modern",
        "years": "1900-1970",
        "description": "Breaking traditions. Abstraction, expression, and new ways of seeing.",
        "artists": ["Matisse", "Kandinsky", "Mondrian", "Klimt", "Edvard Munch"],
        "search_terms": ["modern art", "Matisse", "Kandinsky", "Klimt", "abstract"],
        "wall_color": "#FFFFFF"
    },
    "dutch-golden-age": {
        "name": "Dutch Golden Age",
        "years": "1600-1700",
        "description": "Mastery of light and domestic scenes. Portraits, still lifes, and landscapes.",
        "artists": ["Rembrandt", "Vermeer", "Hals", "Steen", "Ruisdael", "de Hooch"],
        "search_terms": ["dutch golden age", "Vermeer", "Rembrandt", "Hals"],
        "wall_color": "#3D3D3D"
    }
}

# Themes with search terms
THEMES = {
    "landscapes": {
        "name": "Landscapes",
        "description": "Mountains, seas, fields, and skies. Nature in all its forms.",
        "search_terms": ["landscape", "seascape", "countryside", "mountains"],
        "icon": "🏔️"
    },
    "portraits": {
        "name": "Portraits",
        "description": "The human face and figure. Identity, status, and inner life.",
        "search_terms": ["portrait", "self-portrait", "figure"],
        "icon": "👤"
    },
    "still-life": {
        "name": "Still Life",
        "description": "Objects arranged with care. Flowers, fruit, and everyday things.",
        "search_terms": ["still life", "flowers", "fruit", "vanitas"],
        "icon": "🍎"
    },
    "religious": {
        "name": "Religious",
        "description": "Sacred stories and divine figures. Faith made visible.",
        "search_terms": ["madonna", "crucifixion", "saints", "biblical"],
        "icon": "✝️"
    },
    "mythology": {
        "name": "Mythology",
        "description": "Gods, heroes, and ancient tales. Classical stories reimagined.",
        "search_terms": ["mythology", "Venus", "Apollo", "Greek", "Roman myth"],
        "icon": "🏛️"
    },
    "daily-life": {
        "name": "Daily Life",
        "description": "Ordinary moments. People at work, at play, at home.",
        "search_terms": ["genre scene", "domestic", "peasant", "interior"],
        "icon": "🏠"
    },
    "historical": {
        "name": "Historical",
        "description": "Great events and turning points. History on canvas.",
        "search_terms": ["battle", "historical", "coronation", "revolution"],
        "icon": "⚔️"
    },
    "marine": {
        "name": "Marine & Ships",
        "description": "The sea, ships, and maritime life.",
        "search_terms": ["marine", "ship", "sea", "naval", "harbor"],
        "icon": "⛵"
    }
}

# Moods - these use curated artist/keyword combinations
MOODS = {
    "peaceful": {
        "name": "Peaceful",
        "description": "Calm, serene, and contemplative.",
        "search_terms": ["pastoral", "garden", "quiet", "serene"],
        "artists": ["Monet", "Vermeer", "Corot", "Constable"]
    },
    "dramatic": {
        "name": "Dramatic",
        "description": "Intense, powerful, and emotionally charged.",
        "search_terms": ["storm", "dramatic", "battle"],
        "artists": ["Caravaggio", "Delacroix", "Turner", "Goya"]
    },
    "joyful": {
        "name": "Joyful",
        "description": "Happy, celebratory, and full of life.",
        "search_terms": ["dance", "celebration", "festival", "party"],
        "artists": ["Renoir", "Fragonard", "Watteau"]
    },
    "melancholic": {
        "name": "Melancholic",
        "description": "Thoughtful, sad, or wistful.",
        "search_terms": ["solitude", "winter", "twilight"],
        "artists": ["Hopper", "Friedrich", "Munch"]
    },
    "mysterious": {
        "name": "Mysterious",
        "description": "Enigmatic, dreamlike, and intriguing.",
        "search_terms": ["night", "dream", "mystery", "symbolic"],
        "artists": ["Bosch", "Redon", "de Chirico", "Magritte"]
    }
}


def get_random_artist():
    """Get a random notable artist for 'Surprise Me' feature."""
    all_artists = []
    for era in ERAS.values():
        all_artists.extend(era["artists"])
    return random.choice(list(set(all_artists)))


def get_featured_artist():
    """Get a featured artist with their info."""
    # Rotate through notable artists
    featured = [
        {"name": "Vermeer", "full_name": "Johannes Vermeer", "era": "dutch-golden-age",
         "bio": "Master of light and domestic scenes. Only ~35 paintings survive."},
        {"name": "Monet", "full_name": "Claude Monet", "era": "impressionism",
         "bio": "Father of Impressionism. Obsessed with capturing light and atmosphere."},
        {"name": "Rembrandt", "full_name": "Rembrandt van Rijn", "era": "baroque",
         "bio": "Master of shadow and human emotion. Greatest portrait painter of his age."},
        {"name": "Van Gogh", "full_name": "Vincent van Gogh", "era": "post-impressionism",
         "bio": "Bold colors, emotional intensity. Sold one painting in his lifetime."},
        {"name": "Caravaggio", "full_name": "Michelangelo Merisi da Caravaggio", "era": "baroque",
         "bio": "Revolutionary use of light and shadow. Violent life, profound art."},
    ]
    # Simple rotation based on day
    from datetime import date
    idx = date.today().toordinal() % len(featured)
    return featured[idx]


def fetch_by_category(category_type, category_key, page=1, limit=12):
    """
    Fetch paintings for a category from Supabase.
    category_type: 'era', 'theme', or 'mood'
    """
    if category_type == "era":
        category = ERAS.get(category_key)
    elif category_type == "theme":
        category = THEMES.get(category_key)
    elif category_type == "mood":
        category = MOODS.get(category_key)
    else:
        return {"paintings": [], "total": 0, "category": None}

    if not category:
        return {"paintings": [], "total": 0, "category": None}

    search_terms = category.get("search_terms", [])
    artists = category.get("artists", [])

    # Combine search terms and artists for queries
    queries = artists + search_terms

    all_paintings = []

    # Search Supabase for each query with higher limits to get more results
    for query in queries:
        result = db.search_paintings(query, page=1, limit=200)
        all_paintings.extend(result.get("paintings", []))

    # Remove duplicates by external_id
    seen = set()
    unique = []
    for p in all_paintings:
        key = f"{p['museum']}:{p['external_id']}"
        if key not in seen:
            seen.add(key)
            unique.append(p)

    # For eras, filter by date to ensure paintings are from the correct time period
    if category_type == "era" and category.get("years"):
        era_years = category["years"]
        filtered = [p for p in unique if is_in_era(p.get("date_display", ""), era_years)]
        unique = filtered if filtered else unique  # Fall back to unfiltered if nothing matches

    # Use a seeded shuffle for consistent ordering across pagination
    # Seed based on category key so same category always shows same order
    import hashlib
    seed = int(hashlib.md5(category_key.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    rng.shuffle(unique)

    # Pagination
    start = (page - 1) * limit
    end = start + limit

    return {
        "paintings": unique[start:end],
        "total": len(unique),
        "category": category
    }


def fetch_surprise():
    """Fetch a random painting for 'Surprise Me' feature."""
    painting = db.get_random_painting()
    return painting


def fetch_artist_works(artist_name, limit=24):
    """Fetch works by a specific artist from Supabase."""
    result = db.search_paintings(artist_name, page=1, limit=100)
    paintings = result.get("paintings", [])

    # Filter to only include paintings where artist name matches
    artist_lower = artist_name.lower()
    filtered = [
        p for p in paintings
        if p.get("artist") and artist_lower in p.get("artist", "").lower()
    ]

    return filtered[:limit]


def get_weekly_spotlight():
    """Get the weekly movement/era spotlight."""
    # Rotate through eras weekly
    from datetime import date
    era_keys = list(ERAS.keys())
    idx = (date.today().toordinal() // 7) % len(era_keys)
    era_key = era_keys[idx]
    era = ERAS[era_key]
    return {"key": era_key, **era}


def resize_image_url(url, width=400):
    """Resize IIIF image URLs to a smaller size for carousel thumbnails.
    This prevents 403 errors from museums blocking large image requests
    and speeds up loading significantly."""
    if not url:
        return url
    # Art Institute of Chicago IIIF pattern: /full/{width},/0/default.jpg
    if 'artic.edu/iiif' in url:
        import re
        return re.sub(r'/full/\d+,/', f'/full/{width},/', url)
    # Rijksmuseum: already uses reasonable sizes
    # Cleveland: direct URLs, no resize needed
    return url


def get_representative_paintings():
    """Get one representative painting with image for each era and theme."""
    from datetime import date
    representatives = {"eras": {}, "themes": {}, "featured_artist": None}

    # For each era, search for the first artist and get one painting with an image
    for key, era in ERAS.items():
        artists = era.get("artists", [])
        for artist in artists[:3]:  # Try up to 3 artists
            result = db.search_paintings(artist, page=1, limit=10)
            paintings = result.get("paintings", [])
            # Find one with an image URL
            for p in paintings:
                if p.get("image_url"):
                    representatives["eras"][key] = {
                        "image_url": resize_image_url(p["image_url"]),
                        "title": p.get("title", ""),
                        "artist": p.get("artist", ""),
                        "museum": p.get("museum", ""),
                        "external_id": p.get("external_id", "")
                    }
                    break
            if key in representatives["eras"]:
                break

    # For each theme, search using the first search term
    for key, theme in THEMES.items():
        terms = theme.get("search_terms", [])
        for term in terms[:2]:  # Try up to 2 terms
            result = db.search_paintings(term, page=1, limit=10)
            paintings = result.get("paintings", [])
            for p in paintings:
                if p.get("image_url"):
                    representatives["themes"][key] = {
                        "image_url": resize_image_url(p["image_url"]),
                        "title": p.get("title", ""),
                        "artist": p.get("artist", ""),
                        "museum": p.get("museum", ""),
                        "external_id": p.get("external_id", "")
                    }
                    break
            if key in representatives["themes"]:
                break

    # Get a painting for the featured artist
    featured = get_featured_artist()
    if featured:
        result = db.search_paintings(featured["name"], page=1, limit=10)
        paintings = result.get("paintings", [])
        for p in paintings:
            if p.get("image_url"):
                representatives["featured_artist"] = {
                    "image_url": resize_image_url(p["image_url"]),
                    "title": p.get("title", ""),
                    "artist": p.get("artist", ""),
                    "museum": p.get("museum", ""),
                    "external_id": p.get("external_id", "")
                }
                break

    return representatives
