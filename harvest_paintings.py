"""
Optimized harvest script focused on PAINTINGS ONLY.
Skips museums that return pottery, records, decorative arts.
Target: 10,000+ high-quality paintings.
"""
import time
from datetime import datetime

from supabase_db import get_client, upsert_painting
import museum_apis as api


# Painting-focused search terms
PAINTING_TERMS = [
    # Major painters
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
    "Turner", "Constable", "Gainsborough", "Reynolds",
    # French
    "Poussin", "Watteau", "Fragonard", "David", "Ingres",
    "Delacroix", "Courbet", "Millet", "Corot",
    # American
    "Whistler", "Sargent", "Homer", "Eakins", "Church",
    # Impressionists
    "Sisley", "Pissarro", "Caillebotte", "Morisot",
    # Post-Impressionists
    "Van Gogh", "Cézanne", "Gauguin", "Seurat",
    # Skagen/Danish
    "Krøyer", "Anna Ancher", "Michael Ancher", "Hammershøi",
    "Eckersberg", "Købke",
    # Themes (painting-specific)
    "oil painting", "portrait painting", "landscape painting",
    "still life", "seascape", "nude", "religious painting",
    "history painting", "genre painting",
]


def harvest_batch(museum, search_func, query, max_pages=5, limit=20):
    """Harvest a batch of paintings."""
    total = 0
    for page in range(1, max_pages + 1):
        try:
            results = search_func(query, page=page, limit=limit)
            paintings = results.get("paintings", [])

            if not paintings:
                break

            for p in paintings:
                if p.get("image_url") and p.get("title"):
                    result = upsert_painting(p)
                    if result:
                        total += 1

            time.sleep(0.3)  # Be nice to APIs

        except Exception as e:
            print(f"    Error: {e}")
            break

    return total


def harvest_aic_full():
    """Harvest Art Institute of Chicago - excellent painting source."""
    print("\n" + "=" * 50)
    print("ART INSTITUTE OF CHICAGO")
    print("=" * 50)

    total = 0
    for term in PAINTING_TERMS:
        print(f"  {term}...", end=" ", flush=True)
        count = harvest_batch("aic", api.aic_search, term, max_pages=5)
        total += count
        print(f"{count}")

    print(f"  TOTAL: {total}")
    return total


def harvest_rijks_full():
    """Harvest Rijksmuseum - loads all paintings via OAI-PMH."""
    print("\n" + "=" * 50)
    print("RIJKSMUSEUM")
    print("=" * 50)

    print("  Loading paintings via OAI-PMH...")
    paintings = api._load_rijks_paintings()

    total = 0
    for i, p in enumerate(paintings):
        if p.get("image_url") and p.get("title"):
            result = upsert_painting(p)
            if result:
                total += 1

        if (i + 1) % 500 == 0:
            print(f"    Processed {i + 1}/{len(paintings)}...")

    print(f"  TOTAL: {total}")
    return total


def harvest_met_full():
    """Harvest Met - European Paintings department."""
    print("\n" + "=" * 50)
    print("METROPOLITAN MUSEUM OF ART")
    print("=" * 50)

    total = 0
    # Use fewer terms but more pages since Met is slower
    met_terms = PAINTING_TERMS[:25]

    for term in met_terms:
        print(f"  {term}...", end=" ", flush=True)
        count = harvest_batch("met", api.met_search, term, max_pages=3, limit=10)
        total += count
        print(f"{count}")
        time.sleep(0.5)  # Met needs slower requests

    print(f"  TOTAL: {total}")
    return total


def harvest_cleveland_full():
    """Harvest Cleveland Museum of Art."""
    print("\n" + "=" * 50)
    print("CLEVELAND MUSEUM OF ART")
    print("=" * 50)

    total = 0
    for term in PAINTING_TERMS:
        print(f"  {term}...", end=" ", flush=True)
        count = harvest_batch("cleveland", api.cleveland_search, term, max_pages=3)
        total += count
        print(f"{count}")

    print(f"  TOTAL: {total}")
    return total


def harvest_smk_full():
    """Harvest SMK (National Gallery of Denmark)."""
    print("\n" + "=" * 50)
    print("SMK - NATIONAL GALLERY OF DENMARK")
    print("=" * 50)

    # Add Danish-specific terms
    smk_terms = PAINTING_TERMS + [
        "Skagen", "Danish", "Nordic", "Copenhagen",
        "Golden Age", "Naturalism"
    ]

    total = 0
    for term in smk_terms:
        print(f"  {term}...", end=" ", flush=True)
        count = harvest_batch("smk", api.smk_search, term, max_pages=3)
        total += count
        print(f"{count}")

    print(f"  TOTAL: {total}")
    return total


def get_stats():
    """Get current painting counts."""
    client = get_client()
    museums = ["aic", "rijks", "met", "cleveland", "smk"]
    stats = {}

    for museum in museums:
        result = client.table("paintings").select("id", count="exact").eq("museum", museum).execute()
        stats[museum] = result.count or 0

    return stats


def main():
    """Run full paintings harvest."""
    print("=" * 60)
    print("PAINTINGS-ONLY HARVEST")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Target: 10,000+ paintings")
    print("=" * 60)

    # Current stats
    print("\nCurrent counts:")
    stats = get_stats()
    current_total = sum(stats.values())
    for museum, count in stats.items():
        print(f"  {museum}: {count}")
    print(f"  TOTAL: {current_total}")

    # Harvest in order of quality/speed
    totals = {}

    # AIC - fast, high quality
    totals["aic"] = harvest_aic_full()

    # Rijksmuseum - loads all at once
    totals["rijks"] = harvest_rijks_full()

    # SMK - Danish paintings
    totals["smk"] = harvest_smk_full()

    # Cleveland - good quality
    totals["cleveland"] = harvest_cleveland_full()

    # Met - slower but good paintings
    totals["met"] = harvest_met_full()

    # Final stats
    print("\n" + "=" * 60)
    print("HARVEST COMPLETE")
    print("=" * 60)

    final_stats = get_stats()
    final_total = sum(final_stats.values())

    print("\nFinal counts:")
    for museum, count in final_stats.items():
        print(f"  {museum}: {count}")
    print(f"\n  GRAND TOTAL: {final_total} paintings")
    print(f"  New this session: {final_total - current_total}")
    print("=" * 60)


if __name__ == "__main__":
    main()
