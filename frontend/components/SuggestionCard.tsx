"use client";

import { getSkuById } from "@/lib/catalog";
import { useCartStore } from "@/lib/store";
import { postEvents, type Suggestion } from "@/lib/api";
import { PlaceholderTile } from "./PlaceholderTile";
import { AddStepper } from "./AddStepper";
import { TrustChip } from "./TrustChip";
import { ProtectedTrialBadge } from "./ProtectedTrialBadge";

export function SuggestionCard({
  suggestion,
  sessionId,
  cartHash,
  onOpen,
  onNotRelevant,
}: {
  suggestion: Suggestion;
  sessionId: string;
  cartHash: string;
  onOpen: () => void;
  onNotRelevant: () => void;
}) {
  const sku = getSkuById(suggestion.sku_id);
  const addToCart = useCartStore((s) => s.addToCart);
  const setQty = useCartStore((s) => s.setQty);
  const markSuggestedOrigin = useCartStore((s) => s.markSuggestedOrigin);
  const line = useCartStore((s) => s.lines.find((l) => l.sku_id === suggestion.sku_id));
  const qty = line?.qty ?? 0;

  if (!sku) return null;

  function logAdded() {
    postEvents([
      {
        session_id: sessionId,
        ts: new Date().toISOString(),
        type: "suggestion_added",
        payload: { sku_id: sku!.sku_id, is_new_category: suggestion.is_new_category, cart_hash: cartHash },
      },
    ]);
  }

  return (
    <div className="w-[220px] shrink-0 snap-start rounded-[var(--r-md)] border border-[var(--line)] p-2.5 flex flex-col">
      <button type="button" onClick={onOpen} className="flex gap-2 text-left">
        <div className="w-14 h-14 rounded-[var(--r-sm)] overflow-hidden shrink-0">
          <PlaceholderTile categoryId={sku.category_id} className="w-full h-full" />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold line-clamp-2 text-[var(--ink-900)]">{sku.name}</p>
          <p className="text-[12px] font-bold mt-0.5">₹{sku.price}</p>
        </div>
      </button>

      {suggestion.price_anchor && (
        <p className="text-[10px] text-[var(--im-green)] mt-1.5">{suggestion.price_anchor}</p>
      )}
      <p className="text-[11px] italic text-[var(--ink-700)] mt-1 line-clamp-2">{suggestion.why}</p>

      <div className="flex flex-wrap gap-1 mt-1.5">
        {suggestion.trust_facts.slice(0, 3).map((f, i) => (
          <TrustChip key={i} type={f.type} label={f.label} />
        ))}
      </div>

      <div className="flex items-center justify-between mt-2">
        {suggestion.protected_trial ? <ProtectedTrialBadge /> : <span />}
        <AddStepper
          qty={qty}
          size="sm"
          onAdd={() => {
            addToCart(sku.sku_id, 1);
            markSuggestedOrigin(sku.sku_id);
            logAdded();
          }}
          onIncrement={() => setQty(sku.sku_id, qty + 1)}
          onDecrement={() => setQty(sku.sku_id, qty - 1)}
        />
      </div>

      <button
        type="button"
        onClick={onNotRelevant}
        className="text-[10px] text-[var(--ink-300)] mt-1.5 self-end"
      >
        Not relevant
      </button>
    </div>
  );
}
