"""Pre-warms backend/copilot.py's in-memory suggestion cache with the exact
basket states the U6 demo script (docs/update.md) walks through, so nothing
a judge does on the scripted path waits on a live Groq call.

IMPORTANT - re-run this after your *final* pre-judging deploy, not once in
advance: the cache is a plain in-process dict with no persistence or TTL
(see backend/copilot.py's `_cache`), so it's wiped on every Render redeploy
and only warms whichever instance actually served the request (fine here
since the service runs a single instance, but re-verify if that ever
changes). Also confirm ALLOWED_ORIGIN doesn't block a bare script call -
this backend has no CORS restriction on non-browser requests, only browser
preflight is origin-gated, so a plain HTTP POST (stdlib urllib, no extra
dependency needed) works regardless.

Usage: python scripts/prewarm_demo.py [backend_url]
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
with open(os.path.join(SHARED, "ishaan.json"), encoding="utf-8") as f:
    ISHAAN = json.load(f)

PASTA_CART = [{"sku_id": "sku_pasta_01", "qty": 1}, {"sku_id": "sku_pasta_sauce_01", "qty": 1}]


def call_copilot(label: str, persona_key: str, profile: dict, cart: list, dismissed: list) -> dict | None:
    body = {
        "session_id": f"s_prewarm_{label}",
        "persona": persona_key,
        "cart": cart,
        "history_category_ids": profile["history_category_ids"],
        "dismissed_sku_ids": dismissed,
        "local_hour": 19,
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
                print(f"[{label}] 204 silence (no suggestions to cache)")
                return None
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 204:
            print(f"[{label}] 204 silence (no suggestions to cache)")
            return None
        print(f"[{label}] FAILED: HTTP {e.code} - {e.reason}")
        return None
    except Exception as e:
        # Best-effort warmup script - one slow/failed call (e.g. Groq
        # transient latency past the timeout) shouldn't abort the rest.
        print(f"[{label}] FAILED: {e}")
        return None
    print(f"[{label}] cached - mission={data['mission']!r} suggestions={[s['sku_id'] for s in data['suggestions']]}")
    return data


def main():
    # 1) Steps 4-5: classic pasta-dinner anchor, Priya (trust-led)
    step5 = call_copilot("priya_pasta", "householder", PRIYA, PASTA_CART, [])

    if step5 and step5["suggestions"]:
        suggested_ids = [s["sku_id"] for s in step5["suggestions"]]
        # 2) Step 6: "not relevant" on the first suggestion card
        call_copilot("priya_pasta_dismissed", "householder", PRIYA, PASTA_CART, [suggested_ids[0]])
        # 3) Step 7: add a second suggested (new-category) item to the cart
        if len(suggested_ids) > 1:
            cart_plus = PASTA_CART + [{"sku_id": suggested_ids[1], "qty": 1}]
            call_copilot("priya_pasta_plus_new_category", "householder", PRIYA, cart_plus, [])

    # 4) Step 10: same pasta basket, Ishaan (deal-led reframing)
    call_copilot("ishaan_pasta", "experimenter", ISHAAN, PASTA_CART, [])

    # 5-6) The two callback SKUs a judge is likely to try from the U1 search
    # page's own suggestion chips (docs/context.md callbacks)
    call_copilot("priya_micellar", "householder", PRIYA, [{"sku_id": "sku_micellar_water_01", "qty": 1}], [])
    call_copilot("priya_melatonin", "householder", PRIYA, [{"sku_id": "sku_melatonin_gummies_01", "qty": 1}], [])


if __name__ == "__main__":
    main()
