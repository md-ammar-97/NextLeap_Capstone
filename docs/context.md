# context.md — Why this prototype exists (read me first)

This file gives any collaborator or coding agent the full context needed to make good local decisions without re-reading the research corpus.

## 1. The assignment

NextLeap PM Fellowship capstone (deadline Aug 4, 2026). Role-play: Growth PM at Swiggy Instamart. Strategic goal: **increase the % of Monthly Active Customers who purchase from at least one new category every month.** Four parts: (1) AI discovery engine over public feedback — DONE (1,175 records, 57 themes, 4 platforms, evidence-graded answers to 8 questions); (2) user-research validation — DONE (6 evidence-backed composite archetypes, honestly labeled); (3) problem definition — DONE (see below); (4) **this repo: a deployed AI-native MVP.**

## 2. The problem (condensed from Part 3)

Habit-locked, mission-led frequent users (4+ orders/30d, ≥70% spend in a narrow category set) never explore Instamart's 40+ categories because, inside an urgent low-attention session, the expected cost of a first trial — financial risk (documented refund/fee failures, "fraudulent" framing in reviews) + evaluation effort (no price anchor, no ingredient/authenticity confidence) — exceeds its expected benefit, and nothing in the product lowers that cost inside the mission flow. Instamart compressed delivery time without compressing evaluation risk.

Key evidence beats the demo must echo:
- **Mission-mode usage:** users search → checkout in <2 min; home feed is scrolled past. So the copilot lives in the cart/post-add flow, never as a feed takeover.
- **Trust is category-siloed:** grocery trust doesn't transfer to beauty/electronics/fresh. So trust cards are category-adaptive.
- **Price-reference vacuum:** users assume a convenience premium. So every suggestion carries a price anchor vs a reference retailer.
- **Refund/fee trauma:** the engine's hardest signal. So the Protected Trial badge makes worst-case explicit.
- **Maida/wheat confusion:** canonical information-gap example. Catalog includes the atta pair; trust chip literally answers it.
- **"Typed 'charger' as a joke":** search-as-probe workaround. Catalog includes a charger; search must find it.
- **Micellar water (P6):** replenishment urgency beats platform loyalty in beauty. Catalog includes it.
- **Deal-bot ecosystem:** deals are the proven discovery currency for experimenters. Persona toggle switches copy from trust-led to deal-led.

## 3. What the MVP is

**Mission Completion Copilot:** when a user adds a familiar anchor product, an LLM infers the mission behind the basket ("tonight's pasta dinner") and surfaces ≤3 cross-category items — each with a why-line, category-adaptive trust facts, a price anchor, and a Protected Trial badge — without ever slowing checkout.

What it must prove: (a) the loop works end-to-end through a working checkout; (b) the AI is live, not canned (judges build arbitrary baskets); (c) suggestions never block or slow the mission; (d) the UI is Instamart-fidelity and extremely smooth; (e) the funnel is instrumented (metrics drawer).

## 4. Hard scope boundaries

- Journey **ends at the order-success screen.** No delivery assignment, tracking, riders, ETA simulation.
- No real payments, no real auth, no runtime scraping of Instamart, no ML pipeline beyond Groq calls.
- One mock dark store; everything in stock unless deliberately flagged.
- Free-tier only: Vercel + Render + Groq + OSM. No paid keys anywhere.

## 5. Demo personas (seeded, switchable)

- **Priya — Habit-Locked Householder (default):** history = staples, dairy, snacks, household. Copilot framing: trust-led. Never bought: fresh, beauty, baby, electronics, pharma, gifting…
- **Ishaan — Deal-Led Experimenter (toggle):** history = many categories. Copilot framing: deal-led ("₹89 — lowest in 30 days").

## 6. Success at demo time

North star: **Session Category-Expansion Rate** — % of sessions where ≥1 never-purchased-category item is added via copilot AND checkout completes. Guardrails: copilot p95 ≤1.5s, zero copilot-caused checkout failures, checkout time unchanged with module on.

## 7. Vocabulary

- **Anchor:** familiar SKU the user adds that triggers mission inference.
- **Mission:** the household job behind the basket (pasta dinner, party tonight, monsoon cleaning).
- **New category:** category_id absent from the persona's order history.
- **Trust card / chips:** category-adaptive fact set (expiry, authenticity, ingredient, compatibility, return).
- **Protected Trial:** first-category purchase guarantee (instant replacement/refund, no questions).
- **Silence rule:** copilot renders nothing below confidence 0.6 — silence over noise, always.

## 8. Decision heuristics for the coding agent

When facing an unspecified choice, prefer in this order: (1) checkout robustness, (2) perceived smoothness, (3) Instamart visual fidelity, (4) AI demo value, (5) code elegance. Cut order under time pressure: OSM location screen → metrics drawer UI (keep raw events) → persona toggle. Never cut: working checkout, live Groq copilot, silence/failure behavior.
