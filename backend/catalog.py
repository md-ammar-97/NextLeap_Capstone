"""Loads the synced catalog copy (backend/data/catalog.json) once at import
time and exposes lookup + candidate-filtering helpers used by copilot.py."""
import json
import os

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "catalog.json")

with open(DATA_PATH, "r", encoding="utf-8") as _f:
    _catalog = json.load(_f)

CATEGORIES = {c["category_id"]: c for c in _catalog["categories"]}
SKUS = {s["sku_id"]: s for s in _catalog["skus"]}


def get_sku(sku_id: str) -> dict | None:
    return SKUS.get(sku_id)


def get_category(category_id: str) -> dict | None:
    return CATEGORIES.get(category_id)


def candidate_slice(history_category_ids: list[str], dismissed_sku_ids: list[str], cap: int = 40) -> list[dict]:
    """Eligible (new-category) SKUs + same-category context SKUs for items
    already in the given history, per architecture.md section 4.1. Both
    groups are sent to the model; validation later enforces the
    >=2-new-category rule on what the model actually picks."""
    history = set(history_category_ids)
    dismissed = set(dismissed_sku_ids)

    eligible = [s for s in _catalog["skus"]
                if s["category_id"] not in history and s["sku_id"] not in dismissed
                and not s["out_of_stock"]]
    context = [s for s in _catalog["skus"]
               if s["category_id"] in history and s["sku_id"] not in dismissed
               and not s["out_of_stock"]]

    slice_ = (eligible + context)[:cap]
    return slice_


def is_new_category(sku_id: str, history_category_ids: list[str]) -> bool:
    sku = get_sku(sku_id)
    if not sku:
        return False
    return sku["category_id"] not in set(history_category_ids)
