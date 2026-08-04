# Mission Completion Copilot (Instamart AI-native MVP prototype)

Non-commercial academic prototype built for a Growth PM capstone (NextLeap PM
Fellowship), emulating Instamart's design language for research demonstration
only. All trademarks belong to Swiggy Ltd.; no Swiggy logo assets are used.
See `docs/design.md` §6 for the full disclaimer.

Full spec lives in [`docs/`](docs/): `Problem-Statement-Mission-Completion-Copilot.md`,
`context.md`, `architecture.md`, `datamodel.md`, `design.md`, `edgecases.md`,
and the build sequence in [`docs/implementation_plan.md`](docs/implementation_plan.md).

## Live deployment

- Frontend: https://instamart-copilot.vercel.app
- Backend: https://instamart-copilot-api.onrender.com (`/health`, `/copilot`, `/events`, `/metrics/{session_id}`)
- Render is on the **Starter** plan — sufficient as-is, no upgrade needed.
  Only Render's free tier sleeps/cold-starts; Starter and Standard both stay
  warm, so the pinger in `docs/implementation_plan.md` §5.9 isn't needed on
  either. Standard's extra RAM/CPU isn't a functional requirement here —
  this backend's own compute is trivial (a few SQLite writes, an in-memory
  dict cache); the 800ms–1.2s latencies observed all session are Groq's
  response time, not server strain. Upgrading is a headroom choice, not a
  blocker — worth it only if judging traffic turns out heavier than a
  handful of people testing sequentially.
- After any redeploy this close to judging, re-run `python scripts/prewarm_demo.py`
  (see below) — the copilot's suggestion cache is in-memory and wiped on
  every deploy.
- Mobile Lighthouse (production, `/`): Performance 79, LCP 2.3s, CLS 0,
  FCP 1.1s. After U5's LazyMotion migration, homepage JS dropped ~19%
  (793KB→651KB uncompressed across chunks) — confirmed the code-split
  actually took effect — but TBT stayed flat (~800-820ms) and the
  Performance score barely moved (78→79). The blocking cost isn't
  framer-motion; it's most likely React hydration + parsing the bundled
  120-SKU catalog JSON on every page load, which would need a bigger
  change (server-rendering more of the page, or lazy-loading catalog
  slices) than fits this pass. Stopping here per the "fix the largest
  offenders, don't chase perfection on a prototype" guidance — CLS and FCP
  are both comfortably within budget regardless.

## Repo layout

```
/frontend   Next.js 16 (App Router) — deploys to Vercel
/backend    FastAPI (Python 3.13)   — deploys to Render
/shared     catalog.json + persona JSON — source of truth, synced into both
/scripts    seed_catalog.py — regenerates /shared and the synced copies
            prewarm_demo.py — pre-warms the copilot cache for the demo script below
```

`shared/catalog.json` is authored by `scripts/seed_catalog.py` (edit the
Python data there, not the JSON directly) and synced to
`backend/data/catalog.json` + `frontend/lib/catalog-data.json` on each run:

```bash
python scripts/seed_catalog.py
```

## Running locally

**Backend** (Python 3.13 — pydantic-core has no prebuilt wheel for 3.14 yet,
so a 3.13 interpreter is required for `pip install` to succeed without a
Rust toolchain):

```bash
cd backend
py -3.13 -m venv venv
./venv/Scripts/pip install -r requirements.txt
cp .env.example .env   # then set GROQ_API_KEY
./venv/Scripts/python -m uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Without `GROQ_API_KEY` set, `/copilot` returns `204` on every call (the
documented failure-mode behavior) — browse/cart/checkout all still work
fully, since the catalog is bundled client-side. This is expected, not a bug.

## 2-minute demo script

1. **Location** — confirm the pin on the OSM map (defaults to HSR Layout, Bengaluru).
2. **Home** — point at "Order Again" (the habit-locked surface the whole thesis is about).
3. **Search "charger"** — the search-as-probe research callback (`docs/context.md`); previously a decorative no-op, now a real filter over all 120 SKUs.
4. **Add pasta + pasta sauce** to the cart.
5. **Cart** — mission is inferred live ("tonight's pasta dinner"); walk one suggestion card: the why-line, trust chips, price anchor ("₹X here · ~₹Y at &lt;retailer&gt;"), and open the Protected Trial sheet.
6. Tap **"Not relevant"** on one card — it collapses and won't be re-suggested this session.
7. **Add a new-category item** from the remaining suggestions.
8. **Checkout → Success.**
9. Open the **metrics drawer** from the success screen — funnel (shown/tapped/added/removed) and latency p95 for this exact session.
10. **Toggle persona to Ishaan**, rebuild the same pasta basket, and compare the reframed deal-led "why" copy against Priya's trust-led framing.

Run `python scripts/prewarm_demo.py` before judging starts so every step
above is cache-served rather than waiting on a live Groq call — see the
script's own docstring for why it has to be the *last* thing you do before
judging opens, not something you can do once in advance.

## Traceability

Every P0 in `docs/Problem-Statement-Mission-Completion-Copilot.md` maps
back to a specific finding from the underlying research (Parts 1-3 of the
capstone), not just to "working software" — see that doc's closing
footnote: P0-3 ↔ mission-mode/awareness, P0-4 ↔ information vacuum, P0-5 ↔
trust erosion, persona framing ↔ wedge sequencing, metrics ↔ Successful
Category-Expansion Rate.

## Known, accepted limitations

- **Product images:** all 120 SKUs now have a real, item-specific (non-
  branded) photo, fetched via `scripts/fetch_images.py` from Pexels/Pixabay/
  Unsplash's free APIs (round-robined across all three so no single
  provider's rate limit is a bottleneck) and processed to ≤40KB WebP. Query
  is the SKU's own name; relevance is automated matching, not hand-curated,
  so quality varies a little per item — spot-checked across several
  categories and it holds up well. Falls back to the category-tinted
  placeholder tile for any SKU a re-run doesn't find a photo for (none did,
  as of the last run — 120/120). Re-run with `scripts/venv/Scripts/python
  scripts/fetch_images.py` then `python scripts/seed_catalog.py` if the
  catalog changes. API keys live in `scripts/.env` (gitignored, not in this
  repo) — get your own free keys at pexels.com/api, pixabay.com/api/docs,
  and unsplash.com/developers to re-run this.
- **SQLite event log (`backend/data/events.db`) is ephemeral** — Render's
  local filesystem doesn't persist across deploys/restarts unless a paid
  persistent disk is explicitly attached (not configured here). Acceptable
  by design — the metrics drawer is scoped per browser session anyway.
- **Node.js requirement:** frontend was scaffolded on Next.js 16 / React 19 /
  Tailwind v4 (the current `create-next-app` default), not the Next.js 14
  named in the original architecture doc — functionally equivalent for this
  app's App Router usage; see `frontend/AGENTS.md` for the framework's own
  breaking-changes notes if extending it further.
- **Fallback video:** not recorded. Screen-record the full demo script above
  on production the night before judging — recommend hosting it externally
  (unlisted YouTube/Drive) rather than committing it to this repo (no Git LFS
  configured, would bloat the history).
- **Groq quota:** not independently checked against a full judging day's
  traffic — worth a quick look at the Groq console's daily limits; the
  debounce + in-memory cache + 8B-instant fallback chain already absorb
  normal usage, and `scripts/prewarm_demo.py` pre-seeds the cache for the
  scripted path specifically.
