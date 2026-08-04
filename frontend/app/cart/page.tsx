"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { computeTotals } from "@/lib/cart";
import { CartLineItem } from "@/components/CartLineItem";
import { MissionModule } from "@/components/MissionModule";

export default function CartPage() {
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const totals = computeTotals(lines);

  if (lines.length === 0) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center">
        <ShoppingBag size={40} className="text-[var(--ink-300)] mb-3" />
        <p className="text-[15px] font-semibold text-[var(--ink-900)]">Your cart is empty</p>
        <p className="text-[13px] text-[var(--ink-500)] mt-1">Add items to get started</p>
        <Link
          href="/"
          className="mt-5 bg-[var(--im-orange)] text-white text-[13px] font-bold px-6 py-2.5 rounded-[var(--r-md)]"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 bg-white border-b border-[var(--line)] flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => router.back()} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[16px] font-bold text-[var(--ink-900)]">Your Cart</h1>
      </div>

      <div className="px-4 mt-2">
        {lines.map((l) => (
          <CartLineItem key={l.sku_id} skuId={l.sku_id} qty={l.qty} />
        ))}
      </div>

      <MissionModule />

      <div className="px-4 mt-5">
        <h2 className="text-[13px] font-semibold text-[var(--ink-700)] mb-2">Bill summary</h2>
        <div className="rounded-[var(--r-md)] bg-[var(--bg-soft)] p-4 space-y-2">
          <Row label="Item total" value={`₹${totals.item_total}`} />
          <Row label="Handling fee" value={`₹${totals.handling}`} />
          <Row
            label="Delivery fee"
            value={
              <span className="flex items-center gap-1.5">
                <span className="line-through text-[var(--ink-300)]">₹25</span>
                <span className="text-[var(--im-green)] font-semibold">FREE</span>
              </span>
            }
          />
          <Row label="GST & charges (simulated)" value={`₹${totals.gst_sim}`} />
          <div className="h-px bg-[var(--line)] my-1" />
          <Row label="To Pay" value={`₹${totals.to_pay}`} bold />
        </div>
      </div>

      <div className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[480px] bg-white border-t border-[var(--line)] px-4 py-3">
        <Link
          href="/checkout"
          className="flex items-center justify-between bg-[var(--im-orange)] text-white rounded-[var(--r-md)] px-4 py-3.5 font-bold text-[14px]"
        >
          <span>Proceed to Pay</span>
          <span>₹{totals.to_pay}</span>
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[13px] ${bold ? "font-extrabold text-[var(--ink-900)]" : "text-[var(--ink-700)]"}`}>
        {label}
      </span>
      <span className={`text-[13px] ${bold ? "font-extrabold text-[var(--ink-900)]" : "text-[var(--ink-900)] font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
