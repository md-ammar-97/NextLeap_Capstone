"""Fix 6 (docs/improve.md): regression check for candidate-coverage fixes.
Hard-codes ~15 baskets and asserts the copilot returns a mission (not
silence) for the ones that should work, and silence for the ones that
shouldn't. Run against production after each deploy; the pass rate is the
honest answer to "how do you know it works?"

Two baskets in the doc's original list reference products this catalog
doesn't have (no plain bread/eggs SKU, no dedicated "festival sweets" SKU)
— substituted with the closest real fit rather than inventing new SKUs,
same principle as the catalog enrichment gaps in Fix 3:
  "bread+eggs"      -> cheese slices + butter (same breakfast/sandwich intent)
  "festival sweets"  -> dry-fruit mix alone (tagged festival in Fix 3)

Usage: python scripts/test_baskets.py [backend_url]
"""
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARED = os.path.join(ROOT, "shared")
BACKEND_URL = sys.argv[1] if len(sys.argv) > 1 else "https://instamart-copilot-api.onrender.com"

with open(os.path.join(SHARED, "priya.json"), encoding="utf-8") as f:
    PRIYA = json.load(f)

# (label, sku_ids, local_hour)
SHOULD_MISSION = [
    ("pasta + sauce", ["sku_pasta_01", "sku_pasta_sauce_01"], 19),
    ("rice + dal", ["sku_rice_basmati_01", "sku_toor_dal_01"], 19),
    ("coffee alone", ["sku_coffee_instant_01"], 8),
    ("coffee + biscuits @ 8am", ["sku_coffee_instant_01", "sku_biscuits_marie_01"], 8),
    ("diapers", ["sku_diapers_01"], 12),
    ("floor cleaner", ["sku_floor_cleaner_01"], 11),
    ("party snacks (nachos) + cola", ["sku_nachos_01", "sku_cola_01"], 20),
    ("atta + milk", ["sku_atta_ww_01", "sku_milk_01"], 9),
    ("charger", ["sku_charger_usbc_01"], 14),
    ("protein food (yogurt)", ["sku_yogurt_greek_01"], 9),
    ("micellar water", ["sku_micellar_water_01"], 20),
    ("cheese + butter (bread+eggs stand-in)", ["sku_cheese_slices_01", "sku_butter_01"], 8),
    ("dog food", ["sku_dog_food_01"], 12),
    ("dry-fruit mix (festival sweets stand-in)", ["sku_dryfruit_mix_01"], 17),
]

SHOULD_SILENCE = [
    ("single low-signal SKU alone", ["sku_ribbon_roll_01"], 12),
    ("12 unrelated items (one per category, deliberately incoherent)", [
        "sku_salt_01", "sku_cookies_choc_01", "sku_soda_water_01", "sku_ghee_01",
        "sku_tissue_roll_01", "sku_capsicum_01", "sku_kajal_01", "sku_pacifier_01",
        "sku_thermometer_01", "sku_batteries_aa_01", "sku_ribbon_roll_01", "sku_pet_leash_01",
    ], 15),
    ("empty cart", [], 12),
]


def call_copilot(sku_ids: list[str], local_hour: int) -> tuple[int, dict | None]:
    body = {
        "session_id": "s_test_baskets",
        "persona": "householder",
        "cart": [{"sku_id": sid, "qty": 1} for sid in sku_ids],
        "history_category_ids": PRIYA["history_category_ids"],
        "dismissed_sku_ids": [],
        "local_hour": local_hour,
    }
    req = urllib.request.Request(
        f"{BACKEND_URL}/copilot",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status == 204:
                return 204, None
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 204:
            return 204, None
        return e.code, None
    except Exception as e:
        return -1, {"error": str(e)}


def main():
    results = []

    print(f"Backend: {BACKEND_URL}\n")
    print("== Should produce a mission ==")
    for label, sku_ids, hour in SHOULD_MISSION:
        status, data = call_copilot(sku_ids, hour)
        passed = status == 200 and data is not None
        results.append(passed)
        mission = data.get("mission") if data else None
        print(f"  [{'PASS' if passed else 'FAIL'}] {label:45s} status={status} mission={mission!r}")

    print("\n== Should stay silent ==")
    for label, sku_ids, hour in SHOULD_SILENCE:
        status, data = call_copilot(sku_ids, hour)
        passed = status == 204
        results.append(passed)
        print(f"  [{'PASS' if passed else 'FAIL'}] {label:60s} status={status}")

    total = len(results)
    passed_count = sum(results)
    print(f"\nPass rate: {passed_count}/{total} ({100 * passed_count / total:.0f}%)")
    print(
        "\nNote: the silence cases depend on the model's own coherence judgment "
        "(unchanged by this fix set), not something candidate selection can force — "
        "expect these to be the least deterministic of the set, run-to-run."
    )


if __name__ == "__main__":
    main()
