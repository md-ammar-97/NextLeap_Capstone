"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, Wallet, CreditCard, Banknote } from "lucide-react";
import { currentPersonaProfile, useCartStore, useOrderStore, usePersonaStore, useSessionStore } from "@/lib/store";
import { computeTotals, generateOrderId } from "@/lib/cart";
import { postEvents } from "@/lib/api";
import { getSkuById } from "@/lib/catalog";

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", sub: "Pay via any UPI app", icon: Wallet },
  { id: "card", label: "Credit / Debit Card", sub: "Visa, Mastercard, Rupay", icon: CreditCard },
  { id: "cod", label: "Cash on Delivery", sub: "Pay when it arrives", icon: Banknote },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clearCart);
  const setLastOrder = useOrderStore((s) => s.setLastOrder);
  const personaId = usePersonaStore((s) => s.personaId);
  const sessionId = useSessionStore((s) => s.sessionId);

  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"]>("upi");
  const [placing, setPlacing] = useState(false);

  const totals = computeTotals(lines);

  useEffect(() => {
    postEvents([
      { session_id: sessionId, ts: new Date().toISOString(), type: "checkout_started", payload: {} },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeOrder() {
    if (placing || lines.length === 0) return;
    setPlacing(true);
    // Client-side order id is the primary path (works with the backend fully
    // down, docs/edgecases.md #17) — not a fallback bolted on after the fact.
    const historyCategoryIds = currentPersonaProfile(personaId).history_category_ids;
    const newCategorySkuIds = lines
      .filter((l) => {
        const sku = getSkuById(l.sku_id);
        return sku && !historyCategoryIds.includes(sku.category_id);
      })
      .map((l) => l.sku_id);

    const order = {
      order_id: generateOrderId(),
      session_id: sessionId,
      persona_id: personaId,
      lines,
      totals,
      new_category_sku_ids: newCategorySkuIds,
      placed_at: new Date().toISOString(),
    };
    setLastOrder(order);
    postEvents([
      {
        session_id: sessionId,
        ts: new Date().toISOString(),
        type: "order_placed",
        payload: { order_id: order.order_id, new_category_sku_ids: newCategorySkuIds },
      },
    ]);
    clearCart();
    setTimeout(() => router.push("/success"), 400);
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--line)] flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => router.back()} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[16px] font-bold text-[var(--ink-900)]">Checkout</h1>
      </div>

      <div className="px-4 mt-4">
        <div className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--line)] p-3.5">
          <MapPin size={18} className="text-[var(--im-orange)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[var(--ink-900)]">Delivering to Home</p>
            <p className="text-[12px] text-[var(--ink-500)] mt-0.5">
              HSR Layout, Sector 2, Bengaluru, Karnataka 560102
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5">
        <h2 className="text-[13px] font-semibold text-[var(--ink-700)] mb-2">Payment method</h2>
        <div className="rounded-[var(--r-md)] border border-[var(--line)] divide-y divide-[var(--line)]">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
              >
                <Icon size={18} className="text-[var(--ink-700)]" />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-[var(--ink-900)]">{m.label}</span>
                  <span className="block text-[11px] text-[var(--ink-500)]">{m.sub}</span>
                </span>
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    method === m.id ? "border-[var(--im-orange)]" : "border-[var(--ink-300)]"
                  }`}
                >
                  {method === m.id && <span className="w-2 h-2 rounded-full bg-[var(--im-orange)]" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 mt-5">
        <div className="rounded-[var(--r-md)] bg-[var(--bg-soft)] p-4 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--ink-700)]">Total payable</span>
          <span className="text-[15px] font-extrabold text-[var(--ink-900)]">₹{totals.to_pay}</span>
        </div>
        <p className="text-[10px] text-[var(--ink-300)] mt-2 text-center">
          This is a simulated payment for a non-commercial academic prototype. No real transaction occurs.
        </p>
      </div>

      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[480px] bg-white border-t border-[var(--line)] px-4 py-3">
        <button
          type="button"
          onClick={placeOrder}
          disabled={placing}
          className="w-full bg-[var(--im-orange)] disabled:opacity-60 text-white rounded-[var(--r-md)] px-4 py-3.5 font-bold text-[14px]"
        >
          {placing ? "Placing order…" : `Place order · ₹${totals.to_pay}`}
        </button>
      </div>
    </div>
  );
}
