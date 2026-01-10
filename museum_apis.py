"""
Museum API integrations for the painting journal.
Supports Art Institute of Chicago, Cleveland Museum of Art, Metropolitan Museum of Art, and Rijksmuseum.
"""
import re
import requests
import hashlib
from database import get_cached_response, set_cached_response


def _strip_html(text):
    """Remove HTML tags from text."""
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', '', text)
    clean = clean.replace('&nbsp;', ' ').replace('&amp;', '&')
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

# API configuration
AIC_BASE_URL = "https://api.artic.edu/api/v1"
RIJKS_OAI_URL = "https://data.rijksmuseum.nl/oai"  # OAI-PMH API - no key required
MET_BASE_URL = "https://collectionapi.metmuseum.org/public/collection/v1"
CLEVELAND_BASE_URL = "https://openaccess-api.clevelandart.org/api"

REQUEST_TIMEOUT = 30  # Longer timeout for OAI-PMH

# Cache for Rijksmuseum paintings (loaded on first search)
_rijks_paintings_cache = None

# Common artist names for spell-check suggestions
KNOWN_ARTISTS = [
    "Rembrandt", "Rembrandt van Rijn", "Vermeer", "Johannes Vermeer",
    "Van Gogh", "Vincent van Gogh", "Monet", "Claude Monet",
    "Picasso", "Pablo Picasso", "Renoir", "Pierre-Auguste Renoir",
    "Cézanne", "Paul Cézanne", "Degas", "Edgar Degas",
    "Manet", "Édouard Manet", "Matisse", "Henri Matisse",
    "Kandinsky", "Wassily Kandinsky", "Klimt", "Gustav Klimt",
    "Michelangelo", "Leonardo da Vinci", "Raphael", "Caravaggio",
    "Titian", "Botticelli", "Dürer", "Albrecht Dürer",
    "Rubens", "Peter Paul Rubens", "Velázquez", "Diego Velázquez",
    "El Greco", "Goya", "Francisco Goya", "Turner", "J.M.W. Turner",
    "Constable", "John Constable", "Gainsborough", "Thomas Gainsborough",
    "Hopper", "Edward Hopper", "Whistler", "James McNeill Whistler",
    "Sargent", "John Singer Sargent", "Homer", "Winslow Homer",
    "Cassatt", "Mary Cassatt", "Seurat", "Georges Seurat",
    "Toulouse-Lautrec", "Henri de Toulouse-Lautrec",
    "Canaletto", "Tiepolo", "Bellini", "Giovanni Bellini",
    "Tintoretto", "Veronese", "Hals", "Frans Hals",
    "Steen", "Jan Steen", "Ruisdael", "Jacob van Ruisdael",
    "Hobbema", "Meindert Hobbema", "Avercamp", "Hendrick Avercamp",
    "Ter Borch", "Gerard ter Borch", "De Hooch", "Pieter de Hooch",
    "Bruegel", "Pieter Bruegel", "Bosch", "Hieronymus Bosch",
    "Van Eyck", "Jan van Eyck", "Memling", "Hans Memling",
    "Holbein", "Hans Holbein", "Cranach", "Lucas Cranach",
    "Poussin", "Nicolas Poussin", "Lorrain", "Claude Lorrain",
    "Watteau", "Antoine Watteau", "Fragonard", "Jean-Honoré Fragonard",
    "David", "Jacques-Louis David", "Ingres", "Jean-Auguste-Dominique Ingres",
    "Delacroix", "Eugène Delacroix", "Courbet", "Gustave Courbet",
    "Millet", "Jean-François Millet", "Corot", "Jean-Baptiste-Camille Corot",
    "Sisley", "Alfred Sisley", "Pissarro", "Camille Pissarro",
    "Caillebotte", "Gustave Caillebotte", "Morisot", "Berthe Morisot",
    "Gauguin", "Paul Gauguin", "Van Dyck", "Anthony van Dyck",
    "Toorop", "Jan Toorop", "Mondrian", "Piet Mondrian",
]


def _levenshtein_distance(s1, s2):
    """Calculate the Levenshtein distance between two strings."""
    s1, s2 = s1.lower(), s2.lower()
    if len(s1) < len(s2):
        s1, s2 = s2, s1

    if len(s2) == 0:
        return len(s1)

    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


def suggest_spelling(query):
    """Suggest a spelling correction for the query based on known artist names."""
    query_lower = query.lower().strip()

    # Don't suggest for very short queries
    if len(query_lower) < 3:
        return None

    best_match = None
    best_distance = float('inf')

    for artist in KNOWN_ARTISTS:
        artist_lower = artist.lower()

        # Check each word in multi-word artist names
        artist_words = artist_lower.split()
        for word in artist_words:
            if len(word) < 3:
                continue

            distance = _levenshtein_distance(query_lower, word)

            # Also check against full name
            full_distance = _levenshtein_distance(query_lower, artist_lower)

            min_distance = min(distance, full_distance)

            # Threshold: allow up to 2 character differences for short words,
            # or roughly 30% of word length for longer words
            threshold = max(2, len(query_lower) // 3)

            if min_distance <= threshold and min_distance < best_distance and min_distance > 0:
                best_distance = min_distance
                best_match = artist

    return best_match


def _cache_key(prefix, params):
    """Generate a cache key for API requests."""
    param_str = str(sorted(params.items()))
    return f"{prefix}:{hashlib.md5(param_str.encode()).hexdigest()}"


def _make_request(url, params=None, cache_prefix=None):
    """Make an API request with optional caching."""
    if cache_prefix and params:
        key = _cache_key(cache_prefix, params)
        cached = get_cached_response(key)
        if cached:
            return cached

    try:
        response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()

        if cache_prefix and params:
            set_cached_response(key, data)

        return data
    except requests.RequestException as e:
        print(f"API request failed: {e}")
        return None


# Art Institute of Chicago API
def aic_search(query, page=1, limit=20):
    """Search Art Institute of Chicago collection."""
    params = {
        "q": query,
        "query[term][is_public_domain]": "true",
        "fields": "id,title,artist_title,date_display,medium_display,dimensions,thumbnail,image_id,artwork_type_title,style_title,description",
        "page": page,
        "limit": limit
    }

    data = _make_request(
        f"{AIC_BASE_URL}/artworks/search",
        params,
        cache_prefix="aic_search"
    )

    if not data:
        return {"paintings": [], "total": 0, "page": page}

    paintings = []
    iiif_url = data.get("config", {}).get("iiif_url", "https://www.artic.edu/iiif/2")

    for item in data.get("data", []):
        if item.get("image_id"):
            paintings.append(_format_aic_painting(item, iiif_url))

    return {
        "paintings": paintings,
        "total": data.get("pagination", {}).get("total", 0),
        "page": page
    }


def aic_get_painting(artwork_id):
    """Get a single painting from Art Institute of Chicago."""
    data = _make_request(
        f"{AIC_BASE_URL}/artworks/{artwork_id}",
        {"fields": "id,title,artist_title,date_display,medium_display,dimensions,thumbnail,image_id,artwork_type_title,style_title,description,provenance_text,publication_history,exhibition_history"},
        cache_prefix="aic_artwork"
    )

    if not data or "data" not in data:
        return None

    item = data["data"]
    iiif_url = data.get("config", {}).get("iiif_url", "https://www.artic.edu/iiif/2")
    return _format_aic_painting(item, iiif_url)


def _format_aic_painting(item, iiif_url):
    """Format Art Institute of Chicago painting data."""
    image_id = item.get("image_id")

    # Build rich description from available fields
    description = _strip_html(item.get("description", ""))

    # If no description, try to build one from other fields
    if not description:
        parts = []
        if item.get("style_title"):
            parts.append(f"Style: {item.get('style_title')}.")
        if item.get("artwork_type_title"):
            parts.append(f"Type: {item.get('artwork_type_title')}.")
        description = " ".join(parts)

    return {
        "external_id": str(item.get("id")),
        "museum": "aic",
        "museum_name": "Art Institute of Chicago",
        "title": item.get("title", "Untitled"),
        "artist": item.get("artist_title", "Unknown Artist"),
        "date_display": item.get("date_display", ""),
        "medium": item.get("medium_display", ""),
        "dimensions": item.get("dimensions", ""),
        "description": description,
        "style": item.get("style_title", ""),
        "artwork_type": item.get("artwork_type_title", ""),
        "image_url": f"{iiif_url}/{image_id}/full/1686,/0/default.jpg" if image_id else None,
        "thumbnail_url": f"{iiif_url}/{image_id}/full/400,/0/default.jpg" if image_id else None,
        "museum_url": f"https://www.artic.edu/artworks/{item.get('id')}",
        "metadata": {
            "provenance": _strip_html(item.get("provenance_text", "")),
            "publications": _strip_html(item.get("publication_history", "")),
            "exhibitions": _strip_html(item.get("exhibition_history", ""))
        }
    }


# Rijksmuseum API (OAI-PMH - no API key required)
import xml.etree.ElementTree as ET

# XML namespaces for OAI-PMH EDM format
NAMESPACES = {
    'oai': 'http://www.openarchives.org/OAI/2.0/',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'dcterms': 'http://purl.org/dc/terms/',
    'edm': 'http://www.europeana.eu/schemas/edm/',
    'ore': 'http://www.openarchives.org/ore/terms/',
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'skos': 'http://www.w3.org/2004/02/skos/core#',
}


def _load_rijks_paintings():
    """Load Rijksmuseum paintings from OAI-PMH API (cached in memory)."""
    global _rijks_paintings_cache

    if _rijks_paintings_cache is not None:
        return _rijks_paintings_cache

    print("Loading Rijksmuseum paintings from OAI-PMH (first search may take a moment)...")
    paintings = []

    # Fetch from set 261208 (schilderijen/paintings)
    resumption_token = None
    max_pages = 50  # More pages to get better coverage of paintings

    for page in range(max_pages):
        try:
            if resumption_token:
                url = f"{RIJKS_OAI_URL}?verb=ListRecords&resumptionToken={resumption_token}"
            else:
                url = f"{RIJKS_OAI_URL}?verb=ListRecords&metadataPrefix=edm&set=261208"

            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()

            root = ET.fromstring(response.content)

            # Parse records
            for record in root.findall('.//oai:record', NAMESPACES):
                painting = _parse_rijks_oai_record(record)
                if painting and painting.get('image_url'):
                    paintings.append(painting)

            # Check for resumption token
            token_elem = root.find('.//oai:resumptionToken', NAMESPACES)
            if token_elem is not None and token_elem.text:
                resumption_token = token_elem.text
            else:
                break  # No more pages

        except Exception as e:
            print(f"Error loading Rijksmuseum data: {e}")
            break

    print(f"Loaded {len(paintings)} Rijksmuseum paintings")
    _rijks_paintings_cache = paintings
    return paintings


def _parse_rijks_oai_record(record):
    """Parse a single OAI-PMH record into painting data."""
    try:
        header = record.find('oai:header', NAMESPACES)
        metadata = record.find('oai:metadata', NAMESPACES)

        if header is None or metadata is None:
            return None

        # Get identifier
        identifier = header.findtext('oai:identifier', '', NAMESPACES)
        external_id = identifier.split('/')[-1] if identifier else ""

        # Find the ProvidedCHO element
        cho = metadata.find('.//edm:ProvidedCHO', NAMESPACES)
        if cho is None:
            return None

        # Get title (prefer English)
        title = ""
        for title_elem in cho.findall('dc:title', NAMESPACES):
            lang = title_elem.get('{http://www.w3.org/XML/1998/namespace}lang', '')
            if lang == 'en' or not title:
                title = title_elem.text or ""

        # Get description (prefer English)
        description = ""
        for desc_elem in cho.findall('dc:description', NAMESPACES):
            lang = desc_elem.get('{http://www.w3.org/XML/1998/namespace}lang', '')
            if lang == 'en' or not description:
                description = desc_elem.text or ""

        # Get date
        date_display = ""
        for date_elem in cho.findall('dcterms:created', NAMESPACES):
            lang = date_elem.get('{http://www.w3.org/XML/1998/namespace}lang', '')
            if lang == 'en' or not date_display:
                date_display = date_elem.text or ""

        # Get object number (dc:identifier)
        object_number = cho.findtext('dc:identifier', '', NAMESPACES)

        # Get dimensions
        dimensions_parts = []
        for extent in cho.findall('dcterms:extent', NAMESPACES):
            lang = extent.get('{http://www.w3.org/XML/1998/namespace}lang', '')
            if lang == 'en' and extent.text:
                dimensions_parts.append(extent.text)
        dimensions = "; ".join(dimensions_parts[:2])  # Limit to first 2

        # Get image URL from aggregation
        agg = metadata.find('.//ore:Aggregation', NAMESPACES)
        image_url = ""
        if agg is not None:
            # Try edm:object first (simpler, more reliable)
            obj_elem = agg.find('edm:object', NAMESPACES)
            if obj_elem is not None:
                image_url = obj_elem.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}resource', '')

            # Fallback to edm:isShownBy > edm:WebResource
            if not image_url:
                shown_by = agg.find('edm:isShownBy', NAMESPACES)
                if shown_by is not None:
                    web_resource = shown_by.find('edm:WebResource', NAMESPACES)
                    if web_resource is not None:
                        image_url = web_resource.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about', '')

        # Get artist from creator reference or look up
        artist = "Unknown Artist"
        creator_elem = cho.find('dc:creator', NAMESPACES)
        if creator_elem is not None:
            creator_ref = creator_elem.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}resource', '')

            # Try to find artist name in edm:Agent elements (primary source)
            for agent in metadata.findall('.//edm:Agent', NAMESPACES):
                if agent.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about') == creator_ref:
                    # Prefer English label
                    for label in agent.findall('skos:prefLabel', NAMESPACES):
                        lang = label.get('{http://www.w3.org/XML/1998/namespace}lang', '')
                        if label.text:
                            if lang == 'en':
                                artist = label.text
                                break
                            elif artist == "Unknown Artist":
                                artist = label.text
                    break

            # Fallback: try rdf:Description elements
            if artist == "Unknown Artist":
                for desc in metadata.findall('.//rdf:Description', NAMESPACES):
                    if desc.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about') == creator_ref:
                        label = desc.find('skos:prefLabel', NAMESPACES)
                        if label is not None and label.text:
                            artist = label.text
                            break

        if not title:
            return None

        return {
            "external_id": object_number or external_id,
            "museum": "rijks",
            "museum_name": "Rijksmuseum",
            "title": title,
            "artist": artist,
            "date_display": date_display,
            "medium": "",
            "dimensions": dimensions,
            "description": description,
            "image_url": image_url,
            "thumbnail_url": image_url.replace('/full/max/', '/full/400,/') if image_url else "",
            "museum_url": f"https://www.rijksmuseum.nl/en/collection/{object_number}" if object_number else "",
            "metadata": {}
        }
    except Exception as e:
        return None


def rijks_search(query, page=1, limit=20):
    """Search Rijksmuseum collection using cached OAI-PMH data."""
    paintings = _load_rijks_paintings()

    if not paintings:
        return {"paintings": [], "total": 0, "page": page}

    # Search in title, artist, and description
    query_lower = query.lower()
    matches = []
    for p in paintings:
        if (query_lower in p.get('title', '').lower() or
            query_lower in p.get('artist', '').lower() or
            query_lower in p.get('description', '').lower()):
            matches.append(p)

    total = len(matches)

    # Paginate
    start = (page - 1) * limit
    end = start + limit
    page_results = matches[start:end]

    return {
        "paintings": page_results,
        "total": total,
        "page": page
    }


def rijks_get_painting(object_number):
    """Get a single painting from Rijksmuseum by object number."""
    paintings = _load_rijks_paintings()

    for p in paintings:
        if p.get('external_id') == object_number:
            return p

    # If not in cache, try to fetch directly via OAI-PMH GetRecord
    try:
        # The identifier format for GetRecord
        identifier = f"https://id.rijksmuseum.nl/20{object_number.replace('-', '').replace('SK', '0').replace('A', '')}"
        url = f"{RIJKS_OAI_URL}?verb=GetRecord&metadataPrefix=edm&identifier={identifier}"

        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        root = ET.fromstring(response.content)

        record = root.find('.//oai:record', NAMESPACES)
        if record:
            return _parse_rijks_oai_record(record)
    except:
        pass

    return None


# Metropolitan Museum of Art API
def met_search(query, page=1, limit=20):
    """Search Metropolitan Museum of Art collection."""
    # Met API requires a two-step process: search returns IDs, then fetch each object
    search_data = _make_request(
        f"{MET_BASE_URL}/search",
        {"q": query, "hasImages": "true", "departmentId": "11"},  # 11 = European Paintings
        cache_prefix="met_search"
    )

    if not search_data or "objectIDs" not in search_data:
        return {"paintings": [], "total": 0, "page": page}

    object_ids = search_data.get("objectIDs", []) or []
    total = len(object_ids)

    # Paginate through the IDs
    start = (page - 1) * limit
    end = start + limit
    page_ids = object_ids[start:end]

    paintings = []
    for obj_id in page_ids:
        painting = met_get_painting(obj_id)
        if painting and painting.get("image_url"):
            paintings.append(painting)

    return {
        "paintings": paintings,
        "total": total,
        "page": page
    }


def _fetch_met_description(object_url):
    """Fetch the curatorial description from Met website (not in API)."""
    if not object_url:
        return ""
    try:
        response = requests.get(object_url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        html = response.text

        # Find all SafeHtml content blocks and return the longest one
        # (the description is typically the longest text block)
        matches = re.findall(r'data-sentry-element="SafeHtml"[^>]*>(.*?)</div>', html, re.DOTALL)
        best_desc = ""
        for m in matches:
            clean = _strip_html(m)
            if len(clean) > len(best_desc) and len(clean) > 100:
                best_desc = clean

        if best_desc:
            return best_desc

        return ""
    except:
        return ""


def met_get_painting(object_id):
    """Get a single painting from Metropolitan Museum of Art."""
    data = _make_request(
        f"{MET_BASE_URL}/objects/{object_id}",
        {},
        cache_prefix="met_artwork"
    )

    if not data:
        return None

    result = _format_met_painting(data)

    # Try to fetch the rich description from the website
    if result.get("museum_url"):
        web_description = _fetch_met_description(result["museum_url"])
        if web_description:
            result["description"] = web_description

    return result


def _format_met_painting(item):
    """Format Met Museum painting data."""
    # Build description from available metadata
    description_parts = []

    # Artist biography
    artist_name = item.get("artistDisplayName", "")
    artist_bio = item.get("artistDisplayBio", "")
    if artist_bio:
        description_parts.append(artist_bio)

    # Culture and period context
    culture = item.get("culture", "")
    period = item.get("period", "")
    if culture and period:
        description_parts.append(f"{culture}, {period}.")
    elif culture:
        description_parts.append(f"{culture}.")
    elif period:
        description_parts.append(f"{period}.")

    # Classification info
    classification = item.get("classification", "")
    if classification and classification.lower() not in ["paintings", "painting"]:
        description_parts.append(f"Classification: {classification}.")

    # Credit line (provenance hint)
    credit = item.get("creditLine", "")
    if credit:
        description_parts.append(credit)

    description = " ".join(description_parts)

    return {
        "external_id": str(item.get("objectID", "")),
        "museum": "met",
        "museum_name": "Metropolitan Museum of Art",
        "title": item.get("title", "Untitled"),
        "artist": item.get("artistDisplayName", "Unknown Artist"),
        "date_display": item.get("objectDate", ""),
        "medium": item.get("medium", ""),
        "dimensions": item.get("dimensions", ""),
        "description": description,
        "image_url": item.get("primaryImage", ""),
        "thumbnail_url": item.get("primaryImageSmall", ""),
        "museum_url": item.get("objectURL", ""),
        "metadata": {
            "department": item.get("department", ""),
            "culture": item.get("culture", ""),
            "period": item.get("period", ""),
            "dynasty": item.get("dynasty", ""),
            "reign": item.get("reign", ""),
            "creditLine": item.get("creditLine", ""),
            "geographyType": item.get("geographyType", ""),
            "country": item.get("country", ""),
            "artistNationality": item.get("artistNationality", ""),
            "artistBeginDate": item.get("artistBeginDate", ""),
            "artistEndDate": item.get("artistEndDate", "")
        }
    }


# Cleveland Museum of Art API (no API key required)
def cleveland_search(query, page=1, limit=20):
    """Search Cleveland Museum of Art collection."""
    skip = (page - 1) * limit
    params = {
        "q": query,
        "has_image": 1,
        "limit": limit,
        "skip": skip
    }

    data = _make_request(
        f"{CLEVELAND_BASE_URL}/artworks/",
        params,
        cache_prefix="cleveland_search"
    )

    if not data:
        return {"paintings": [], "total": 0, "page": page}

    paintings = []
    for item in data.get("data", []):
        painting = _format_cleveland_painting(item)
        if painting and painting.get("image_url"):
            paintings.append(painting)

    return {
        "paintings": paintings,
        "total": data.get("info", {}).get("total", 0),
        "page": page
    }


def cleveland_get_painting(artwork_id):
    """Get a single painting from Cleveland Museum of Art."""
    data = _make_request(
        f"{CLEVELAND_BASE_URL}/artworks/{artwork_id}",
        {},
        cache_prefix="cleveland_artwork"
    )

    if not data or "data" not in data:
        return None

    return _format_cleveland_painting(data["data"])


def _format_cleveland_painting(item):
    """Format Cleveland Museum painting data."""
    # Get creator info
    creators = item.get("creators", [])
    artist = "Unknown Artist"
    if creators:
        artist = creators[0].get("description", "Unknown Artist")

    # Get image URLs
    images = item.get("images", {})
    web_image = images.get("web", {})
    image_url = web_image.get("url", "")

    # Build description
    description_parts = []
    if item.get("description"):
        description_parts.append(_strip_html(item.get("description")))
    if item.get("fun_fact"):
        description_parts.append(item.get("fun_fact"))
    description = " ".join(description_parts)

    return {
        "external_id": str(item.get("id", "")),
        "museum": "cleveland",
        "museum_name": "Cleveland Museum of Art",
        "title": item.get("title", "Untitled"),
        "artist": artist,
        "date_display": item.get("creation_date", ""),
        "medium": item.get("technique", ""),
        "dimensions": item.get("measurements", ""),
        "description": description,
        "image_url": image_url,
        "thumbnail_url": image_url,
        "museum_url": item.get("url", f"https://www.clevelandart.org/art/{item.get('id')}"),
        "metadata": {
            "department": item.get("department", ""),
            "culture": item.get("culture", []),
            "creditLine": item.get("creditline", ""),
            "accession_number": item.get("accession_number", "")
        }
    }


# Unified search function
def search_all(query, museum=None, page=1, limit=20):
    """Search across all museums or a specific museum."""
    if museum == "aic":
        return aic_search(query, page, limit)
    elif museum == "rijks":
        return rijks_search(query, page, limit)
    elif museum == "met":
        return met_search(query, page, limit)
    elif museum == "cleveland":
        return cleveland_search(query, page, limit)
    else:
        # Search all museums and combine results
        results = {"paintings": [], "total": 0, "page": page}
        per_museum = max(limit // 4, 1)

        aic_results = aic_search(query, page, per_museum)
        results["paintings"].extend(aic_results.get("paintings", []))
        results["total"] += aic_results.get("total", 0)

        rijks_results = rijks_search(query, page, per_museum)
        results["paintings"].extend(rijks_results.get("paintings", []))
        results["total"] += rijks_results.get("total", 0)

        met_results = met_search(query, page, per_museum)
        results["paintings"].extend(met_results.get("paintings", []))
        results["total"] += met_results.get("total", 0)

        cleveland_results = cleveland_search(query, page, per_museum)
        results["paintings"].extend(cleveland_results.get("paintings", []))
        results["total"] += cleveland_results.get("total", 0)

        return results


def get_painting(museum, external_id):
    """Get a single painting from a specific museum."""
    if museum == "aic":
        return aic_get_painting(external_id)
    elif museum == "rijks":
        return rijks_get_painting(external_id)
    elif museum == "met":
        return met_get_painting(external_id)
    elif museum == "cleveland":
        return cleveland_get_painting(external_id)
    return None
