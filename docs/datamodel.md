# datamodel.md — Mission Completion Copilot

Source of truth: `/shared/catalog.json` (checked into repo, copied to frontend bundle + backend at build). Runtime stores: Zustand + localStorage (client), SQLite (backend events only). No user PII anywhere.

## 1. Category

```json
{
  "category_id": "staples",
  "name": "Atta, Rice & Dal",
  "icon": "wheat",
  "risk_tier": "low | medium | high",
  "trust_template": ["expiry", "ingredient"]        // which fact types this category surfaces
}
```

Seed 12 categories across the risk continuum:

| category_id | risk_tier | trust_template |
|---|---|---|
| staples | low | expiry, ingredient |
| snacks | low | expiry, ingredient |
| beverages | low | expiry |
| dairy | medium | expiry, freshness |
| household | low | quantity |
| fresh | high | freshness, sourcing, return |
| beauty | high | authenticity, ingredient, return |
| baby | high | authenticity, expiry, return |
| pharma | high | authenticity, expiry |
| electronics | high | compatibility, warranty, return |
| party_gifting | medium | quantity |
| pet | medium | ingredient, expiry |

## 2. SKU

```json
{
  "sku_id": "sku_garlicbread_01",
  "name": "Baker's Dozen Garlic Bread",
  "category_id": "snacks",
  "unit": "250 g",
  "price": 99,
  "mrp": 115,
  "veg": true,
  "image": "/img/garlicbread.webp",
  "tags": ["italian", "dinner", "bread", "pasta-complement"],
  "description": "Stone-baked garlic bread, ready in 5 min.",
  "anchor_price": {"retailer": "BigBasket", "price": 110},   // optional; omit → no anchor line
  "trust_facts": [
    {"fact_id": "gb_exp", "type": "expiry", "label": "Expiry Nov 2026"},
    {"fact_id": "gb_ing", "type": "ingredient", "label": "Whole wheat, no maida"}
  ],
  "deal": {"label": "14% OFF", "lowest_30d": false},          // optional
  "out_of_stock": false,
  "complements": ["sku_pasta_01", "sku_sauce_01"]             // curation hint fed to prompt
}
```

Rules: `trust_facts` are the ONLY facts the copilot may surface (model selects fact_ids; server injects labels). `tags` + `complements` are the retrieval signal — write them carefully, they matter more than descriptions. ~120 SKUs / 10 per category. Mandatory research-callback SKUs: whole-wheat atta + maida pair (staples), micellar water (beauty), USB-C charger (electronics), melatonin gummies (pharma), party supplies set (party_gifting).

## 3. Persona profile (static, client-side)

```json
{
  "persona_id": "priya",
  "display_name": "Priya",
  "framing": "trust",                    // trust | deal → selects prompt block
  "history_category_ids": ["staples","dairy","snacks","household"],
  "order_again_sku_ids": ["sku_milk_01","sku_atta_ww_01","sku_bread_01", "..."]
}
```

`ishaan`: framing "deal", history covers 9 of 12 categories (leaves fresh, baby, pharma for suggestions).

## 4. Cart (Zustand + localStorage)

```ts
type CartLine = { sku_id: string; qty: number };           // qty 1–10
type CartState = {
  lines: CartLine[];
  cart_hash: string;                  // sha1(sorted sku_ids+qtys) — copilot cache key & staleness guard
  dismissed_sku_ids: string[];        // session-scope
  module_dismissed_hashes: string[];  // "Not now" per basket state
};
```

Totals are derived, never stored: item_total = Σ price×qty; handling = 2; delivery = 0; gst_sim = round(0.05×handling); to_pay = sum.

## 5. Copilot exchange

Request/response schemas as in architecture.md §3. Pydantic models:

```python
class TrustFact(BaseModel):
    type: Literal["expiry","ingredient","authenticity","freshness",
                  "sourcing","compatibility","warranty","return","quantity"]
    label: str

class Suggestion(BaseModel):
    sku_id: str
    why: str                      # ≤12 words, enforced
    trust_facts: list[TrustFact]  # 1–3, injected from catalog by fact_id
    price_anchor: str | None
    protected_trial: bool         # true iff is_new_category
    is_new_category: bool         # recomputed server-side

class CopilotResponse(BaseModel):
    mission: str
    confidence: float             # <0.6 → HTTP 204 instead
    suggestions: list[Suggestion] # 1–3; no new-category minimum (relevance-only gate)
    latency_ms: int
    model: str
```

Internal model-output contract (what Groq is asked for — smaller than the response):
```json
{"mission": "...", "confidence": 0.0, "picks": [{"sku_id": "...", "why": "...", "fact_ids": ["gb_ing"]}]}
```
Server expands picks → Suggestions (labels, anchors, badges). The model never authors facts, prices, or badges.

## 6. Order (simulated)

```json
{
  "order_id": "IM-20260804-7F3K",   // or IM-LOCAL-xxxx when offline
  "session_id": "s_abc",
  "persona_id": "priya",
  "lines": [...],
  "totals": {"item_total": 486, "handling": 2, "delivery": 0, "gst_sim": 0, "to_pay": 488},
  "new_category_sku_ids": ["sku_garlicbread_01"],
  "placed_at": "2026-08-04T20:41:00+05:30"
}
```

## 7. Event (SQLite, append-only)

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,      -- suggestion_shown|suggestion_tapped|suggestion_added|
                           -- suggestion_removed|module_dismissed|not_relevant|
                           -- checkout_started|order_placed|copilot_latency
  payload TEXT             -- JSON: sku_id?, cart_hash?, latency_ms?, failed?, model?
);
CREATE INDEX idx_events_session ON events(session_id);
```

Funnel query for /metrics/{session}: counts by type + p95(latency_ms from copilot_latency where failed=0) + `new_category_added` = distinct sku_id in suggestion_added whose category ∉ persona history.

## 8. Session

`session_id` = `s_` + nanoid, minted client-side on first load, stored in sessionStorage (new tab = new session — desirable for judging). Attached to every event and copilot call. No cookies, no auth, no PII.
