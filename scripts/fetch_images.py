"""Fetches one generic (non-branded) stock photo per SKU across Pexels,
Pixabay, and Unsplash, and writes them as WebP into frontend/public/img/.

Requests are round-robined across the three providers by SKU index so no
single provider's rate limit becomes a bottleneck, with the other two as
automatic fallback if a provider errors or returns no results for a query.

Usage: scripts/venv/Scripts/python scripts/fetch_images.py
Requires scripts/.env with PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY
(gitignored — never commit real keys).

Output: frontend/public/img/<slug>.webp + scripts/image_map.json (sku_id ->
"/img/<slug>.webp" for SKUs that got an image). scripts/seed_catalog.py
reads image_map.json on the next `python scripts/seed_catalog.py` run and
fills in each SKU's "image" field accordingly — SKUs with no successful
fetch simply keep the placeholder-tile rendering (image: null).
"""
import io
import json
import os
import time

import requests
from dotenv import load_dotenv
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, "scripts", ".env"))

PEXELS_KEY = os.environ.get("PEXELS_API_KEY", "")
UNSPLASH_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")
PIXABAY_KEY = os.environ.get("PIXABAY_API_KEY", "")

IMG_DIR = os.path.join(ROOT, "frontend", "public", "img")
os.makedirs(IMG_DIR, exist_ok=True)

MAX_BYTES = 40 * 1024  # design.md perf budget: product image <=40KB WebP
TARGET_SIZE = 600

# Overrides for SKU names that would search poorly as-is (brand-flavored
# prefixes, specs that dilute the query rather than help it).
QUERY_OVERRIDES = {
    "sku_garlicbread_01": "garlic bread",
    "sku_charger_usbc_01": "usb-c charger",
    "sku_powerbank_01": "power bank charger",
    "sku_extension_board_01": "power strip extension cord",
    "sku_sunscreen_01": "sunscreen lotion bottle",
    "sku_earbuds_case_01": "wireless earbuds case",
    "sku_pizza_bread_01": "pizza base bread",
}


def query_for(sku: dict) -> str:
    return QUERY_OVERRIDES.get(sku["sku_id"], sku["name"])


def fetch_pexels(query: str) -> str | None:
    if not PEXELS_KEY:
        return None
    r = requests.get(
        "https://api.pexels.com/v1/search",
        params={"query": query, "per_page": 1},
        headers={"Authorization": PEXELS_KEY},
        timeout=10,
    )
    if r.status_code != 200:
        return None
    photos = r.json().get("photos") or []
    return photos[0]["src"]["medium"] if photos else None


def fetch_pixabay(query: str) -> str | None:
    if not PIXABAY_KEY:
        return None
    r = requests.get(
        "https://pixabay.com/api/",
        params={"key": PIXABAY_KEY, "q": query, "image_type": "photo", "per_page": 3, "safesearch": "true"},
        timeout=10,
    )
    if r.status_code != 200:
        return None
    hits = r.json().get("hits") or []
    return hits[0]["webformatURL"] if hits else None


def fetch_unsplash(query: str) -> str | None:
    if not UNSPLASH_KEY:
        return None
    r = requests.get(
        "https://api.unsplash.com/search/photos",
        params={"query": query, "per_page": 1},
        headers={"Authorization": f"Client-ID {UNSPLASH_KEY}"},
        timeout=10,
    )
    if r.status_code != 200:
        return None
    results = r.json().get("results") or []
    return results[0]["urls"]["small"] if results else None


PROVIDERS = [("pexels", fetch_pexels), ("pixabay", fetch_pixabay), ("unsplash", fetch_unsplash)]


def provider_order(index: int) -> list[tuple[str, object]]:
    """Round-robin the primary provider by SKU index so load spreads evenly
    across all three; the other two remain fallback, in rotated order."""
    n = len(PROVIDERS)
    start = index % n
    return [PROVIDERS[(start + i) % n] for i in range(n)]


def process_image(raw_bytes: bytes, out_path: str) -> int:
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)

    quality = 80
    buf = io.BytesIO()
    while quality >= 30:
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=quality)
        if buf.tell() <= MAX_BYTES:
            break
        quality -= 10
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    return buf.tell()


def main():
    with open(os.path.join(ROOT, "shared", "catalog.json"), encoding="utf-8") as f:
        catalog = json.load(f)

    image_map: dict[str, str] = {}
    failures: list[str] = []
    total = len(catalog["skus"])

    for i, sku in enumerate(catalog["skus"]):
        slug = sku["sku_id"][len("sku_"):]
        query = query_for(sku)
        img_url, used = None, None

        for name, fn in provider_order(i):
            try:
                img_url = fn(query)
            except Exception:
                img_url = None
            if img_url:
                used = name
                break

        if not img_url:
            print(f"[{i + 1}/{total}] {sku['sku_id']}: NO RESULT for {query!r}")
            failures.append(sku["sku_id"])
            continue

        try:
            resp = requests.get(img_url, timeout=15)
            resp.raise_for_status()
            out_path = os.path.join(IMG_DIR, f"{slug}.webp")
            size = process_image(resp.content, out_path)
            image_map[sku["sku_id"]] = f"/img/{slug}.webp"
            print(f"[{i + 1}/{total}] {sku['sku_id']}: OK via {used} ({size}B) - {query!r}")
        except Exception as e:
            print(f"[{i + 1}/{total}] {sku['sku_id']}: DOWNLOAD/PROCESS FAILED - {e}")
            failures.append(sku["sku_id"])

        time.sleep(0.2)

    with open(os.path.join(ROOT, "scripts", "image_map.json"), "w", encoding="utf-8") as f:
        json.dump(image_map, f, indent=2)

    print(f"\nDone: {len(image_map)}/{total} images fetched, {len(failures)} failed.")
    if failures:
        print("Failed (kept as placeholder tiles):", failures)
    print("Next: python scripts/seed_catalog.py  (picks up scripts/image_map.json)")


if __name__ == "__main__":
    main()
