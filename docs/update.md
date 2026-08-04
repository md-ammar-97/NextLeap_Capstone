# update.md — Changes needed before Part 4 submission

Context: code review (Aug 2026) confirmed all nine P0s pass and the prototype is live. Part 4's bar — a functional, production-deployed AI-native MVP — is already met. These updates close the review gaps so every research pillar is *visible* in the demo, plus verification tasks. No monetization work; Render Standard ($25/mo) is already more than enough — no infra changes needed beyond one config check.

Ordered by impact-per-hour. U1–U3 are the ones that materially strengthen the case-study story; U4+ are polish.

---

## U1 — Working search (≈1–2 hrs) · HIGH

**Why:** Part 3's thesis is that usage is *search-first mission mode*, and the "typed 'charger' as a joke" search-as-probe workaround is a research callback the demo currently can't perform. The search bar today is a decorative placeholder — the one visible element that does nothing.

**Scope (client-side only, no backend):**
- New route `app/search/page.tsx`. Home search bar becomes a `Link` to it; autofocus input on mount.
- Filter over the bundled catalog: case-insensitive substring match on `name` + `tags` + category name; rank exact-name hits first. No fuzzy library needed — 120 SKUs, `Array.filter` is instant. (If trivial: also match with spaces stripped so "garlicbread" works.)
- Results render as the existing 2-col `ProductCard` grid; empty state: "No products found for '<q>'" + suggestion chips of 4 popular queries (atta, charger, micellar water, melatonin — the callback SKUs, deliberately).
- Cycling placeholder hints in the input ("Search for 'atta'…", "'charger'…", "'micellar water'…") — plants the demo moment for judges.
- ADD from results works exactly like listing pages (same stepper → same cart → copilot triggers as normal).

**Acceptance:** typing "charger" surfaces the USB-C charger; adding it from search and opening cart can produce an electronics/desk-setup mission or correct silence; back navigation preserves scroll on home.

## U2 — Price-anchor coverage (≈30 min) · HIGH

**Why:** the price-reference vacuum is a core Part 3 pillar, but `anchor_price` exists on only 21/120 SKUs — ~80% of suggestions render without the anchor line, silently dropping a thesis pillar from the demo.

**Scope:**
- Extend `scripts/seed_catalog.py` (or hand-edit `shared/catalog.json`) so **every SKU in Priya's never-purchased categories** (fresh, beauty, baby, pharma, electronics, party_gifting, pet — ~70 SKUs) has an `anchor_price` with a plausible retailer per category: fresh→BigBasket, beauty→Nykaa, pharma→Tata 1mg, electronics→Amazon, baby→FirstCry, party/pet→Amazon. Anchor 3–12% above our price (realistic, not cartoonish); one or two SKUs where we're ~2% *pricier* keeps it honest.
- Re-sync `shared/catalog.json` → frontend bundle + backend data (existing sync script), redeploy both.

**Acceptance:** any copilot suggestion for a new-category SKU shows the "₹X here · ~₹Y at <retailer>" line.

## U3 — Verify suggestion_tapped / suggestion_added instrumentation (≈30 min) · HIGH

**Why:** the metrics drawer is the judge-facing proof of the measurement framework. `shown`, `dismissed`, `not_relevant`, `order_placed` are confirmed; the add-path events from inside the MissionModule were not traced in review.

**Scope:**
- Confirm the module's `AddStepper`/card tap fire `suggestion_tapped` (on PDP-sheet open from a suggestion card) and `suggestion_added` with `{sku_id, is_new_category, cart_hash}` (on first add). If missing, wire them in `MissionModule.tsx` / the stepper callback.
- End-to-end check on production: fresh session → add pasta → add a copilot suggestion → checkout → metrics drawer shows non-zero shown/tapped/added, `new_category_added ≥ 1`, and a latency p95.

**Acceptance:** the funnel in the drawer tells the full story in one screenshot (this screenshot also goes in the deck).

## U4 — Post-add nudge (≈2 hrs) · MEDIUM (P1 from spec; skip if time-boxed)

**Why:** spec placed the copilot in cart *and* as a slide-up nudge after an anchor add; only the cart placement was built. The nudge demonstrates "inside the mission flow" more viscerally — the user never has to visit the cart to meet the copilot.

**Scope:**
- Reuse `MissionModule` in a `BottomSheet` variant triggered once per session when: an add occurs on home/listing/search AND the copilot returns `ready` AND the module hasn't been shown this cart-hash. Delay = existing 800ms debounce + response.
- Dismiss = same `module_dismissed` semantics. Never trigger on cart page (module already there) or checkout.
- Guardrail: max 1 auto-nudge per session — it must never feel like a popup app.

**Acceptance:** add atta from home → within ~2s a sheet slides up with the mission module; dismissing it doesn't affect the cart-page module for a *changed* basket.

## U5 — Lighthouse TBT pass (≈1–2 hrs) · MEDIUM

**Why:** 78 vs the 90 target, blocked on ~800ms total-blocking-time. Not required by Part 4, but "smoother than Instamart" was our own bar and TBT is usually cheap to claw back in Next.js.

**Scope (largest offenders only, stop when ≥85):**
- `next/dynamic` import for `maplibre-gl` (location route only — it should not be in the shared bundle) and for `canvas-confetti` (success route only).
- Check `framer-motion` usage is tree-shaken via `LazyMotion`/`m` components; if not, switch the 3–4 animated components over.
- Defer the health ping + event flush to `requestIdleCallback`.

**Acceptance:** production mobile Lighthouse ≥85, CLS still <0.05; note the final number in README.

## U6 — Demo hardening & submission collateral (≈1 hr) · MEDIUM

- **Config check (only Render change needed):** confirm the service is on the $25 Standard instance, `ALLOWED_ORIGIN` matches the exact Vercel prod URL, and `GROQ_API_KEY` present; remove the now-unneeded cold-start pinger if one was set up externally.
- **Groq quota sanity:** confirm free-tier daily limits comfortably cover a judging day (cache hit rate helps); if nervous, pre-warm the 6 scripted demo baskets so they're cache-served.
- **README updates:** live Lighthouse number (post-U5), a "2-minute demo script" section (below), and a line mapping each feature to the Part 3 finding it embodies (traceability table already exists in the docs — link it).
- **Demo script (also for the deck):** ① location confirm → ② home, point at Order Again (habit surface) → ③ search "charger" (search-as-probe callback) → ④ add pasta + sauce → ⑤ cart: mission inferred live, walk one suggestion card (why-line, trust chips, price anchor, Protected Trial sheet) → ⑥ "not relevant" on one card → ⑦ add a new-category item → ⑧ checkout → success → ⑨ metrics drawer funnel → ⑩ persona toggle to Ishaan, same basket, show deal-led reframing.
- **Fallback video:** screen-record the full script on production the night before; judges' networks fail, recordings don't.

## U7 — Nice-to-haves (only if everything above is done)

- Empty-search suggestion chips double as a "catalog breadth" hint (ties to the awareness pillar).
- Metrics drawer: label the funnel stages with the Part 3 metric names (Session Category-Expansion Rate as the header stat).
- `out_of_stock` demo flag on one SKU to show graceful degradation (edgecase #20) if asked.

---

## Explicitly NOT doing

- No payments, auth, monetization, or multi-store logic — outside case-study scope.
- No infra migration: Render Standard stays; Vercel hobby stays; Groq free tier stays.
- No embedding/retrieval pipeline — P2 by design; the docs already explain why.

## Suggested order for the time available

U2 → U3 → U1 → U6 → (U5 → U4 → U7 as time allows). U2+U3 are under an hour combined and de-risk the demo most.
