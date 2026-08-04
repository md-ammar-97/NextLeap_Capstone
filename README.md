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
- Render is on a paid (Starter) plan, not free tier — no cold-start / sleep
  behavior, so the free-tier cold-start pinger in `docs/implementation_plan.md`
  §5.9 is not needed for this deployment.
- Mobile Lighthouse (production, `/`): Performance 78, LCP 2.4s, CLS 0,
  FCP 1.1s. Below the 90 target mainly on total-blocking-time (~800ms); not
  chased further per the plan's own guidance to fix the largest offenders and
  not chase a perfect score on a prototype. CLS and FCP are both comfortably
  within budget.

## Repo layout

```
/frontend   Next.js 16 (App Router) — deploys to Vercel
/backend    FastAPI (Python 3.13)   — deploys to Render
/shared     catalog.json + persona JSON — source of truth, synced into both
/scripts    seed_catalog.py — regenerates /shared and the synced copies
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

## Known, accepted limitations

- **Product images:** placeholder tiles (category-tinted + icon) for all SKUs
  in this pass, per the hybrid-image decision in `docs/implementation_plan.md`
  Pre-Flight. Real photography for the ~15 SKUs that actually surface in
  copilot suggestions is a fast-follow, not a blocker.
- **SQLite event log (`backend/data/events.db`) is ephemeral** — Render's
  local filesystem doesn't persist across deploys/restarts unless a paid
  persistent disk is explicitly attached (not configured here). Acceptable
  by design — the metrics drawer is scoped per browser session anyway.
- **Node.js requirement:** frontend was scaffolded on Next.js 16 / React 19 /
  Tailwind v4 (the current `create-next-app` default), not the Next.js 14
  named in the original architecture doc — functionally equivalent for this
  app's App Router usage; see `frontend/AGENTS.md` for the framework's own
  breaking-changes notes if extending it further.
