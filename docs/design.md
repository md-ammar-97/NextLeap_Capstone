# design.md — Mission Completion Copilot (Instamart-fidelity UI)

Goal: visually indistinguishable from Swiggy Instamart at a glance; smoother than the real app. Mobile-first (360–430px), responsive up to desktop with a centered 480px app frame.

## 1. Design tokens (`app/tokens.css`)

Extract final values from current Instamart Android screenshots before build. Starting hypotheses (verify & overwrite):

```css
:root {
  /* Brand */
  --im-orange: #FC8019;        /* Swiggy brand orange — CTAs, price highlights */
  --im-purple: #8123AD;        /* Instamart brand purple — header gradient start */
  --im-purple-deep: #5C1F87;   /* gradient end */
  --im-yellow: #FFCA28;        /* deal chips, offer strips */
  --im-green: #1BA672;         /* veg dot, savings text, success */
  --im-red: #E53935;           /* non-veg dot, errors */

  /* Neutrals */
  --ink-900: #1C1C1C; --ink-700: #3E3E3E; --ink-500: #686B78;
  --ink-300: #A9ABB2; --line: #E9E9EB; --bg: #FFFFFF; --bg-soft: #F5F6F8;

  /* Trust/AI accents (ours, not Instamart's) */
  --trust-blue: #2563EB;       /* Protected Trial badge */
  --ai-glow: linear-gradient(90deg,#8123AD,#FC8019); /* mission module shimmer */

  /* Shape & elevation */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-pill: 999px;
  --shadow-card: 0 1px 4px rgba(0,0,0,.06);
  --shadow-sheet: 0 -8px 24px rgba(0,0,0,.12);

  /* Spacing scale: 4/8/12/16/20/24; screen gutter 16px */
}
```

Typography: **Plus Jakarta Sans** (closest open substitute for Instamart's grotesk). Weights 500/600/700/800. Scale: display 22/28 · title 17/22 · body 14/20 · caption 12/16 · micro 10/14. Prices always 700; MRP strikethrough in --ink-300.

Icons: Lucide, 1.8px stroke, sized 20/24. Category tiles use flat illustrated icons (open-license set, recolored to palette).

## 2. Component anatomy

**Product card (grid, 2-col):** image 1:1 WebP on --bg-soft tile (r-md) → veg/non-veg dot top-left → discount chip top-right (--im-yellow bg, "12% OFF", micro 700) → name (body, 2-line clamp) → unit size (caption, ink-500) → price row (₹price 700 + M̶R̶P̶) → ADD control bottom-right overlapping image tile by 12px.

**ADD stepper:** 64×28 pill, white bg, 1px --im-green border, "ADD" in green 700. On tap: morphs (200ms width spring) into − 1 + stepper, green bg, white text. Count change: digit slides vertically (120ms).

**Fly-to-cart:** 24px image clone arcs to cart badge (350ms cubic-bezier(.2,.8,.3,1)), badge scale-bounces 1→1.25→1.

**Bottom sheet (PDP, Protected Trial explainer):** r-lg top corners, grab handle, spring physics (stiffness 300, damping 30), scrim rgba(0,0,0,.45), drag-to-dismiss.

**Mission Completion Module (cart + post-add nudge):**
- Container: r-lg card, 1px gradient border using --ai-glow (border-image or padded gradient wrapper), bg white.
- Header row: ✨ icon → mission line (title, e.g. "Completing tonight's pasta dinner?") → dismiss ✕. On generation: text reveals with 300ms shimmer sweep (gradient mask), once only.
- Suggestion cards: horizontal snap-scroll, 240px wide. Anatomy: image (72px) + name + price + **anchor line** (caption, green: "₹249 here · ~₹260 at BigBasket") + **why-line** (caption italic, ink-700, ≤12 words) + **trust chips** (max 3; pill, bg-soft, micro; icon per type: 🕒 expiry, ✅ authentic, 🌾 ingredient, 🔌 compatibility, ↩ return) + **Protected Trial badge** (trust-blue pill, shield icon, tappable) + ADD stepper.
- "Not relevant" via long-press context or ⋯ menu on card.
- Entrance: slide-up 16px + fade, 250ms ease-out. Never auto-scrolls the cart.

**Bill summary:** rows for Item total / Handling ₹2 / Delivery FREE (strikethrough ₹25, green FREE) / GST & charges (expandable — transparency is on-thesis) / To Pay (title 800).

**Skeletons:** shimmer 1.2s linear infinite on --bg-soft blocks; used for grid load + mission module "thinking" state (module renders skeleton only if a cached mission existed before; otherwise appears only when ready — no spinner-first UX).

## 3. Screens

1. **Location (OSM):** full-bleed MapLibre map, center pin (drops with bounce on move-end), bottom card: address from Nominatim + "Confirm location" (orange CTA, r-md, full-width 48px).
2. **Home:** gradient header (--im-purple→deep) containing address row + white search bar (r-pill, "Search for 'atta'…" placeholder cycling 3 hints); category rail (8 tiles, 64px, label caption); promo banner carousel (auto 4s, peek next 16px); "Order Again" horizontal row (from seeded history); "Hot deals" grid.
3. **Listing:** sticky category chips row; 2-col grid; sort/filter pills (visual only).
4. **PDP sheet:** image carousel, name/unit/price, description, trust card section (for any SKU — full version of the chips), similar items row.
5. **Cart:** items list → Mission Completion Module → bill summary → sticky footer CTA "Proceed to Pay ₹X" (orange, full-width).
6. **Checkout:** address mini-map (static OSM snapshot), payment methods list (UPI/cards/COD — radio, all fake), "Place order".
7. **Success:** full-screen; confetti burst (canvas-confetti, 1.2s, once); green check draw-on animation; order id; item summary; "View session metrics" text link → metrics drawer.
8. **Metrics drawer (judge-facing):** bottom sheet, funnel bars: suggestions shown → tapped → added → new-category items in order → checkout done; plus latency p95 readout. Deliberately un-Instamart (plain, data-dense) to signal "instrumentation, not product".

## 4. Motion & performance rules

- Every animation ≤300ms except confetti; all transform/opacity only (no layout-animating properties); `will-change` on sheets.
- 60fps scroll: content-visibility on off-screen grid sections; images width-capped WebP ≤40KB, `loading=lazy`, blur-up placeholder.
- Route transitions: Next.js prefetch on viewport; shared-element feel via consistent card positions.
- Reduced motion: respect `prefers-reduced-motion` — swap springs for fades.
- Lighthouse mobile targets: Perf ≥90, CLS <0.05, LCP <2s on 4G throttle.

## 5. Voice & copy

- Mission lines: warm, specific, question form. "Completing tonight's pasta dinner?" not "Recommended for you".
- Why-lines ≤12 words, concrete: "Garlic bread turns this into the full meal."
- Trust chips: facts only, no adjectives. "Expiry Nov 2026", "Brand-sealed", "Whole wheat, no maida".
- Protected Trial sheet copy: "First time trying this category? If anything's wrong — wrong item, damaged, not fresh — instant replacement or refund. No questions, no photos, no support calls." 
- Never use "AI thinks…"; the copilot speaks as the app.

## 6. Legal/deck note

Non-commercial academic prototype emulating Instamart's design language for research demonstration. Recreate approximations; do not copy Swiggy logo files verbatim. All trademarks © Swiggy Ltd.
