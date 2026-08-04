# improve.md — Fixing copilot coverage (why it only works for coffee & rice)

## The diagnosis

Observed symptom: the copilot infers a mission for coffee (breakfast) and rice (lunch), but stays silent or misses for most other baskets — including the flagship pasta demo.

Root cause: **the candidate list sent to the model is static and truncated.** `catalog.candidate_slice()` builds `eligible + context` in catalog order and takes the first 40. For Priya (history = staples, snacks, dairy, household) that is always, regardless of cart:

| In the slice (40) | Never in the slice (80) |
|---|---|
| beverages ×10, fresh ×10, beauty ×10, baby ×10 | pharma, electronics, party_gifting, pet (40 eligible SKUs) **and all 40 known-category context SKUs** |

Four consequences:

1. **Four categories are permanently unreachable** — melatonin gummies, the USB-C charger, party supplies and pet items can never be suggested to Priya. Half the research-callback SKUs are invisible to the AI.
2. **Zero known-category items reach the model.** Context SKUs are appended after all 80 eligible ones and are entirely cut by the cap, so basket *completion* is impossible by construction.
3. **The pasta demo cannot work.** Penne and pasta sauce are `staples`, garlic bread is `snacks`, cheese is `dairy` — all Priya's known categories, all cut. The model is asked to complete an Italian dinner using only beverages, produce, beauty and baby products, and correctly returns low confidence.
4. **Coffee and rice work by accident** — their natural completions (milk-adjacent beverages, fresh vegetables) happen to sit in the two surviving categories.

Two compounding issues:

5. **No retrieval step exists.** Nothing in the slice depends on the cart, so the model does all the matching itself against an arbitrary 40 — a needle-in-haystack task it was never given the haystack for.
6. **Thin metadata.** `complements` is populated on 20/120 SKUs; tags average 2.4 per SKU. Even with retrieval added, there's little to retrieve on.
7. **The `MIN_NEW_CATEGORY = 2` rule forces silence.** When the honest answer is one new-category item plus two known-category completers, the entire response is discarded and the user sees nothing.

---

## Fix 1 — Cart-aware candidate scoring (`backend/catalog.py`) · HIGHEST IMPACT

Replace `candidate_slice()` with a relevance-scored selection.

```python
def candidate_slice(cart_sku_ids, history_category_ids, dismissed_sku_ids, cap=30):
    """Score every in-stock SKU against the current cart, then assemble a
    slice that is (a) relevant, (b) guaranteed to represent every
    never-purchased category, (c) mixed new/known so mission completion
    is possible. Replaces the old static catalog-order truncation."""
```

**Scoring** (per candidate SKU, against the union of cart SKUs):

| Signal | Points | Notes |
|---|---|---|
| Candidate listed in a cart SKU's `complements` (or vice versa) | +10 | strongest, curated signal |
| Shared mission tag (`dinner`, `breakfast`, `party`…) | +6 each | capped at +12 |
| Shared ordinary tag (`italian`, `pasta-complement`…) | +4 each | capped at +12 |
| Same `category_id` as a cart item | +2 | mild — completion often crosses categories |
| Time-of-day match (`breakfast` tag & hour 6–11; `dinner` & 18–23; `late-night` & 23–3) | +3 | uses `local_hour` already in the request |
| Candidate is in a never-purchased category | +2 | gentle thumb on the scale, not a mandate |
| SKU already in cart | exclude | never suggest what they've added |
| `out_of_stock` or in `dismissed_sku_ids` | exclude | unchanged |

**Assembly** (cap 30, order matters):
1. Take the top 18 by score from never-purchased categories.
2. Take the top 8 by score from known categories (the completion slots — this is what makes pasta→garlic bread possible).
3. **Guarantee coverage:** for every never-purchased category not yet represented, force in its single highest-scoring SKU (~4 slots). This is what makes pharma/electronics/party/pet reachable at all.
4. Shuffle deterministically (seed = cart hash) so position bias doesn't always favour the same category, then cap at 30.

Keep the cap at 30, not 40 — a shorter, *relevant* list beats a longer arbitrary one, and it lowers latency.

**Also:** drop SKUs with score 0 *unless* they're a coverage guarantee — feeding the model junk invites forced picks.

## Fix 2 — Loosen the new-category quota (`backend/copilot.py`)

- `MIN_NEW_CATEGORY = 2` → `1`.
- Keep `MAX_SUGGESTIONS = 3`.
- Move the preference into the prompt (already partly there): "prefer 2 or more [NEW CATEGORY] picks where they genuinely fit; one is acceptable if that's the honest answer."
- Rationale: silence should mean *no good answer*, not *no good answer that satisfies a quota*. The Part 3 metric counts new-category purchases, and one relevant suggestion converts better than three forced ones.

## Fix 3 — Catalog metadata pass (`shared/catalog.json`) · HIGHEST LEVERAGE PER HOUR

The retrieval in Fix 1 is only as good as the tags it matches on. Every one of the 120 SKUs needs:

**a) 5–8 tags**, including at least one **mission tag** from this closed vocabulary (keep it closed — free-form tags won't match across SKUs):

```
breakfast · lunch · dinner · late-night · tea-coffee-time
party · festival · guests · gifting
cleaning · laundry · kitchen-restock
baby-care · pet-care · personal-care · grooming
wellness · sleep · immunity · first-aid
desk-setup · travel · monsoon · summer
```

**b) `complements` filled on all 120** (currently 20). 2–4 SKU ids each, both directions. These are your curated "this genuinely goes with that" links and carry the most scoring weight.

**c) Sanity pairs to guarantee the demo moments:**

| Anchor | Must complement to |
|---|---|
| Penne Pasta / Pasta Sauce | Garlic Bread (snacks), Aged Hard Cheese (dairy), Garlic Pods (fresh) |
| Instant Coffee | milk (dairy), biscuits (snacks), Melatonin Gummies for late-hour (pharma) |
| Basmati Rice | dal/spices (staples), fresh vegetables, curd (dairy) |
| Diapers / baby food | wipes, rash cream (baby), disposal bags (household) |
| Party snacks / beverages | party supplies, gifting (party_gifting), disposable plates (household) |
| Floor cleaner | gloves, scrubber, garbage bags (household), fresh-air spray |
| Phone charger | cable, power bank (electronics), late-night snacks |
| Protein/health food | Melatonin Gummies, vitamins (pharma), shaker (electronics/home) |
| Micellar water | cotton pads, moisturiser (beauty) |

Do this with a script pass (`scripts/enrich_catalog.py`) that writes tags/complements from a hand-written mapping table, then re-sync to `frontend/lib/catalog-data.json` and `backend/data/catalog.json`. Budget ~1 hour; it is the difference between a demo that works on two baskets and one that works on twenty.

## Fix 4 — Prompt adjustments (`backend/prompts.py`)

- Tell the model the list is **pre-filtered for relevance**, so it should pick the best fit rather than hunt: "The candidates below have already been shortlisted as plausibly related to this cart."
- Add the mission vocabulary as a hint for naming: "Name the mission in the shopper's own terms (tonight's pasta dinner, monsoon cleaning, party tonight, baby travel kit)."
- Explicitly allow known-category picks: "[known category] items are allowed and often necessary to complete a mission — pick them where they genuinely complete the job."
- Keep the silence rule and the ≤12-word factual why-line rules unchanged.

## Fix 5 — Debug endpoint (`backend/main.py`) · do this first, it makes the rest measurable

```
POST /copilot/debug  → same body as /copilot, returns:
{ "slice": [sku_id + score + reason], "raw_model_output": {...},
  "dropped": [{sku_id, reason}], "final": {...}|null, "silence_reason": "..." }
```

Gate behind an env flag (`DEBUG_COPILOT=1`). Without this you're guessing why it went quiet; with it, every silence has a named cause. Also worth screenshotting for the report — it shows evaluation rigour.

## Fix 6 — Regression check (`scripts/test_baskets.py`)

Hard-code ~15 baskets and assert the copilot returns a mission (not silence) for the ones that should work, and silence for the ones that shouldn't:

**Should produce a mission:** pasta+sauce · rice+dal · coffee alone · coffee+biscuits at 8am · diapers · floor cleaner · party snacks+cola · atta+milk · charger · protein food · micellar water · bread+eggs · dog food · festival sweets.
**Should stay silent:** single random SKU with no complements · 12 unrelated items · empty cart.

Run it against production after each deploy; paste the pass rate in the README. This is also the honest answer if a judge asks "how do you know it works?"

---

## Order of work

1. **Fix 5** (debug endpoint, ~20 min) — makes everything else observable.
2. **Fix 1** (scoring + assembly, ~45 min) — fixes the majority of misses immediately.
3. **Fix 2** (quota → 1, ~5 min).
4. **Fix 3** (catalog enrichment, ~60 min) — the quality ceiling.
5. **Fix 4** (prompt, ~10 min).
6. **Fix 6** (regression baskets, ~30 min) — proves the fix and protects it.

Re-run `scripts/prewarm_demo.py` after the final deploy (the cache is in-process and wiped on redeploy), and re-record the demo video once the pass rate looks good.

## What NOT to change

- The trust-fact injection, superlative strip, candidate-membership validation and server-side `is_new_category` recomputation — all still correct and still the differentiator.
- The silence rule itself. Widen what the model *can* see; never lower the confidence floor to manufacture output.
- The client-side catalog bundle and offline checkout path.
