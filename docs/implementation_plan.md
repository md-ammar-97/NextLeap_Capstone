# implementation_plan.md — Mission Completion Copilot

Dependency-ordered build plan. Deadline: **Aug 4, 2026.** Source docs (do not contradict, only operationalize): `Problem-Statement-Mission-Completion-Copilot.md`, `context.md`, `architecture.md`, `datamodel.md`, `design.md`, `edgecases.md`.

## 0. How to use this document

Execute top-to-bottom. Each **Checkpoint** is a `git commit` and a state you could submit as-is if all remaining time evaporated. If time collapses mid-build, stop and jump to §7 Risks & Cut Order rather than improvising — the cut order is pre-decided so no time is spent debating it under pressure.

Two scope decisions were made explicitly (not in the source docs, resolved with the user before this plan was written) and apply throughout:

- **Images:** real open-license/press images only for SKUs that actually appear in copilot suggestion cards or are one of the 5 mandatory callback SKUs (~10–15 total). Everything else in the ~120-SKU catalog renders a code-generated placeholder tile: category-tinted background, Lucide icon for the category, veg/non-veg dot. No stock-photo sourcing pipeline, no per-SKU asset hunting.
- **Catalog authorship:** the coding agent authors the full SKU list directly against the schema in `datamodel.md` §2, including realistic Indian grocery names/prices/tags — same as any fixture-seeding task. The user does one spot-check pass after Pre-Flight, not upfront authorship.

## 1. Ground rules

From `context.md` §8 — restated here once so later phases reference instead of re-litigate:

**Decision priority when anything is unspecified:** (1) checkout robustness → (2) perceived smoothness → (3) Instamart visual fidelity → (4) AI demo value → (5) code elegance.

**Cut order if time collapses:** OSM location screen → metrics drawer UI (keep raw event log, drop the drawer UI) → persona toggle. **Never cut:** working checkout (P0-2), the live Groq mission module (P0-3), silence/failure behavior (P0-6).

## 2. Pre-Flight — before Phase 1 starts

| # | Item | Owner | Gates |
|---|---|---|---|
| 1 | `tokens.css` populated from `design.md` §1's hypothesis values (already concrete hex/radii/shadows/type scale) | Agent | Phase 1.1 — proceeds immediately, do not wait on real screenshot extraction. If the user supplies real Instamart screenshots before Phase 3, treat it as a single-file token-value patch then, not a gate now. |
| 2 | Author `/shared/catalog.json` source data (120 SKUs, 12 categories) + `scripts/seed_catalog.py` + `priya.json` / `ishaan.json` persona profiles, per the image/authorship decisions in §0 | Agent | Blocks Phase 1.5 (screens need real data) |
| 3 | Create Groq API key at console.groq.com | **User** | Blocks Phase 2 start — flag this immediately, it's the only hard external dependency in the whole build |
| 4 | Confirm Vercel + Render account access; decide final service names now (e.g. `instamart-copilot`, `instamart-copilot-api`) so both URLs are known before either deploy | Both | Phase 5.8 deploy — fixing names now avoids a CORS redeploy loop later |

**Catalog data-shape note:** author `/shared/catalog.json` directly as JSON matching `datamodel.md` §1–2 (skip an intermediate CSV — it adds a parsing step for no benefit here since the agent is authoring the data directly, not transcribing from an external list). `seed_catalog.py` becomes a validation/regeneration script, not a required step. Must include the 5 mandatory callback SKUs verbatim: whole-wheat atta + maida pair (staples), micellar water (beauty), USB-C charger (electronics), melatonin gummies (pharma), party supplies set (party_gifting) — each gets a real image per the hybrid-image rule since they're demo moments.

## 3. Phase 1 — Shell (client-only, offline-capable, non-AI flow)

Principle from `architecture.md` §1: the backend is optional for everything except intelligence. Build the client-only path first — it's both the correct dependency order and the best deadline hedge, since Checkpoint 1 is a submittable fallback if Phases 2–3 run out of time.

1. **1.1 Repo scaffold** — `/frontend` (Next.js 14 App Router, TypeScript, Tailwind, Framer Motion, Zustand), `/shared/catalog.json` placeholder, `.env.example`, `tokens.css` wired into `tailwind.config`, Plus Jakarta Sans loaded. `git init`, first commit (six docs + this plan + scaffold).
2. **1.2 `lib/catalog.ts`** — loads bundled catalog, `getSkuById`, `getCategoryById`, category/tag filter helpers.
3. **1.3 `lib/store.ts`** — Zustand: cart slice (`CartLine[]`, `cart_hash`, `dismissed_sku_ids`, `module_dismissed_hashes`, localStorage-persisted per `datamodel.md` §4), session slice (mint `session_id` = `s_` + nanoid to `sessionStorage` on first load per §8), persona slice (priya default, ishaan toggle). Build early — nearly every screen depends on it.
4. **1.4 Reusable primitives** — `ProductCard` (image-or-placeholder tile, veg dot, discount chip, price row per `design.md` §2), `AddStepper` (morph animation), `CategoryTile`, `Skeleton` (shimmer), generic `BottomSheet` (spring physics, reused by PDP, Protected Trial sheet).
5. **1.5 Screens, in order:**
   - **Home** — gradient header, search bar (static placeholder only — real fuzzy search + "charger" easter egg is P1, don't build now), category rail, promo carousel, "Order Again" row seeded from persona history, product grid.
   - **Listing** — sticky category chips, 2-col grid.
   - **PDP sheet** — image/placeholder, price, description, full trust-chip section (works for any SKU, not just suggestions).
   - **Cart** — line items + steppers, bill summary (derived totals per `datamodel.md` §4: item_total, handling ₹2, delivery FREE, gst_sim), **Mission Module slot stubbed empty** (real UI comes in Phase 2).
   - **Checkout** — address confirmation (static for now, OSM comes in Phase 3), fake payment method list, "Place order" → **client-side `IM-LOCAL-xxxx` order-id generation built as the primary path**, not a fallback bolted on later (this is what makes `edgecases.md` #17 — backend fully down — true by construction rather than by patch).
   - **Success** — confetti, order summary, "View session metrics" link (stubbed until Phase 3).
6. **Checkpoint 1:** full non-AI flow demoable end to end (browse → add → cart → checkout → success), zero network calls, works with backend never having existed. Commit + tag `checkpoint-1-shell`.

## 4. Phase 2 — Copilot (backend + Groq integration)

1. **2.1 `/backend` skeleton** — FastAPI app, CORS via `ALLOWED_ORIGIN` env, `GET /health` first (trivial, unblocks the Phase 5 pinger setup early), `models.py` (Pydantic schemas verbatim from `datamodel.md` §5: `TrustFact`, `Suggestion`, `CopilotResponse`), load `catalog.json` at startup.
2. **2.2 `events.py` + `POST /events`** — SQLite `events` table exactly per `datamodel.md` §7, always returns 202, accepts single or batched events. Built before `/copilot` deliberately: lower risk, and the `copilot_latency` event type is emitted by the pipeline built next, so this needs to exist first.
3. **2.3 `prompts.py`** — system prompt = role + guardrails (no invented facts, no unqualified "better/healthier", why-lines ≤12 words, price anchors from catalog only) + persona block (trust-led for householder / deal-led for experimenter, per `context.md` §5 and `architecture.md` §4.2). Internal model-output contract is the **smaller** shape from `datamodel.md` §5: `{mission, confidence, picks:[{sku_id, why, fact_ids}]}` — the model never authors trust-fact text, prices, or badges.
4. **2.4 `copilot.py`** — in order:
   - Candidate filter as a **pure function**, unit-sanity-checked in isolation before any Groq call: eligible = `category_id ∉ history_category_ids` and `sku_id ∉ dismissed_sku_ids`; cap the slice sent to the model at ~40 SKUs (id, name, category, tags, price, anchor_price, trust_facts) per `architecture.md` §4.1.
   - Prompt builder → Groq call (`response_format={"type":"json_object"}`, temperature 0.4, max_tokens 500).
   - Fallback chain: `llama-3.3-70b-versatile` (2.0s timeout) → on timeout/429, `llama-3.1-8b-instant` (1.0s retry) → on failure, HTTP 204.
   - JSON repair: one strip-fences-and-retry-parse attempt on invalid JSON, else 204 (`edgecases.md` #3).
   - Pydantic validation / server-side authority (never trust the model's claims here): drop any `sku_id` not in the candidate slice; if <1 valid suggestion remains, 204; cap at 3; **recompute `is_new_category` from `history_category_ids` server-side**, ignore the model's claim; enforce ≥2 `is_new_category` among final suggestions or 204; truncate `why` at word boundary if >12 words; expand `fact_ids` into full `TrustFact` objects using **catalog-sourced labels only**, never model-authored text; regex-screen for unqualified superlatives ("better", "healthier", "best") and strip the offending sentence or drop the card.
   - Silence rule: `confidence < 0.6` → 204, regardless of anything else (`edgecases.md` #8 — never lower the bar to force a demo).
   - In-memory cache keyed by `hash(persona + sorted cart sku_ids + dismissed_sku_ids)`.
5. **2.5 Wire `POST /copilot`** in `main.py` per the exact request/response contract in `architecture.md` §3.
6. **Backend-alone checkpoint:** curl/Postman the live endpoint directly with sample payloads — happy path, forced-low-confidence path, forced-invalid-sku path, forced-timeout path — *before* touching the frontend. Isolates backend logic bugs from integration bugs.
7. **2.6 `lib/api.ts`** — 2.5s hard client timeout, `AbortController` so a stale in-flight request is cancelled when the cart mutates again (`edgecases.md` #15 — only the latest cart-hash response ever renders), any non-2xx/timeout/network-error → render nothing, fire-and-forget `/health` ping on app load (pre-warms Render before the user reaches cart).
8. **2.7 UI:** `MissionModule` (gradient border, shimmer-once mission-line reveal, horizontal snap-scroll suggestion cards per `design.md` §2), `TrustChip`, Protected Trial badge + tap-to-explain sheet (copy verbatim from `design.md` §5) — wired into Cart's Phase-1 stub slot. Trigger: 800ms debounce after cart mutation, also on cart-screen open (`Problem-Statement.md` §5.3). "Not now" dismiss (hides module for that `cart_hash` this session) and per-card "Not relevant" (adds to `dismissed_sku_ids`, 150ms collapse) both log events.
9. **Checkpoint 2:** full AI loop working end-to-end locally — mission renders on a coherent anchor, silence verified on an incoherent single-SKU basket, failure path verified by killing the backend process mid-session (cart/checkout still work). Commit + tag `checkpoint-2-copilot`.

## 5. Phase 3 — Polish, instrumentation, deploy

1. **5.1 Event instrumentation** — all 9 types from `datamodel.md` §7 fired at the right UI moments; localStorage queue with backoff retry, capped at 200 events, drop-oldest on overflow (`edgecases.md` #34).
2. **5.2 `GET /metrics/{session_id}`** — funnel counts + `p95(latency_ms)` from `copilot_latency` events + `new_category_added` distinct-SKU count, per `datamodel.md` §7.
3. **5.3 Metrics drawer UI** — deliberately plain/data-dense, *not* Instamart-styled (per `design.md` §3.8 — this is intentional, signals "instrumentation not product"). Zero-interaction state shows zeros + one-line explainer, not an error (`edgecases.md` #35).
4. **5.4 OSM location screen** — MapLibre + raster OSM tiles, Nominatim reverse-geocode only on pin-drop-end (600ms debounce, proper User-Agent header, respects 1 req/s policy), geolocation-denied defaults to Bengaluru, "Use default address" skip link after 3s if tiles are slow (`edgecases.md` #25–28).
5. **5.5 (P1, only if ahead of schedule) Persona toggle** — Priya ↔ Ishaan; on switch, clear copilot cache + `dismissed_sku_ids`, swap `history_category_ids`/framing, cart persists (`edgecases.md` #39).
6. **5.6 Lighthouse pass** — mobile Performance ≥90, CLS <0.05, LCP <2s on 4G throttle; fix largest offenders only (image sizing, font loading, unused JS) — don't chase a perfect score.
7. **5.7 Superlative regex screen spot-check** — confirm §4.4's guardrail actually strips content, not just theoretically exists.
8. **5.8 Deploy sequencing** — service names were fixed in Pre-Flight, so both URLs are known before either deploy: deploy Render first (`root: /backend`, `uvicorn main:app --host 0.0.0.0 --port $PORT`, env `GROQ_API_KEY` + `ALLOWED_ORIGIN` set to the *already-known* Vercel URL), verify `GET /health` responds, **then** deploy Vercel (`root: /frontend`, env `NEXT_PUBLIC_API_URL` set to the live Render URL). No redeploy loop because nothing is guessed.
9. **5.9 Cold-start pinger** — **Owner: User**, ~5 min task: point cron-job.org or UptimeRobot at the live `/health` URL, ping every 10 min through the judging window.
10. **5.10 Mobile QA** — Chrome DevTools device emulation as the first, required pass (360px viewport per P0-1, `dvh` units, momentum scroll on the suggestion rail). Real-device Safari iOS check is **best-effort / Owner: User** if a physical device is available — emulation cannot fully verify iOS `100vh` quirks or drag-to-dismiss feel (`edgecases.md` #32).
11. **Checkpoint 3 (final):** both services live and pinged, full flow works on a real mobile browser against production URLs.

## 6. Verification / QA

Manual pass — the source docs never call for an automated test suite, and there's no time to build one. Work through in order:

**A. P0 acceptance criteria** (`Problem-Statement.md` §7) — run each as a literal step against the deployed app:
- P0-1: side-by-side screenshot vs. real Instamart app at 360px — palette/card-anatomy/spacing match.
- P0-2: add items → checkout → correct bill math incl. GST line; kill backend mid-flow → checkout still completes.
- P0-3: add a coherent anchor → mission + ≤3 suggestions render within 1.5s, ≥2 from never-purchased categories.
- P0-4: see §6B below.
- P0-5: Protected Trial badge present on every first-category suggestion; tap opens the explainer sheet.
- P0-6: incoherent basket → no module; force an LLM error → no module, checkout unaffected.
- P0-7: perform a full session, then confirm the metrics drawer's funnel numbers match what actually happened.
- P0-8: confirm public URLs load on mobile Chrome and Safari.
- P0-9: confirm "Order Again" row is populated and matches the seeded persona history; confirm copilot suggestions never repeat a history category.

**B. P0-4 spot-check matrix (20+ generations — methodology not specified in source docs, defined here):**
Run these cart scenarios across both personas (repeat scenarios for Ishaan where his history differs meaningfully) to reach ≥20 total generations: (1) classic anchor — pasta only; (2) atta + maida pair anchored together; (3) micellar water category probe; (4) USB-C charger anchored alone; (5) melatonin gummies anchored alone; (6) party supplies set anchored; (7) incoherent single random SKU (expect silence); (8) basket spanning several unrelated missions at once (expect one strongest mission, never two); (9) 15 unrelated items (adversarial — expect silence, this is correct behavior per `edgecases.md` #40, not a bug); (10) Ishaan with a temporarily-simulated full-12-category history (expect empty candidate filter → 204); (11) identical basket submitted twice (expect second response served from cache, near-instant). For every generation, check off: mission is sensible for the cart / silence gating correct / ≤3 suggestions / ≥2 marked new-category / why-line ≤12 words / no invented or superlative claims / trust chips match the SKU's category `risk_tier` template / price anchor shown only when the SKU has `anchor_price` in the catalog / Protected Trial badge only on new-category suggestions.

**C. edgecases.md sweep** — walk all 40 cases by their existing 6 groupings (Copilot/LLM #1–16, Cart & checkout #17–24, Maps/location #25–28, Performance/device #29–32, Sessions/events/metrics #33–36, Content & safety #37–40). Expected behavior for each is already fully specified in that file — this pass is purely "trigger it, confirm it matches," not re-deriving anything.

## 7. Risks & contingencies

- **Cut order** (restated from §1): OSM screen → metrics drawer UI (keep the raw event log, drop only the drawer) → persona toggle. Never cut checkout, the live mission module, or silence/failure behavior.
- **Render escape hatch:** if the free-tier Render service is unreliable (won't wake, erroring) with no time left to debug — trigger point: roughly hour 8 of the original phasing with the issue still unresolved — port `POST /copilot` and `POST /events` to Vercel serverless functions instead. `copilot.py` and `events.py` were built framework-thin specifically so this is a <1hr port (Python via a Vercel Python runtime, or a straight rewrite calling Groq's OpenAI-compatible endpoint from TypeScript).
- **SQLite ephemerality on Render's free disk** is accepted-by-design, not a bug — note it plainly in the README rather than engineering around it.
- **Groq rate limits:** the debounce + cache + 8B fallback chain already absorbs this; if 429s still appear during judging, that's a signal to widen the debounce, not to add new infrastructure.

## 8. Submission checklist

- Public Vercel URL + Render URL both live, cold-start pinger active and confirmed firing.
- README covering: setup/run instructions, the ephemeral-SQLite note, and the legal/design-emulation disclaimer verbatim from `design.md` §6 ("non-commercial academic prototype emulating Instamart's design language... all trademarks © Swiggy Ltd").
- Deck talking points cross-referenced against the traceability footnote closing `Problem-Statement-Mission-Completion-Copilot.md` (P0-3↔mission-mode/awareness, P0-4↔information vacuum, P0-5↔trust erosion, persona framing↔wedge sequencing, metrics↔Successful Category Expansion Rate) — the demo narrative should trace back to the underlying research, not just show working software.
