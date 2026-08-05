"""Fix 6 (docs/improve.md) + gate-removal regression (see the plan that
dropped MIN_NEW_CATEGORY in copilot.py): regression check for candidate-
coverage fixes. Hard-codes baskets and asserts the copilot returns a
mission (not silence) for the ones that should work, and silence for the
ones that shouldn't. Run against production after each deploy; the pass
rate is the honest answer to "how do you know it works?"

Two baskets in the doc's original list reference products this catalog
doesn't have (no plain bread/eggs SKU, no dedicated "festival sweets" SKU)
— substituted with the closest real fit rather than inventing new SKUs,
same principle as the catalog enrichment gaps in Fix 3:
  "bread+eggs"      -> cheese slices + butter (same breakfast/sandwich intent)
  "festival sweets"  -> dry-fruit mix alone (tagged festival in Fix 3)

GATE_REGRESSION_PAIRS below is the group that actually exercises the
dropped hard gate: SHOULD_MISSION alone never could, since it only ever
called as Priya (persona=householder) against her own history — a bug
that's specifically an asymmetry between personas sharing an identical
candidate set (same picks read as "new category" for one persona and
"known category" for the other, and the old gate silently discarded the
whole response whenever every pick was known-category) could never surface
from a single-persona suite. Each basket here is run against both Priya
(new category for her) and Ishaan (already in his history_category_ids —
see shared/ishaan.json) and both calls must come back with a live mission.

Usage: python scripts/test_baskets.py [backend_url]
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARED = os.path.join(ROOT, "shared")
BACKEND_URL = sys.argv[1] if len(sys.argv) > 1 else "https://instamart-copilot-api.onrender.com"

# Groq's free-tier per-minute token/request limits are easily exceeded by
# firing ~25+ live-model calls back-to-back with no pacing (observed
# directly: the first several calls of an unpaced run succeeded, then every
# call for the rest of the run silently failed and fell through to 204) —
# distinct from the shared daily quota noted in the README. A few seconds
# between calls keeps a full run under the per-minute ceiling.
CALL_DELAY_S = 3

with open(os.path.join(SHARED, "priya.json"), encoding="utf-8") as f:
    PRIYA = json.load(f)
with open(os.path.join(SHARED, "ishaan.json"), encoding="utf-8") as f:
    ISHAAN = json.load(f)

PERSONAS = {
    "priya": (PRIYA, "householder"),
    "ishaan": (ISHAAN, "experimenter"),
}

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

# (label, sku_ids, local_hour) — each run against BOTH personas below.
# New-for-Priya / known-for-Ishaan (per shared/priya.json vs shared/ishaan.json
# history_category_ids), so the identical candidate set reads as
# [NEW CATEGORY] for one persona and [known category] for the other. The
# old MIN_NEW_CATEGORY gate discarded the entire response whenever every
# pick came back known-category — this is the case it could silently break.
GATE_REGRESSION_PAIRS = [
    ("charger + extension board (electronics)",
     ["sku_charger_usbc_01", "sku_extension_board_01"], 14),
    ("micellar water + face wash (beauty)",
     ["sku_micellar_water_01", "sku_face_wash_01"], 20),
    ("dog food + pet treats (pet)",
     ["sku_dog_food_01", "sku_pet_treats_01"], 12),
    ("balloons + candles (party_gifting)",
     ["sku_balloons_01", "sku_candles_bday_01"], 16),
]

# Pharma has two complement sub-clusters that don't overlap (first-aid vs.
# wellness/supplements). pharma is new-category for BOTH personas, so these
# don't exercise the gate fix — they prove candidate_slice()'s coverage
# guarantee still reaches both sub-clusters independently of each other.
PHARMA_BASELINE = [
    ("paracetamol + bandaid (first-aid)", ["sku_paracetamol_01", "sku_bandaid_01"], 12),
    ("multivitamin + omega3 (wellness)", ["sku_multivitamin_01", "sku_omega3_01"], 9),
]


def call_copilot(sku_ids: list[str], local_hour: int, persona_key: str = "priya") -> tuple[int, dict | None]:
    persona_data, framing = PERSONAS[persona_key]
    body = {
        "session_id": f"s_test_baskets_{persona_key}",
        "persona": framing,
        "cart": [{"sku_id": sid, "qty": 1} for sid in sku_ids],
        "history_category_ids": persona_data["history_category_ids"],
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
    finally:
        time.sleep(CALL_DELAY_S)


def assert_valid_mission_response(status: int, data: dict | None) -> bool:
    """True if this is a well-formed, live mission response. Deliberately
    does NOT check is_new_category counts — that assumption is exactly what
    the MIN_NEW_CATEGORY gate removal drops. A same-category-only completion
    is a legitimate pass here."""
    if status != 200 or data is None:
        return False
    if not data.get("mission"):
        return False
    suggestions = data.get("suggestions", [])
    if not (1 <= len(suggestions) <= 3):
        return False
    if data.get("confidence", 0) < 0.6:
        return False
    return True


def main():
    results = []

    print(f"Backend: {BACKEND_URL}\n")
    print("== Should produce a mission (Priya) ==")
    for label, sku_ids, hour in SHOULD_MISSION:
        status, data = call_copilot(sku_ids, hour, "priya")
        passed = status == 200 and data is not None
        results.append(passed)
        mission = data.get("mission") if data else None
        print(f"  [{'PASS' if passed else 'FAIL'}] {label:45s} status={status} mission={mission!r}")

    print("\n== Should stay silent (Priya) ==")
    for label, sku_ids, hour in SHOULD_SILENCE:
        status, data = call_copilot(sku_ids, hour, "priya")
        passed = status == 204
        results.append(passed)
        print(f"  [{'PASS' if passed else 'FAIL'}] {label:60s} status={status}")

    print(
        "\n== Gate regression: same basket, both personas "
        "(new-category for Priya / known-category for Ishaan) =="
    )
    for label, sku_ids, hour in GATE_REGRESSION_PAIRS:
        for persona_key in ("priya", "ishaan"):
            status, data = call_copilot(sku_ids, hour, persona_key)
            passed = assert_valid_mission_response(status, data)
            results.append(passed)
            mission = data.get("mission") if data else None
            print(
                f"  [{'PASS' if passed else 'FAIL'}] {label:40s} ({persona_key:6s}) "
                f"status={status} mission={mission!r}"
            )

    print("\n== Pharma sub-cluster baseline (new for both personas) ==")
    for label, sku_ids, hour in PHARMA_BASELINE:
        status, data = call_copilot(sku_ids, hour, "priya")
        passed = assert_valid_mission_response(status, data)
        results.append(passed)
        mission = data.get("mission") if data else None
        print(f"  [{'PASS' if passed else 'FAIL'}] {label:45s} status={status} mission={mission!r}")

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
