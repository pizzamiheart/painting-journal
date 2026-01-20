"""
Painting Harvest System - Periodically pulls paintings from museum APIs
and stores them in Supabase for faster local queries.

Usage:
    python harvest.py              # Run harvest for all museums
    python harvest.py aic          # Run harvest for specific museum
    python harvest.py --artists    # Harvest popular artists
"""
import sys
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from supabase_db import get_client, upsert_painting
import museum_apis as api


# Popular search terms to harvest paintings for
HARVEST_TERMS = [
    # Major artists
    "Rembrandt", "Vermeer", "Van Gogh", "Monet", "Renoir",
    "Cézanne", "Degas", "Manet", "Matisse", "Picasso",
    "Klimt", "Kandinsky", "Mondrian", "Hopper", "Cassatt",
    "Gauguin", "Seurat", "Toulouse-Lautrec",
    # Dutch Golden Age
    "Frans Hals", "Jan Steen", "Ruisdael", "Avercamp",
    "Pieter de Hooch", "Gerard ter Borch",
    # Italian Masters
    "Leonardo da Vinci", "Michelangelo", "Raphael", "Caravaggio",
    "Titian", "Botticelli", "Tintoretto", "Veronese",
    # Northern Renaissance
    "Van Eyck", "Dürer", "Holbein", "Bruegel", "Bosch",
    # Baroque
    "Rubens", "Velázquez", "El Greco", "Goya",
    # British
    "Turner", "Constable", "Gainsborough",
    # French Classical
    "Poussin", "Watteau", "Fragonard", "David", "Ingres",
    "Delacroix", "Courbet", "Millet", "Corot",
    # American
    "Whistler", "Sargent", "Homer",
    # Skagen Painters (Denmark)
    "Krøyer", "Anna Ancher", "Michael Ancher",
    "Hammershøi", "Eckersberg", "Købke",
    # Themes
    "landscape", "portrait", "still life", "seascape",
    "flowers", "winter", "sunset", "garden",
]


def log_harvest(museum, status, paintings_count, message=""):
    """Log harvest activity to database."""
    client = get_client()
    try:
        client.table("harvest_logs").insert({
            "museum": museum,
            "status": status,
            "paintings_harvested": paintings_count,
            "message": message
        }).execute()
    except Exception as e:
        print(f"  Warning: Could not log harvest: {e}")


def harvest_museum_search(museum, search_func, query, max_pages=3, limit=20):
    """Harvest paintings from a museum using search queries."""
    total_harvested = 0

    for page in range(1, max_pages + 1):
        try:
            results = search_func(query, page=page, limit=limit)
            paintings = results.get("paintings", [])

            if not paintings:
                break

            for painting in paintings:
                if painting.get("image_url") and painting.get("title"):
                    result = upsert_painting(painting)
                    if result:
                        total_harvested += 1

            # Respect rate limits
            time.sleep(0.5)

        except Exception as e:
            print(f"    Error on page {page}: {e}")
            break

    return total_harvested


def harvest_aic(terms=None):
    """Harvest Art Institute of Chicago paintings."""
    print("\n--- Art Institute of Chicago ---")
    terms = terms or HARVEST_TERMS
    total = 0

    for term in terms:
        print(f"  Harvesting: {term}")
        count = harvest_museum_search("aic", api.aic_search, term)
        total += count
        print(f"    Found {count} paintings")

    log_harvest("aic", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_rijks(terms=None):
    """Harvest Rijksmuseum paintings (loads all via OAI-PMH)."""
    print("\n--- Rijksmuseum ---")

    # Rijksmuseum uses OAI-PMH which loads all paintings at once
    # Just search with empty query to trigger cache load
    paintings = api._load_rijks_paintings()
    total = 0

    for painting in paintings:
        if painting.get("image_url") and painting.get("title"):
            result = upsert_painting(painting)
            if result:
                total += 1

    log_harvest("rijks", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_met(terms=None):
    """Harvest Metropolitan Museum of Art paintings."""
    print("\n--- Metropolitan Museum of Art ---")
    terms = terms or HARVEST_TERMS[:20]  # Met API is slower, limit terms
    total = 0

    for term in terms:
        print(f"  Harvesting: {term}")
        count = harvest_museum_search("met", api.met_search, term, max_pages=2, limit=10)
        total += count
        print(f"    Found {count} paintings")
        time.sleep(1)  # Met API rate limiting

    log_harvest("met", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_cleveland(terms=None):
    """Harvest Cleveland Museum of Art paintings."""
    print("\n--- Cleveland Museum of Art ---")
    terms = terms or HARVEST_TERMS
    total = 0

    for term in terms:
        print(f"  Harvesting: {term}")
        count = harvest_museum_search("cleveland", api.cleveland_search, term)
        total += count
        print(f"    Found {count} paintings")

    log_harvest("cleveland", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_harvard(terms=None):
    """Harvest Harvard Art Museums paintings."""
    if not api.HARVARD_API_KEY:
        print("\n--- Harvard Art Museums --- SKIPPED (no API key)")
        return 0

    print("\n--- Harvard Art Museums ---")
    terms = terms or HARVEST_TERMS
    total = 0

    for term in terms:
        print(f"  Harvesting: {term}")
        count = harvest_museum_search("harvard", api.harvard_search, term)
        total += count
        print(f"    Found {count} paintings")

    log_harvest("harvard", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_europeana(terms=None):
    """Harvest Europeana paintings."""
    if not api.EUROPEANA_API_KEY:
        print("\n--- Europeana --- SKIPPED (no API key)")
        return 0

    print("\n--- Europeana ---")
    terms = terms or HARVEST_TERMS[:15]  # Europeana has lots of results
    total = 0

    for term in terms:
        print(f"  Harvesting: {term}")
        count = harvest_museum_search("europeana", api.europeana_search, term)
        total += count
        print(f"    Found {count} paintings")

    log_harvest("europeana", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_smithsonian(terms=None):
    """Harvest Smithsonian paintings."""
    if not api.SMITHSONIAN_API_KEY:
        print("\n--- Smithsonian --- SKIPPED (no API key)")
        return 0

    print("\n--- Smithsonian ---")
    terms = terms or HARVEST_TERMS
    total = 0

    for term in terms:
        print(f"  Harvesting: {term}")
        count = harvest_museum_search("smithsonian", api.smithsonian_search, term)
        total += count
        print(f"    Found {count} paintings")

    log_harvest("smithsonian", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_smk(terms=None):
    """Harvest SMK (National Gallery of Denmark) paintings."""
    print("\n--- SMK (National Gallery of Denmark) ---")
    # Default to Danish-focused terms
    terms = terms or HARVEST_TERMS + [
        "Skagen", "Danish", "Copenhagen", "Nordic"
    ]
    total = 0

    for term in terms:
        print(f"  Harvesting: {term}")
        count = harvest_museum_search("smk", api.smk_search, term)
        total += count
        print(f"    Found {count} paintings")

    log_harvest("smk", "completed", total)
    print(f"  Total: {total} paintings")
    return total


def harvest_all():
    """Run harvest for all configured museums."""
    print("=" * 50)
    print("PAINTING HARVEST")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    totals = {
        "aic": harvest_aic(),
        "rijks": harvest_rijks(),
        "met": harvest_met(),
        "cleveland": harvest_cleveland(),
        "harvard": harvest_harvard(),
        "europeana": harvest_europeana(),
        "smithsonian": harvest_smithsonian(),
        "smk": harvest_smk(),
    }

    print("\n" + "=" * 50)
    print("HARVEST COMPLETE")
    print("=" * 50)
    grand_total = sum(totals.values())
    print(f"Grand Total: {grand_total} paintings harvested")
    for museum, count in totals.items():
        print(f"  {museum}: {count}")
    print("=" * 50)

    return grand_total


def get_harvest_stats():
    """Get current harvest statistics from database."""
    client = get_client()

    # Count paintings by museum
    result = client.table("paintings").select("museum", count="exact").execute()

    # Get counts per museum
    museums = ["aic", "rijks", "met", "cleveland", "harvard", "europeana", "smithsonian", "smk"]
    stats = {}

    for museum in museums:
        result = client.table("paintings").select("id", count="exact").eq("museum", museum).execute()
        stats[museum] = result.count or 0

    return stats


if __name__ == "__main__":
    # Parse command line arguments
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()

        if arg == "--stats":
            print("Current painting counts:")
            stats = get_harvest_stats()
            total = sum(stats.values())
            for museum, count in stats.items():
                print(f"  {museum}: {count}")
            print(f"  TOTAL: {total}")

        elif arg == "--artists":
            # Just harvest popular artists
            artist_terms = HARVEST_TERMS[:30]
            print(f"Harvesting {len(artist_terms)} popular artists...")
            harvest_aic(artist_terms)
            harvest_cleveland(artist_terms)
            harvest_met(artist_terms[:15])

        elif arg == "aic":
            harvest_aic()
        elif arg == "rijks":
            harvest_rijks()
        elif arg == "met":
            harvest_met()
        elif arg == "cleveland":
            harvest_cleveland()
        elif arg == "harvard":
            harvest_harvard()
        elif arg == "europeana":
            harvest_europeana()
        elif arg == "smithsonian":
            harvest_smithsonian()
        elif arg == "smk":
            harvest_smk()
        else:
            print(f"Unknown argument: {arg}")
            print("Usage: python harvest.py [museum|--stats|--artists]")
            print("Museums: aic, rijks, met, cleveland, harvard, europeana, smithsonian, smk")
    else:
        harvest_all()
