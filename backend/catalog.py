"""Loads the synced catalog copy (backend/data/catalog.json) once at import
time and exposes lookup + candidate-scoring helpers used by copilot.py.

candidate_slice() implements Fix 1 from docs/improve.md: a cart-aware
relevance score per SKU, assembled into a slice that is (a) relevant,
(b) guaranteed to represent every never-purchased category, and (c) mixed
new/known category so mission *completion* (not just discovery) is
possible. Replaces the old static catalog-order truncation that silently
capped out at whichever 4 categories happened to sort first."""
import hashlib
import json
import os
import random

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "catalog.json")

with open(DATA_PATH, "r", encoding="utf-8") as _f:
    _catalog = json.load(_f)

CATEGORIES = {c["category_id"]: c for c in _catalog["categories"]}
SKUS = {s["sku_id"]: s for s in _catalog["skus"]}

# Closed mission-tag vocabulary (docs/improve.md Fix 3) — only these tags
# count as "mission tag" matches and time-of-day matches; everything else
# in a SKU's tags list is an "ordinary tag" for scoring purposes.
MISSION_TAGS = {
    "breakfast", "lunch", "dinner", "late-night", "tea-coffee-time",
    "party", "festival", "guests", "gifting",
    "cleaning", "laundry", "kitchen-restock",
    "baby-care", "pet-care", "personal-care", "grooming",
    "wellness", "sleep", "immunity", "first-aid",
    "desk-setup", "travel", "monsoon", "summer",
}

# Time-of-day windows (docs/improve.md Fix 1 scoring table). late-night
# wraps midnight, hence the two-sided check.
_TIME_OF_DAY_TAGS = {
    "breakfast": lambda hour: 6 <= hour <= 11,
    "dinner": lambda hour: 18 <= hour <= 23,
    "late-night": lambda hour: hour >= 23 or hour <= 3,
}

# Scoring points (docs/improve.md Fix 1 table)
_COMPLEMENT_POINTS = 10
_MISSION_TAG_POINTS = 6
_MISSION_TAG_CAP = 12
_ORDINARY_TAG_POINTS = 4
_ORDINARY_TAG_CAP = 12
_SAME_CATEGORY_POINTS = 2
_TIME_OF_DAY_POINTS = 3
_NEW_CATEGORY_POINTS = 2

# Assembly sizes (docs/improve.md Fix 1 assembly steps)
_NEW_CATEGORY_TOP_N = 18
_KNOWN_CATEGORY_TOP_N = 8
_DEFAULT_CAP = 30


def get_sku(sku_id: str) -> dict | None:
    return SKUS.get(sku_id)


def get_category(category_id: str) -> dict | None:
    return CATEGORIES.get(category_id)


def _score_candidate(
    sku: dict,
    cart_skus: list[dict],
    cart_tags: set[str],
    cart_category_ids: set[str],
    history: set[str],
    local_hour: int,
) -> int:
    """Score one candidate SKU against the union of the current cart."""
    score = 0
    candidate_tags = set(sku.get("tags", []))

    # Curated complements, either direction — strongest signal, a flat
    # +10 regardless of how many cart items match (the table gives this
    # no "each"/cap language, unlike the two tag signals below).
    candidate_complements = set(sku.get("complements", []))
    if any(
        sku["sku_id"] in cart_sku.get("complements", [])
        or cart_sku["sku_id"] in candidate_complements
        for cart_sku in cart_skus
    ):
        score += _COMPLEMENT_POINTS

    # Shared tags with the cart, split into mission vs. ordinary, each
    # summed then capped independently at 12.
    shared = candidate_tags & cart_tags
    shared_mission = shared & MISSION_TAGS
    shared_ordinary = shared - MISSION_TAGS
    score += min(len(shared_mission) * _MISSION_TAG_POINTS, _MISSION_TAG_CAP)
    score += min(len(shared_ordinary) * _ORDINARY_TAG_POINTS, _ORDINARY_TAG_CAP)

    # Same category as a cart item — mild signal, completion often
    # crosses categories so this deliberately isn't the dominant term.
    if sku["category_id"] in cart_category_ids:
        score += _SAME_CATEGORY_POINTS

    # Time-of-day: candidate's own tag against local_hour, independent of
    # whether the cart itself shares that tag.
    for tag, in_window in _TIME_OF_DAY_TAGS.items():
        if tag in candidate_tags and in_window(local_hour):
            score += _TIME_OF_DAY_POINTS
            break

    # Never-purchased category — gentle thumb on the scale, not a mandate.
    if sku["category_id"] not in history:
        score += _NEW_CATEGORY_POINTS

    return score


def candidate_slice(
    cart_sku_ids: list[str],
    history_category_ids: list[str],
    dismissed_sku_ids: list[str],
    local_hour: int = 12,
    cap: int = _DEFAULT_CAP,
    debug: bool = False,
) -> list[dict] | list[tuple[dict, int, str]]:
    """Score every in-stock, non-dismissed, not-already-in-cart SKU against
    the current cart, then assemble a slice that is (a) relevant, (b)
    guaranteed to represent every never-purchased category, and (c) mixed
    new/known so mission completion is possible. See docs/improve.md Fix 1
    for the scoring table and assembly steps this implements.

    debug=False (default): returns list[dict] of SKU records, unchanged
    shape from before — existing callers need no changes.
    debug=True: returns list[(sku, score, reason)] instead, where reason
    is "top18_new_category" | "top8_known_category" | "coverage_guarantee"
    — used by the /copilot/debug route (Fix 5) to show why each candidate
    was included.
    """
    history = set(history_category_ids)
    dismissed = set(dismissed_sku_ids)
    cart_ids = set(cart_sku_ids)

    cart_skus = [sku for sid in cart_sku_ids if (sku := get_sku(sid)) is not None]
    cart_category_ids = {sku["category_id"] for sku in cart_skus}
    cart_tags: set[str] = set()
    for sku in cart_skus:
        cart_tags.update(sku.get("tags", []))

    eligible = [
        s for s in _catalog["skus"]
        if s["sku_id"] not in cart_ids
        and s["sku_id"] not in dismissed
        and not s["out_of_stock"]
    ]

    scored = [
        (s, _score_candidate(s, cart_skus, cart_tags, cart_category_ids, history, local_hour))
        for s in eligible
    ]

    never_purchased = sorted(
        (t for t in scored if t[0]["category_id"] not in history),
        key=lambda t: t[1],
        reverse=True,
    )
    known = sorted(
        (t for t in scored if t[0]["category_id"] in history),
        key=lambda t: t[1],
        reverse=True,
    )

    # Step 1 + 2: top-N from never-purchased categories, then top-N from
    # known categories (the completion slots — pasta -> garlic bread).
    picked: dict[str, tuple[dict, int, str]] = {}
    for sku, score in never_purchased[:_NEW_CATEGORY_TOP_N]:
        picked[sku["sku_id"]] = (sku, score, "top18_new_category")
    for sku, score in known[:_KNOWN_CATEGORY_TOP_N]:
        picked[sku["sku_id"]] = (sku, score, "top8_known_category")

    # Step 3: guarantee coverage — every never-purchased category not yet
    # represented gets its single highest-scoring SKU forced in, even at
    # score 0. This is what makes pharma/electronics/party_gifting/pet
    # reachable at all for a history-locked persona.
    covered_categories = {
        s["category_id"] for s, _score, _reason in picked.values() if s["category_id"] not in history
    }
    all_never_purchased_categories = {s["category_id"] for s, _score in never_purchased}
    for cat_id in all_never_purchased_categories - covered_categories:
        sku, score = max(
            (t for t in never_purchased if t[0]["category_id"] == cat_id),
            key=lambda t: t[1],
        )
        picked[sku["sku_id"]] = (sku, score, "coverage_guarantee")

    # Drop score-0 SKUs unless they're a coverage guarantee — feeding the
    # model junk invites forced picks.
    guaranteed = [v for v in picked.values() if v[2] == "coverage_guarantee"]
    scoreable = [v for v in picked.values() if v[2] != "coverage_guarantee" and v[1] > 0]

    # Step 4: deterministic shuffle (seed = hash of sorted cart sku_ids) so
    # position bias doesn't always favour the same category.
    seed_material = ",".join(sorted(cart_sku_ids)).encode()
    seed = int(hashlib.sha1(seed_material).hexdigest(), 16)
    rng = random.Random(seed)
    rng.shuffle(scoreable)

    # Cap applies to the shuffled pool filling the remaining budget after
    # guarantees — a coverage guarantee that can be silently cut by the
    # cap isn't actually a guarantee (see plan notes for why this is a
    # deliberate, small deviation from a literal whole-set shuffle+cap).
    # The shuffle still does its job here: it's what decides which items
    # get cut when the pool exceeds budget, so no single category is
    # always the one left out.
    remaining_budget = max(0, cap - len(guaranteed))
    survivors = guaranteed + scoreable[:remaining_budget]

    # Present the final slice to the model best-first. The shuffle above
    # already did its job deciding *what survives* the cap; once selected,
    # burying the highest-relevance candidates in random position among
    # ~30 items measurably hurts a weaker fallback model's ability to
    # ground its answer (observed directly: a floor-cleaner cart with
    # correctly-scored cleaning items at the top of the list still pulled
    # an unrelated "pasta dinner" mission from shuffled presentation order
    # on the 8B fallback). Sorting by score for presentation is a pure
    # quality improvement with no effect on the coverage guarantee, which
    # doesn't depend on order at all.
    survivors.sort(key=lambda v: v[1], reverse=True)

    if debug:
        return survivors
    return [sku for sku, _score, _reason in survivors]


def is_new_category(sku_id: str, history_category_ids: list[str]) -> bool:
    sku = get_sku(sku_id)
    if not sku:
        return False
    return sku["category_id"] not in set(history_category_ids)
