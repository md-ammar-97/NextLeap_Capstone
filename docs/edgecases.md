# edgecases.md — Mission Completion Copilot

Format: **Case → Expected behavior**. Anything not listed follows the decision heuristics in context.md §8.

## 1. Copilot / LLM

1. **Groq timeout (>2.0s primary):** retry once on 8B fallback (1.0s budget); if that fails, return 204. Frontend: module simply doesn't appear. Log `copilot_latency` with `failed:true`.
2. **Groq 429 rate limit:** same fallback chain; cache hit path checked first.
3. **Model returns invalid JSON:** one repair attempt (strip fences, retry parse); else 204. Never surface raw model text.
4. **Model suggests a sku_id not in candidate slice:** drop that suggestion silently; if <1 remains, 204.
5. **Model claims is_new_category incorrectly:** ignore its claim — recompute from history server-side.
6. **Model writes its own trust-fact text:** replaced with catalog-sourced facts by fact id; model only selects which facts to surface.
7. **Why-line >12 words:** truncate at word boundary, no ellipsis-mid-word.
8. **Confidence <0.6:** 204, no module. Never lower the bar to force a demo.
9. **Single random SKU basket (e.g. 1 phone charger):** likely low confidence → silence. If confident (e.g. "charger + cable = desk setup"), fine.
10. **Cart of items spanning many unrelated missions:** model instructed to pick the strongest single mission or return low confidence; never two missions in one module.
11. **All catalog categories already in history (Ishaan edge):** candidate filter empty → 204 (or, P1: fall back to "new brand in known category" copy — only if time permits).
12. **User dismisses module ("Not now"):** module hidden for that cart-hash for the session; event logged; reappears only if basket meaningfully changes (hash change).
13. **"Not relevant" on a card:** sku added to dismissed list for session; passed into next prompt; card removed with 150ms collapse.
14. **Suggestion added then removed:** log both; do not re-suggest the same sku this session.
15. **Cart mutated during in-flight copilot request:** abort stale request (AbortController); only latest cart-hash response renders.
16. **Same basket re-created:** served from backend cache — instant, and demonstrates snappiness.

## 2. Cart & checkout

17. **Backend fully down:** browse/cart/checkout all work (catalog is client-bundled). Order id generated client-side (`IM-LOCAL-xxxx`), events queued to localStorage and flushed on next successful /events call. Copilot absent. **Checkout must never error because the backend is down.**
18. **Qty limits:** max 10 per SKU (stepper + disabled state, toast "Limit reached").
19. **Empty cart → cart screen:** friendly empty state, CTA back to home; no copilot call.
20. **Item flagged out-of-stock (demo flag):** card shows "Out of stock", ADD disabled; if in cart when flagged, auto-remove with toast — demonstrates graceful degradation.
21. **Bill math:** totals recomputed from catalog prices at render, never trusted from state history; GST line = fixed 5% of handling for sim, labeled "(simulated)". Free delivery always.
22. **Double-tap "Place order":** button disables on first tap; idempotent client-side.
23. **Refresh mid-flow:** cart persists (localStorage); success screen reachable only with a placed order in state, else redirect home.
24. **Deep-link to /success or /checkout with empty state:** redirect to home.

## 3. Maps / location

25. **Nominatim slow or fails:** show coordinates + "Selected location" placeholder; Confirm still enabled. Never block entry into the app on geocoding.
26. **Nominatim rate limit (1 req/s policy):** reverse-geocode only on pin-drop end (debounced 600ms), never on drag; set proper User-Agent header.
27. **Geolocation permission denied:** default to a preset city center (Bengaluru); pin adjustable manually.
28. **OSM tiles slow:** map screen is skippable via "Use default address" text link after 3s.

## 4. Performance / device

29. **Slow 4G:** skeletons everywhere; images blur-up; copilot has its own budget and silence path — page never waits on it.
30. **Low-end device:** honor `prefers-reduced-motion`; confetti capped at 150 particles; fly-to-cart falls back to badge bounce only.
31. **Desktop viewport:** app renders in centered 480px frame with subtle backdrop; no layout breakage.
32. **Safari iOS:** test bottom-sheet drag + 100vh issues (use dvh units); momentum scroll on suggestion rail.

## 5. Sessions, events, metrics

33. **Render disk wipe on redeploy (ephemeral SQLite):** acceptable; metrics drawer is per-session anyway. README notes it.
34. **Events POST fails:** queue client-side, retry with backoff, cap queue at 200 events, drop oldest.
35. **Metrics drawer with zero copilot interactions:** show funnel with zeros + one-line explainer, not an empty error.
36. **Two tabs same session:** last-writer-wins on cart (localStorage sync via storage event); acceptable for demo.

## 6. Content & safety

37. **Model produces a health/superlative claim ("healthier", "best"):** regex screen post-validation; strip the sentence or drop the card. Facts only.
38. **Price anchor for SKU without anchor_price metadata:** omit anchor line entirely — never let the model estimate a competitor price.
39. **Persona toggle mid-session:** clear copilot cache + dismissed list; history swaps; cart persists.
40. **Judge inputs adversarial basket (e.g. 15 unrelated items):** worst case = silence. That is the correct, defensible behavior — say so in the deck.
