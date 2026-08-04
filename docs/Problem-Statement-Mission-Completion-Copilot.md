# Problem Statement & MVP Spec — Mission Completion Copilot
**Part 4 · AI-Native MVP · Swiggy Instamart Category-Exploration Challenge**
**Growth Team | Prototype spec v1.0 | Aug 2026**

---

## 1. Problem Statement

Habit-locked, mission-led Instamart users (4+ orders/30 days, ≥70% of spend concentrated in a narrow set of replenishment categories) confine their purchases to the same 10–20 SKUs because, inside an urgent low-attention session, the expected cost of a first trial in an unfamiliar category — financial risk from documented refund/fee failures plus evaluation effort in a price- and information-vacuum — exceeds its expected benefit. The product neither surfaces its 40+ category breadth inside the mission flow nor lowers the perceived risk of a first trial. Evidence: 1,175-record discovery-engine corpus (trust erosion, price opacity, ingredient confusion as dominant barriers) triangulated with a 6-archetype qualitative study (mission-mode usage, category-siloed trust, price-reference vacuum, awareness gap).

**Cost of not solving:** category-expansion GMV leaks to Nykaa/Amazon/1mg/kirana; non-grocery margin mix stays untapped; category breadth — the strongest retention moat in a multi-homing market — accrues to Blinkit/Zepto instead. Directional upside: ₹49–324 Cr incremental annual value across conservative→upside scenarios on Instamart's reported 13.5M MTUs.

**The intervention this MVP demonstrates:** when a user adds a familiar anchor product, an AI copilot infers the *mission* behind the basket and surfaces at most 3 cross-category items — each with a one-line relevance explanation, a category-adaptive trust card, a price anchor, and a Protected Trial badge — without adding decision time to checkout.

---

## 2. Goals

1. **Demonstrate the core loop end-to-end:** browse → add anchor SKU → mission inferred → copilot suggests ≤3 cross-category items with trust cards → add → checkout complete. Target: a first-time visitor completes this flow unaided in under 3 minutes.
2. **Prove AI-nativeness:** mission inference, suggestion selection, relevance copy, and trust-card content are generated at runtime by an LLM (Groq), not hard-coded rules. Judges can add unusual baskets and see coherent missions inferred.
3. **Prove the "inside the mission flow" principle:** copilot never blocks checkout; suggestions render in ≤1.5s p95 after cart change; checkout time with copilot ≤ checkout time without it.
4. **Look and feel indistinguishable from Instamart:** exact color tokens, typography, iconography, card layouts, and micro-animations replicated from the live app; 60fps interactions on a mid-range phone.
5. **Instrument the metrics story:** every funnel event (suggestion shown/tapped/added/removed, checkout reached) logged so the demo can display a live "Successful Category Expansion" funnel.

## 3. Non-Goals

- **No delivery-partner assignment, tracking, or post-checkout flow.** Journey ends at the order-placed confirmation screen. (Out of scope by design brief.)
- **No real payments.** Checkout simulates payment with a fake success state; no gateway integration. (Cost, compliance, and irrelevance to the hypothesis.)
- **No real user accounts / OTP auth.** A single demo profile with seeded order history (needed so the copilot has "habits" to break). (Auth adds friction to judging and zero evidence value.)
- **No real Instamart catalog scraping at runtime.** A curated static catalog of ~120 SKUs. (Legal cleanliness + zero API cost.)
- **No recommendation ML / embeddings pipeline.** The LLM + catalog metadata is the recommender. (An embedding stack is P2 architectural insurance, not v1.)
- **No dark-store inventory, serviceability, or surge logic.** One mock store, everything in stock unless flagged for demo purposes.

---

## 4. Target Users & User Stories

**Primary persona — Habit-Locked Householder (demo profile "Priya"):** 4–5 orders/week, same 15 SKUs, search-and-reorder-first, zero category breadth.
**Secondary persona — Deal-Led Experimenter (demo toggle "Ishaan"):** multi-category, deal-responsive; suggestions for him lead with price/deal framing instead of trust framing.
**Tertiary — the Judge/Evaluator:** needs to understand the hypothesis, see the AI working live, and verify smoothness in <5 minutes.

Stories (priority order):

1. As a habit-locked householder, I want the app to notice the mission behind my basket (pasta → "tonight's pasta dinner") and suggest the 2–3 items that complete it, so I finish the whole job in one order without browsing.
2. As a householder wary of unfamiliar categories, I want each suggestion to show why it's relevant, what it costs vs. what I'd pay elsewhere, and the facts that de-risk it (expiry/authenticity/ingredients), so trying it doesn't feel like a gamble.
3. As a householder burned by refund disputes, I want a visible "Protected Trial — instant replacement, no questions" badge on first-category purchases, so worst-case is defined before I pay.
4. As a deal-led experimenter, I want suggestions framed around the deal ("₹89, lowest in 30 days") rather than reassurance, so exploration feels like winning.
5. As a user in a hurry, I want to ignore the copilot entirely and check out exactly as fast as before, so the feature never costs me time.
6. As a judge, I want to build an arbitrary basket and watch the copilot infer a sensible mission live, so I can verify the AI isn't canned.
7. As a judge, I want a metrics drawer showing the exploration funnel for my session, so the success-measurement story is tangible.
8. (Edge) As a user whose basket implies no coherent mission (1 random SKU), I want the copilot to stay silent rather than force irrelevant suggestions.
9. (Edge) As a user on a flaky connection, I want the cart and checkout to work even if the LLM call fails — suggestions simply don't appear.

---

## 5. Experience Spec

### 5.1 Screens (mobile-first, single responsive web app)

1. **Splash / location** — Instamart-style launch, location pin picked on an OSM map (Leaflet/MapLibre), reverse-geocoded to a display address. Pure theater + demonstrates OSM integration; any location works.
2. **Home** — header (address, search bar), category rail (icons), promo banner carousel, "Order Again" row seeded from Priya's history, product grid. This is the habit surface.
3. **Category / listing** — grid of product cards: image, name, unit size, price, strikethrough MRP, discount chip, ADD stepper.
4. **Product detail (PDP)** — bottom-sheet style, images, price, description, and (for suggested items) the full Adaptive Trust Card.
5. **Cart** — line items with steppers, bill summary (item total, handling fee, delivery fee shown as ₹0/free for demo, GST line — transparency is on-theme), and the **Mission Completion Module** (below).
6. **Mission Completion Module** (the MVP's heart) — appears in cart and as a slide-up nudge after an anchor add:
   - Header: inferred mission in plain language — *"Completing tonight's pasta dinner?"* — with a subtle AI shimmer animation on generation.
   - ≤3 suggestion cards, horizontally scrollable. Each card: product image, name, price + price-anchor line ("₹249 here · ~₹260 at BigBasket"), one-line **why** ("Garlic bread turns this into the full meal"), trust-fact chips (category-adaptive: `Expiry: Nov 2026` / `100% authentic · brand-sealed` / `No maida — whole wheat`), and a **Protected Trial** badge with tap-to-explain sheet.
   - Dismiss control ("Not now") and per-card "Not relevant" — logged as feedback events.
7. **Checkout / payment sim** — address confirmation (OSM mini-map), payment method list (all fake), "Place order" → success.
8. **Order placed** — confetti/lottie success, order summary, **and the journey ends here**. A "View session metrics" link opens the funnel drawer (judge-facing).

### 5.2 Design fidelity requirements

- **Token extraction, not guesswork:** before build, screenshot the current Instamart app (Android) and extract exact hex values, radii, shadows, and spacing into `tokens.css`. Known anchors to verify against: Swiggy brand orange `#FC8019`, Instamart's purple/violet brand family and gradient headers, dark-green veg indicator, yellow deal chips. Treat these as starting hypotheses — the extracted values win.
- **Typography:** Instamart uses a proprietary grotesk; substitute the closest open font (Inter or Plus Jakarta Sans) with matched weights/tracking. Document the substitution in the deck.
- **Iconography:** Lucide/Phosphor icons restyled to match; category icons recreated as flat illustrations or sourced from open-license sets.
- **Micro-animations (Framer Motion / CSS):** ADD-button stepper morph, item fly-to-cart arc, cart badge bounce, bottom-sheet spring physics, skeleton shimmer on loads, mission-module entrance (slide+fade, 250ms, ease-out), success confetti. Every animation ≤300ms; nothing blocks input.
- **Performance bar ("smooth as hell"):** Lighthouse mobile ≥90 performance; 60fps scroll; all images pre-optimized WebP ≤40KB, lazy-loaded; route transitions instant via prefetch; LLM latency masked with a designed "thinking" state, never a blank spinner.
- **Legal note for the deck:** this is a non-commercial academic prototype emulating Instamart's design language for research demonstration; all trademarks belong to Swiggy Ltd. No Swiggy logo assets copied verbatim — recreate approximations.

### 5.3 Copilot behavior spec

- **Trigger:** debounced 800ms after any cart mutation; also on cart-screen open.
- **Input to LLM:** cart contents (name, category, tags), demo-profile order history, persona flag (householder/experimenter), catalog slice (only SKUs from categories the profile hasn't bought — enforced in code, not left to the model), current time of day.
- **Output (strict JSON):** `{ mission: string|null, confidence: 0–1, suggestions: [{sku_id, why, trust_facts[], price_anchor}] }` — max 3 suggestions, and **at least 2 must be from never-purchased categories** (validated server-side; invalid SKU ids dropped).
- **Silence rule:** if `confidence < 0.6` or basket has <1 coherent anchor, render nothing (story 8).
- **Persona framing:** householder → trust-led copy; experimenter → deal-led copy. Same pipeline, different system-prompt block — this demonstrates the Part 3 two-segment sequencing in one prototype.
- **Guardrails in prompt:** no invented health claims, no "better" without a stated attribute, price anchors only from catalog metadata (never hallucinated), why-lines ≤12 words.
- **Failure mode:** any LLM error/timeout (>2.5s) → module doesn't render; cart/checkout unaffected (story 9).

---

## 6. Technical Architecture

```
[Vercel — Next.js 14 (App Router) PWA]
   ├─ UI: React + Tailwind + Framer Motion, tokens.css from app extraction
   ├─ Maps: MapLibre GL JS + OSM raster tiles; Nominatim for reverse-geocode
   └─ calls ↓ (REST/JSON)
[Render — FastAPI (Python) free web service]
   ├─ /catalog, /cart, /order  → reads seed JSON / SQLite
   ├─ /copilot  → builds prompt → Groq API → validates JSON → returns
   ├─ /events   → appends funnel events (SQLite) → /metrics for the drawer
   └─ Groq: llama-3.3-70b-versatile (JSON mode); fallback llama-3.1-8b-instant
[Data] ~120-SKU curated catalog (JSON, checked into repo) across 12 categories
       spanning the risk continuum (snacks → fresh → beauty → electronics);
       images: open-license/brand press images pre-optimized to WebP.
```

**Stack decisions & rationale (all free-tier):**

| Layer | Choice | Why | Cost |
|---|---|---|---|
| Frontend | Next.js on Vercel | Edge CDN, image optimization, instant deploys | ₹0 (hobby) |
| Backend | FastAPI on Render free | Python speed-of-build; simple JSON APIs | ₹0 |
| LLM | Groq `llama-3.3-70b-versatile` | ~300+ tok/s → sub-second suggestions; generous free tier; JSON mode | ₹0 |
| Maps | MapLibre + OSM tiles + Nominatim | Zero-key, zero-cost; Nominatim used only on explicit pin-drop (respect 1 req/s usage policy) | ₹0 |
| DB | SQLite on Render disk (or plain JSON) | 120 SKUs + event log needs nothing more | ₹0 |
| Analytics | Self-logged events + optional Vercel Analytics | Owns the funnel-drawer story | ₹0 |

**Known free-tier risks & mitigations:**
- **Render cold starts (~30–50s after idle):** (a) UptimeRobot/cron-job.org ping every 10 min during judging week; (b) ship the catalog statically to the frontend so browse/cart/checkout work even while the backend wakes — only the copilot waits; (c) fallback plan: port the two API routes to Vercel serverless functions if Render misbehaves (keep handlers framework-thin so the port is <1hr).
- **Groq rate limits:** debounce triggers, cache copilot responses per cart-hash, 8B-instant fallback model on 429.
- **OSM tile usage policy:** default demo location pre-tiled/cached; map only on 2 screens.

---

## 7. Requirements

### P0 — Must-have (cannot demo without)
| # | Requirement | Acceptance criteria |
|---|---|---|
| P0-1 | Instamart-fidelity UI shell (home, listing, PDP, cart, checkout, success) | Side-by-side screenshot vs. real app: matching palette, card anatomy, spacing within visual tolerance; passes on 360px viewport |
| P0-2 | Working cart & simulated checkout | Given items in cart, when user completes checkout, then order-success renders with correct bill math (incl. GST line); flow never errors with LLM offline |
| P0-3 | Mission Completion Module (Groq) | Given ≥1 coherent anchor in cart, when 800ms elapse, then a mission line + ≤3 valid-SKU suggestions render in ≤1.5s p95; ≥2 suggestions from never-purchased categories |
| P0-4 | Adaptive trust cards | Given a suggested SKU, its trust chips match its category class (packaged→expiry/ingredients; beauty→authenticity/return; electronics→compatibility/warranty); no invented claims (spot-check 20 generations) |
| P0-5 | Protected Trial badge + explainer sheet | Badge on every first-category suggestion; tap opens plain-language guarantee copy |
| P0-6 | Silence & failure behavior | Incoherent basket → no module; LLM timeout → no module, checkout unaffected |
| P0-7 | Event instrumentation + metrics drawer | shown/tapped/added/dismissed/checkout events logged; drawer shows session funnel incl. "new-category items added" |
| P0-8 | Deployed to production | Public Vercel URL + Render API live; cold-start mitigation active; works on mobile Chrome/Safari |
| P0-9 | Seeded demo profile with order history | "Order Again" row populated; copilot exclusion logic (never-purchased categories) verifiably driven by that history |

### P1 — Nice-to-have (build if time remains before deadline)
- Persona toggle (Priya ↔ Ishaan) switching trust-led ↔ deal-led framing — high demo value, small effort.
- Post-add nudge sheet (suggestion surfaced immediately after anchor add, not only in cart).
- "Not relevant" feedback visibly changing the next generation (pass dismissals into the prompt).
- Search with fuzzy match + "search-as-probe" easter egg (typing "charger" works — callback to research).
- Lottie success animation & haptics (mobile).

### P2 — Future considerations (design for, don't build)
- Embedding-based candidate retrieval feeding the LLM (keep catalog schema embedding-ready: clean tags, descriptions).
- Real serviceability/inventory per store; multi-store OSM logic.
- Occasion Engine (festival storefronts) reusing the same copilot endpoint with an `occasion` input.
- A/B harness (module on/off) — event schema already supports variant field.

---

## 8. Success Metrics (prototype-scale)

**North star (instrumented, shown in drawer):** *Session Category-Expansion Rate* — % of demo sessions where ≥1 never-purchased-category item is added via the copilot **and** checkout is completed.

Leading (measurable during judging): suggestion render latency p95 ≤1.5s; suggestion tap-through ≥25% of sessions where shown; add-rate ≥15%; checkout completion unchanged with module on vs off; zero LLM-caused checkout failures.
Lagging (stated as the real-world extension): first-time category purchase rate, 30-day category repeat rate, refund-adjusted incremental NOV — mapped 1:1 to the Part 3 measurement framework.

---

## 9. Open Questions

- **(Design, blocking)** Which Instamart build to token-extract — current Android production UI or the newer gradient refresh? Decide before `tokens.css`. → *Owner: you, tonight.*
- **(Content, blocking)** Final 120-SKU list and the 12 categories — must include the maida/wheat atta pair, a beauty SKU (micellar water — P6 callback), and a charger (P2 callback) so demo moments land. → *Owner: you + Claude Code seed script.*
- **(Eng, non-blocking)** SQLite on Render free disk is ephemeral across deploys — acceptable for events? (Yes for demo; note in README.)
- **(Legal/deck, non-blocking)** Exact disclaimer wording for design emulation.

## 10. Timeline & Phasing (deadline: Aug 4)

1. **Phase 1 — Shell (hrs 0–4):** Next.js scaffold, tokens.css from screenshots, catalog seed, home/listing/cart/checkout with animations. *Checkpoint: full non-AI flow demoable.*
2. **Phase 2 — Copilot (hrs 4–7):** FastAPI + Groq endpoint, JSON validation, mission module UI, trust cards, silence/failure paths.
3. **Phase 3 — Polish + deploy (hrs 7–9):** events + metrics drawer, Protected Trial sheet, OSM location screen, Lighthouse pass, deploy both tiers, cold-start pinger, mobile QA.
4. **Cut order if time collapses:** OSM location screen → metrics drawer UI (keep raw event log) → persona toggle. Never cut: P0-2, P0-3, P0-6.

---

*Traceability: every P0 maps to a Part 3 finding — P0-3 ↔ mission-mode/awareness; P0-4 ↔ information vacuum (Q5); P0-5 ↔ trust erosion (Q2/Q6/Q8); persona framing ↔ Q7 wedge sequencing; metrics ↔ Successful Category Expansion Rate.*
