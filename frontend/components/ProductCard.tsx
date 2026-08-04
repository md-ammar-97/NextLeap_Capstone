"use client";

import { discountPct, type Sku } from "@/lib/catalog";
import { useCartStore } from "@/lib/store";
import { PlaceholderTile } from "./PlaceholderTile";
import { AddStepper } from "./AddStepper";

export function ProductCard({ sku, onOpen }: { sku: Sku; onOpen?: (skuId: string) => void }) {
  const line = useCartStore((s) => s.lines.find((l) => l.sku_id === sku.sku_id));
  const addToCart = useCartStore((s) => s.addToCart);
  const setQty = useCartStore((s) => s.setQty);
  const qty = line?.qty ?? 0;
  const discount = discountPct(sku);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onOpen?.(sku.sku_id)}
        className="relative w-full aspect-square rounded-[var(--r-md)] overflow-hidden bg-[var(--bg-soft)] text-left"
      >
        <PlaceholderTile categoryId={sku.category_id} className="w-full h-full" />
        <span
          className={`absolute top-1.5 left-1.5 w-3.5 h-3.5 border-2 flex items-center justify-center ${
            sku.veg ? "border-[var(--im-green)]" : "border-[var(--im-red)]"
          } bg-white`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${sku.veg ? "bg-[var(--im-green)]" : "bg-[var(--im-red)]"}`} />
        </span>
        {discount > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-[var(--im-yellow)] text-[var(--ink-900)] text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--r-sm)]">
            {discount}% OFF
          </span>
        )}
        {sku.out_of_stock && (
          <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-[11px] font-semibold text-[var(--ink-500)]">
            Out of stock
          </span>
        )}
      </button>

      <div className="mt-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[18px] font-medium line-clamp-2 text-[var(--ink-900)]">{sku.name}</p>
          <p className="text-[11px] text-[var(--ink-500)] mt-0.5">{sku.unit}</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[13px] font-bold">₹{sku.price}</span>
            {sku.mrp > sku.price && (
              <span className="text-[11px] text-[var(--ink-300)] line-through">₹{sku.mrp}</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-1.5">
        <AddStepper
          qty={qty}
          disabled={sku.out_of_stock}
          size="sm"
          onAdd={() => addToCart(sku.sku_id, 1)}
          onIncrement={() => setQty(sku.sku_id, qty + 1)}
          onDecrement={() => setQty(sku.sku_id, qty - 1)}
        />
      </div>
    </div>
  );
}
