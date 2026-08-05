# architecture.md — Mission Completion Copilot

## 1. System overview

```
┌─────────────────────────── Vercel (hobby, ₹0) ───────────────────────────┐
│ Next.js 14 App Router (TypeScript, Tailwind, Framer Motion, Zustand)      │
│  • All catalog/browse/cart/checkout logic runs CLIENT-SIDE from a         │
│    statically-bundled catalog.json  → works even if backend is asleep     │
│  • MapLibre GL + OSM raster tiles; Nominatim reverse-geocode (pin-drop)   │
│  • Calls backend ONLY for: /copilot, /events, /metrics, /order            │
└──────────────────────────────┬────────────────────────────────────────────┘
                               │ HTTPS JSON (CORS: vercel domain only)
┌──────────────────────────────▼───────────── Render (free, ₹0) ───────────┐
│ FastAPI + Uvicorn (Python 3.12)                                           │
│  • POST /copilot   → candidate filter → Groq → validate → respond         │
│  • POST /events    → append to SQLite (ephemeral OK)                      │
│  • GET  /metrics/{session} → funnel aggregation                           │
│  • POST /order     → order id + echo (sim)                                │
│  • GET  /health    → uptime pinger target                                 │
└──────────────────────────────┬────────────────────────────────────────────┘
                               │ HTTPS
                        Groq Cloud API (free tier)
                        primary: llama-3.3-70b-versatile (JSON mode)
                        fallback: llama-3.1-8b-instant (on 429/timeout)
```

Design principle: **the backend is optional for everything except intelligence.** Cart, checkout, and success must complete with the backend down (order id then generated client-side, events queued in localStorage and flushed later).

## 2. Repo structure (monorepo)

```
/frontend                  # Next.js — deployed to Vercel (root dir setting)
  /app                     # routes: /(location) /home /c/[cat] /cart /checkout /success
  /components              # ProductCard, Stepper, MissionModule, TrustChip, Sheet…
  /lib/catalog.ts          # loads bundled catalog.json, category helpers
  /lib/store.ts            # Zustand: cart, profile, session, event queue
  /lib/api.ts              # backend client w/ timeouts + offline fallbacks
  /public/img              # WebP product images
  tokens.css
/backend                   # FastAPI — deployed to Render (root dir setting)
  main.py                  # routes
  copilot.py               # prompt build, Groq call, validation
  prompts.py               # system prompts (householder / experimenter blocks)
  models.py                # Pydantic schemas (mirror datamodel.md)
  events.py                # SQLite append + funnel query
  data/catalog.json        # SAME file as frontend copy (sync via script)
/shared/catalog.json       # source of truth; copied to both at build (npm script)
/scripts/seed_catalog.py   # generates catalog.json from a CSV
```

## 3. API contracts

### POST /copilot
Request:
```json
{
  "session_id": "s_abc",
  "persona": "householder | experimenter",
  "cart": [{"sku_id": "sku_pasta_01", "qty": 2}],
  "history_category_ids": ["staples","snacks","dairy"],
  "dismissed_sku_ids": ["sku_x"],
  "local_hour": 20
}
```
Response 200:
```json
{
  "mission": "Tonight's pasta dinner",
  "confidence": 0.86,
  "suggestions": [
    {
      "sku_id": "sku_garlicbread_01",
      "why": "Garlic bread turns this into the full meal",
      "trust_facts": [{"type":"expiry","label":"Expiry Nov 2026"},
                       {"type":"ingredient","label":"Whole wheat, no maida"}],
      "price_anchor": "₹99 here · ~₹110 at BigBasket",
      "protected_trial": true,
      "is_new_category": true
    }
  ],
  "latency_ms": 640,
  "model": "llama-3.3-70b-versatile"
}
```
Response 204: silence (confidence < 0.6 or no coherent anchor). Frontend renders nothing.
Errors: any non-2xx or >2.5s client timeout → frontend renders nothing.

### POST /events
`{"session_id","ts","type","payload"}` — types: `suggestion_shown|suggestion_tapped|suggestion_added|suggestion_removed|module_dismissed|not_relevant|checkout_started|order_placed|copilot_latency`. Accepts arrays (batch flush). Always 202.

### GET /metrics/{session_id}
Funnel counts + latency p95 for the drawer.

### POST /order
Request: cart + totals → Response: `{"order_id":"IM-20260804-XXXX","placed_at":…}`. Pure echo/sim.

## 4. Copilot pipeline (backend, `copilot.py`)

1. **Candidate filter (code, not model):** eligible = catalog SKUs where `category_id ∉ history_category_ids` and `sku_id ∉ dismissed`. Also build "context SKUs" = same-category complements. Cap the slice sent to Groq at ~40 SKUs (id, name, category, tags, price, anchor_price, trust_facts) to keep prompt small/fast.
2. **Prompt:** system = role + guardrails + persona block (trust-led vs deal-led framing) + output JSON schema; user = cart, hour, candidate slice. `response_format={"type":"json_object"}`, temperature 0.4, max_tokens 500.
3. **Validation (Pydantic):** drop suggestions whose sku_id isn't in the candidate slice; enforce ≤3; recompute `is_new_category` server-side from history (ignore model's claim) — no minimum new-category count is enforced, a same-category-only completion is a valid response, category expansion is preferred at the prompt level and measured via events, not gated here; why ≤12 words (truncate at word boundary); trust_facts must come from catalog metadata — replace model-authored facts with catalog facts by sku_id (the model chooses which 2–3 to surface via fact ids, it never writes fact text).
4. **Silence rule:** confidence <0.6, or zero valid suggestions after filtering → 204.
5. **Cache:** in-memory dict keyed by hash(persona+sorted cart sku_ids+dismissed) — repeat baskets are instant; also softens Groq rate limits.
6. **Fallback chain:** 70B timeout(2.0s)/429 → 8B-instant retry(1.0s) → 204.

Guardrail summary (enforced in code where possible, prompt where not): no invented facts (code), price anchors from catalog only (code), no unqualified "better/healthier" (prompt + regex screen), ≤3 suggestions (code), silence over noise (code).

## 5. Deployment & ops

**Vercel:** project root `/frontend`; env `NEXT_PUBLIC_API_URL`; build copies `/shared/catalog.json` in. Vercel Analytics on (free).
**Render:** web service root `/backend`; `uvicorn main:app --host 0.0.0.0 --port $PORT`; env `GROQ_API_KEY`, `ALLOWED_ORIGIN`. Free instance, SQLite at `./data/events.db` (ephemeral across deploys — acceptable; note in README).
**Cold-start mitigation:** cron-job.org or UptimeRobot GET /health every 10 min through judging window. Frontend additionally fires a fire-and-forget `/health` ping on app load, so by the time a user reaches cart the service is warm.
**Escape hatch:** copilot.py + events kept framework-thin; if Render free tier misbehaves, port both routes to Vercel serverless functions (<1 hr — Python via vercel-python or rewrite in TS calling Groq's OpenAI-compatible endpoint).
**Secrets:** Groq key only on backend. Never shipped to client.
**CORS:** allow only the Vercel prod + preview domains.

## 6. Performance budgets

| Path | Budget |
|---|---|
| Home LCP (4G throttle) | <2.0s |
| Copilot p95 (warm backend) | ≤1.5s end-to-end |
| Copilot debounce | 800ms after last cart mutation |
| Client timeout on /copilot | 2.5s hard |
| Bundle (first load JS) | <180KB gz |
| Product image | ≤40KB WebP |

## 7. Env & config matrix

| Var | Where | Notes |
|---|---|---|
| GROQ_API_KEY | Render | free tier |
| GROQ_MODEL / GROQ_FALLBACK | Render | defaults per above |
| ALLOWED_ORIGIN | Render | Vercel URL |
| NEXT_PUBLIC_API_URL | Vercel | Render URL |
| NEXT_PUBLIC_DEMO_PERSONA_TOGGLE | Vercel | enables Priya/Ishaan switch (P1) |
